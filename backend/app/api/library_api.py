"""
Library API — curated blocks, recently used, and repertoire pieces.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import get_session
from app.models import (
    User, Instrument, CuratedBlock, Template, TemplateSession,
    Section, Block, BlockLog, SectionLog, PracticeLog, Piece, Spot,
)
from app.auth import get_current_user
from app.api.ownership import get_owned_instrument
from app.schemas.curated import (
    CuratedBlockRead,
    RecentBlockRead,
    LibraryPieceRead,
    LibrarySpotRead,
    LibraryRepertoireResponse,
)

router = APIRouter(prefix="/library", tags=["library"])


# ---------------------------------------------------------------------------
# Browse curated blocks
# ---------------------------------------------------------------------------

@router.get("/blocks", response_model=List[CuratedBlockRead])
async def browse_curated_blocks(
    instrument: str = Query(..., description="Instrument category, e.g. 'violin'"),
    section_type: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None, description="Search by name"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Browse curated blocks filtered by instrument, optionally by section
    type and a name search. Sorted by usage_count desc.

    Each result includes a `usage_percentage` — the share of users with this
    instrument category whose templates include this curated block.
    """
    query = select(CuratedBlock).where(
        CuratedBlock.instrument_category == instrument
    )
    if section_type is not None:
        query = query.where(CuratedBlock.section_type == section_type)
    if q:
        query = query.where(CuratedBlock.name.ilike(f"%{q}%"))  # type: ignore[attr-defined]
    query = query.order_by(CuratedBlock.usage_count.desc(), CuratedBlock.id)  # type: ignore[attr-defined]

    result = await session.exec(query)
    curated_blocks = result.all()

    if not curated_blocks:
        return []

    # Compute usage_percentage: of users with an instrument of this category
    # (case-insensitive name match), what fraction has at least one template
    # block referencing this curated block.
    denom_result = await session.exec(
        select(func.count(func.distinct(Instrument.user_id))).where(
            func.lower(Instrument.name) == instrument.lower(),
            Instrument.deleted_at == None,  # noqa: E711
        )
    )
    total_users = denom_result.one() or 0

    enriched = []
    for cb in curated_blocks:
        if total_users == 0:
            pct = 0
        else:
            users_result = await session.exec(
                select(func.count(func.distinct(Template.user_id)))
                .select_from(Block)
                .join(Section, Block.section_id == Section.id)
                .join(
                    TemplateSession,
                    Section.template_session_id == TemplateSession.id,
                )
                .join(Template, TemplateSession.template_id == Template.id)
                .join(Instrument, Instrument.id == Template.instrument_id)
                .where(
                    Block.curated_block_id == cb.id,
                    func.lower(Instrument.name) == instrument.lower(),
                    Template.deleted_at == None,  # noqa: E711
                    Instrument.deleted_at == None,  # noqa: E711
                )
            )
            users_with_block = users_result.one() or 0
            pct = round((users_with_block / total_users) * 100)

        enriched.append(CuratedBlockRead(
            id=cb.id,
            name=cb.name,
            description=cb.description,
            section_type=cb.section_type,
            default_duration_minutes=cb.default_duration_minutes,
            usage_count=cb.usage_count,
            usage_percentage=pct,
        ))

    return enriched


# ---------------------------------------------------------------------------
# Recently used blocks
# ---------------------------------------------------------------------------

@router.get("/recent", response_model=List[RecentBlockRead])
async def list_recent_blocks(
    instrument_id: int = Query(...),
    limit: int = Query(default=10, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Recently-used blocks for the current user on a specific instrument.

    Returns blocks (curated and freeform/quick-add) from recent practice
    sessions, deduplicated by name, most recent first. Excludes repertoire
    blocks (those have their own "Your repertoire" tab).
    """
    instrument = await get_owned_instrument(
        session, instrument_id, current_user.id
    )

    # Pull recent block_logs joined to practice logs for this instrument
    result = await session.exec(
        select(
            BlockLog.block_name,
            BlockLog.block_id,
            func.max(PracticeLog.practice_date).label("last_used"),
        )
        .join(SectionLog, BlockLog.section_log_id == SectionLog.id)
        .join(PracticeLog, SectionLog.practice_log_id == PracticeLog.id)
        .outerjoin(Block, Block.id == BlockLog.block_id)
        .where(
            PracticeLog.user_id == current_user.id,
            PracticeLog.instrument_id == instrument.id,
            PracticeLog.status == "completed",
            PracticeLog.deleted_at == None,  # noqa: E711
            # Exclude repertoire blocks (those with piece_id set on Block)
            # but keep freeform blocks (Block is null) and standard blocks.
            (Block.piece_id == None) | (Block.id == None),  # noqa: E711
        )
        .group_by(BlockLog.block_name, BlockLog.block_id)
        .order_by(func.max(PracticeLog.practice_date).desc())
        .limit(limit)
    )
    rows = result.all()

    # For each unique name, fetch curated_block_id if applicable
    items: List[RecentBlockRead] = []
    for row in rows:
        block_name, block_id, last_used = row[0], row[1], row[2]
        curated_id = None
        if block_id is not None:
            cb_result = await session.exec(
                select(Block.curated_block_id).where(Block.id == block_id)
            )
            curated_id = cb_result.first()
        items.append(RecentBlockRead(
            name=block_name,
            block_id=block_id,
            curated_block_id=curated_id,
            last_used_at=last_used,
        ))

    return items


# ---------------------------------------------------------------------------
# Repertoire pieces (for the block library "Your repertoire" tab)
# ---------------------------------------------------------------------------

@router.get("/repertoire", response_model=LibraryRepertoireResponse)
async def list_repertoire_pieces(
    instrument_id: int = Query(...),
    include_retired: bool = Query(default=False),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Pieces from the user's repertoire library, formatted for the
    block library 'Your repertoire' tab.

    Each piece includes its active spots and last_practiced_at. By default,
    retired and deleted spots are excluded; pass include_retired=true to
    include retired (but not deleted) spots.
    """
    instrument = await get_owned_instrument(
        session, instrument_id, current_user.id
    )

    result = await session.exec(
        select(Piece)
        .where(
            Piece.instrument_id == instrument.id,
            Piece.deleted_at == None,  # noqa: E711
        )
        .order_by(Piece.name)
    )
    pieces = result.all()

    response_pieces: List[LibraryPieceRead] = []
    for piece in pieces:
        spot_query = select(Spot).where(
            Spot.piece_id == piece.id,
            Spot.deleted_at == None,  # noqa: E711
        )
        if not include_retired:
            spot_query = spot_query.where(Spot.retired_at == None)  # noqa: E711
        spot_query = spot_query.order_by(Spot.display_order, Spot.id)
        spot_result = await session.exec(spot_query)
        spots = spot_result.all()

        # active_spot_count is always the count of non-retired, non-deleted spots
        active_count_result = await session.exec(
            select(func.count(Spot.id)).where(  # type: ignore[arg-type]
                Spot.piece_id == piece.id,
                Spot.deleted_at == None,  # noqa: E711
                Spot.retired_at == None,  # noqa: E711
            )
        )
        active_count = active_count_result.one()

        # last_practiced_at — max practice_date across all block logs
        # for any spot of this piece OR piece-level logs.
        last_via_spots = await session.exec(
            select(func.max(PracticeLog.practice_date))
            .join(SectionLog, SectionLog.practice_log_id == PracticeLog.id)
            .join(BlockLog, BlockLog.section_log_id == SectionLog.id)
            .join(Spot, Spot.id == BlockLog.spot_id)
            .where(
                Spot.piece_id == piece.id,
                PracticeLog.status == "completed",
                PracticeLog.deleted_at == None,  # noqa: E711
            )
        )
        last_via_spots_date = last_via_spots.one()

        last_via_piece = await session.exec(
            select(func.max(PracticeLog.practice_date))
            .join(SectionLog, SectionLog.practice_log_id == PracticeLog.id)
            .join(BlockLog, BlockLog.section_log_id == SectionLog.id)
            .join(Block, Block.id == BlockLog.block_id)
            .where(
                Block.piece_id == piece.id,
                BlockLog.spot_id == None,  # noqa: E711
                PracticeLog.status == "completed",
                PracticeLog.deleted_at == None,  # noqa: E711
            )
        )
        last_via_piece_date = last_via_piece.one()

        last_practiced_at = max(
            (d for d in [last_via_spots_date, last_via_piece_date] if d is not None),
            default=None,
        )

        response_pieces.append(LibraryPieceRead(
            id=piece.id,
            name=piece.name,
            composer_or_source=piece.composer_or_source,
            active_spot_count=active_count,
            last_practiced_at=last_practiced_at,
            spots=[
                LibrarySpotRead(id=s.id, name=s.name, location=s.location)
                for s in spots
            ],
        ))

    return LibraryRepertoireResponse(pieces=response_pieces)
