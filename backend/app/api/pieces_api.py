"""
Pieces and Spots API — CRUD for the repertoire model.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import get_session
from app.models import (
    User, Piece, Spot, Block, BlockLog, PracticeLog, SectionLog,
)
from app.auth import get_current_user
from app.enums import utcnow
from app.api.ownership import get_owned_instrument, get_owned_piece, get_owned_spot
from app.schemas.piece import (
    PieceCreate, PieceRead, PieceDetailRead, PieceUpdate,
    SpotCreate, SpotRead, SpotUpdate, SpotReorder,
    SpotHistoryRead, SpotHistoryEntry,
)

router = APIRouter(tags=["pieces"])


# ---------------------------------------------------------------------------
# Computed field helpers
# ---------------------------------------------------------------------------

async def _enrich_piece(session: AsyncSession, piece: Piece) -> PieceRead:
    """Build PieceRead with computed fields.

    A block_log relates to a piece via two paths: spot-level logs (spot_id ->
    spot.piece_id) and piece-level logs (block_id -> block.piece_id with
    spot_id IS NULL). We use a single query with outerjoin + OR to avoid
    double-counting sessions that have both.
    """
    import sqlalchemy as sa

    # Single query: find all block_logs for this piece via either path
    base = (
        select(
            func.count(func.distinct(PracticeLog.id)),
            func.max(PracticeLog.practice_date),
        )
        .join(SectionLog, SectionLog.practice_log_id == PracticeLog.id)
        .join(BlockLog, BlockLog.section_log_id == SectionLog.id)
        .outerjoin(Spot, Spot.id == BlockLog.spot_id)
        .outerjoin(Block, Block.id == BlockLog.block_id)
        .where(
            sa.or_(
                Spot.piece_id == piece.id,
                sa.and_(
                    Block.piece_id == piece.id,
                    BlockLog.spot_id == None,  # noqa: E711
                ),
            ),
            PracticeLog.status == "completed",
            PracticeLog.deleted_at == None,  # noqa: E711
        )
    )
    result = await session.exec(base)
    row = result.one()
    session_count = row[0]
    last_practiced_at = row[1]

    return PieceRead(
        id=piece.id,
        instrument_id=piece.instrument_id,
        name=piece.name,
        composer_or_source=piece.composer_or_source,
        session_count=session_count,
        last_practiced_at=last_practiced_at,
    )


async def _enrich_spot(session: AsyncSession, spot: Spot) -> SpotRead:
    """Build SpotRead with computed fields.

    TODO: Consolidate these two queries into one (like _enrich_piece) for
    a minor performance win. No correctness issue — spots are single-path.
    """
    # session_count: distinct practice_logs with a block_log for this spot
    result = await session.exec(
        select(func.count(func.distinct(PracticeLog.id)))
        .join(SectionLog, SectionLog.practice_log_id == PracticeLog.id)
        .join(BlockLog, BlockLog.section_log_id == SectionLog.id)
        .where(
            BlockLog.spot_id == spot.id,
            PracticeLog.status == "completed",
            PracticeLog.deleted_at == None,  # noqa: E711
        )
    )
    session_count = result.one()

    # last_practiced_at
    result = await session.exec(
        select(func.max(PracticeLog.practice_date))
        .join(SectionLog, SectionLog.practice_log_id == PracticeLog.id)
        .join(BlockLog, BlockLog.section_log_id == SectionLog.id)
        .where(
            BlockLog.spot_id == spot.id,
            PracticeLog.status == "completed",
            PracticeLog.deleted_at == None,  # noqa: E711
        )
    )
    last_practiced_at = result.one()

    return SpotRead(
        id=spot.id,
        name=spot.name,
        location=spot.location,
        display_order=spot.display_order,
        retired_at=spot.retired_at,
        session_count=session_count,
        last_practiced_at=last_practiced_at,
    )


# ---------------------------------------------------------------------------
# Pieces endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/instruments/{instrument_id}/pieces",
    response_model=List[PieceRead],
)
async def list_pieces(
    instrument_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List pieces for an instrument."""
    instrument = await get_owned_instrument(session, instrument_id, current_user.id)

    result = await session.exec(
        select(Piece)
        .where(
            Piece.instrument_id == instrument.id,
            Piece.deleted_at == None,  # noqa: E711
        )
        .order_by(Piece.name)
    )
    pieces = result.all()
    return [await _enrich_piece(session, p) for p in pieces]


@router.post(
    "/instruments/{instrument_id}/pieces",
    response_model=PieceRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_piece(
    instrument_id: int,
    body: PieceCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new piece in the instrument's repertoire library."""
    instrument = await get_owned_instrument(session, instrument_id, current_user.id)

    piece = Piece(
        instrument_id=instrument.id,
        name=body.name,
        composer_or_source=body.composer_or_source,
    )
    session.add(piece)
    await session.commit()
    await session.refresh(piece)
    return await _enrich_piece(session, piece)


@router.get("/pieces/{piece_id}", response_model=PieceDetailRead)
async def get_piece(
    piece_id: int,
    include_retired_spots: bool = Query(default=False),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get full piece detail with spots."""
    piece = await get_owned_piece(session, piece_id, current_user.id)

    # Fetch spots
    query = select(Spot).where(
        Spot.piece_id == piece.id,
        Spot.deleted_at == None,  # noqa: E711
    )
    if not include_retired_spots:
        query = query.where(Spot.retired_at == None)  # noqa: E711

    query = query.order_by(Spot.display_order, Spot.id)
    result = await session.exec(query)
    spots = result.all()

    enriched_piece = await _enrich_piece(session, piece)
    enriched_spots = [await _enrich_spot(session, s) for s in spots]

    return PieceDetailRead(
        **enriched_piece.model_dump(),
        spots=enriched_spots,
    )


@router.patch("/pieces/{piece_id}", response_model=PieceRead)
async def update_piece(
    piece_id: int,
    body: PieceUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a piece's name or composer_or_source."""
    piece = await get_owned_piece(session, piece_id, current_user.id)

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(piece, field, value)

    session.add(piece)
    await session.commit()
    await session.refresh(piece)
    return await _enrich_piece(session, piece)


@router.delete("/pieces/{piece_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_piece(
    piece_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a piece and cascade to its spots.

    Historical block_logs are preserved — block_name is denormalized so
    logs remain readable after deletion.
    """
    piece = await get_owned_piece(session, piece_id, current_user.id)

    now = utcnow()
    piece.deleted_at = now
    session.add(piece)

    # Cascade: soft-delete all spots for this piece
    result = await session.exec(
        select(Spot).where(
            Spot.piece_id == piece.id,
            Spot.deleted_at == None,  # noqa: E711
        )
    )
    for spot in result.all():
        spot.deleted_at = now
        session.add(spot)

    await session.commit()


# ---------------------------------------------------------------------------
# Spots endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/pieces/{piece_id}/spots",
    response_model=SpotRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_spot(
    piece_id: int,
    body: SpotCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new spot on a piece."""
    piece = await get_owned_piece(session, piece_id, current_user.id)

    # Next display_order
    result = await session.exec(
        select(func.coalesce(func.max(Spot.display_order), -1)).where(
            Spot.piece_id == piece.id,
            Spot.deleted_at == None,  # noqa: E711
        )
    )
    max_order = result.one()

    spot = Spot(
        piece_id=piece.id,
        name=body.name,
        location=body.location,
        display_order=max_order + 1,
    )
    session.add(spot)
    await session.commit()
    await session.refresh(spot)
    return await _enrich_spot(session, spot)


@router.patch("/spots/{spot_id}", response_model=SpotRead)
async def update_spot(
    spot_id: int,
    body: SpotUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a spot's name, location, or display_order."""
    spot = await get_owned_spot(session, spot_id, current_user.id)

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(spot, field, value)

    session.add(spot)
    await session.commit()
    await session.refresh(spot)
    return await _enrich_spot(session, spot)


@router.post("/spots/{spot_id}/retire", response_model=SpotRead)
async def retire_spot(
    spot_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Retire a spot from active rotation."""
    spot = await get_owned_spot(session, spot_id, current_user.id)
    spot.retired_at = utcnow()
    session.add(spot)
    await session.commit()
    await session.refresh(spot)
    return await _enrich_spot(session, spot)


@router.post("/spots/{spot_id}/unretire", response_model=SpotRead)
async def unretire_spot(
    spot_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Restore a retired spot to active rotation."""
    spot = await get_owned_spot(session, spot_id, current_user.id)
    spot.retired_at = None
    session.add(spot)
    await session.commit()
    await session.refresh(spot)
    return await _enrich_spot(session, spot)


@router.delete("/spots/{spot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_spot(
    spot_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a spot.

    Distinct from retiring. Historical block_logs are preserved — spot_id
    on block_logs uses ON DELETE SET NULL (not CASCADE), and block_name is
    denormalized so logs remain readable.
    """
    spot = await get_owned_spot(session, spot_id, current_user.id)
    spot.deleted_at = utcnow()
    session.add(spot)
    await session.commit()


@router.put(
    "/pieces/{piece_id}/spots/reorder",
    response_model=List[SpotRead],
)
async def reorder_spots(
    piece_id: int,
    body: SpotReorder,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Reorder spots within a piece.

    Includes retired spots — they preserve their position so un-retiring
    restores them to the expected place. Only soft-deleted spots are excluded.
    """
    piece = await get_owned_piece(session, piece_id, current_user.id)

    # Fetch all non-deleted spots (including retired) for this piece
    result = await session.exec(
        select(Spot).where(
            Spot.piece_id == piece.id,
            Spot.deleted_at == None,  # noqa: E711
        )
    )
    spots_by_id = {s.id: s for s in result.all()}

    # Validate that all IDs match
    if set(body.spot_ids) != set(spots_by_id.keys()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="spot_ids must contain exactly the active spots for this piece",
        )

    for i, spot_id in enumerate(body.spot_ids):
        spots_by_id[spot_id].display_order = i
        session.add(spots_by_id[spot_id])

    await session.commit()

    # Return in new order
    ordered = sorted(spots_by_id.values(), key=lambda s: s.display_order)
    return [await _enrich_spot(session, s) for s in ordered]


@router.get("/spots/{spot_id}/history", response_model=SpotHistoryRead)
async def get_spot_history(
    spot_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get a spot's practice history with rating trend."""
    spot = await get_owned_spot(session, spot_id, current_user.id)

    # Fetch block_logs for this spot, joined to practice_log for date and id
    result = await session.exec(
        select(
            BlockLog.id,
            PracticeLog.practice_date,
            BlockLog.rating,
            BlockLog.notes,
            PracticeLog.id.label("session_id"),
        )
        .join(SectionLog, BlockLog.section_log_id == SectionLog.id)
        .join(PracticeLog, SectionLog.practice_log_id == PracticeLog.id)
        .where(
            BlockLog.spot_id == spot.id,
            PracticeLog.status == "completed",
            PracticeLog.deleted_at == None,  # noqa: E711
        )
        .order_by(PracticeLog.practice_date.desc(), BlockLog.id.desc())
    )
    rows = result.all()

    logs = []
    trend = {"step_back": 0, "steady": 0, "step_forward": 0, "skipped": 0}
    for row in rows:
        logs.append(SpotHistoryEntry(
            block_log_id=row[0],
            practice_date=row[1],
            rating=row[2],
            notes=row[3],
            session_id=row[4],
        ))
        if row[2] is None:
            trend["skipped"] += 1
        elif row[2] == -1:
            trend["step_back"] += 1
        elif row[2] == 0:
            trend["steady"] += 1
        elif row[2] == 1:
            trend["step_forward"] += 1

    enriched_spot = await _enrich_spot(session, spot)

    return SpotHistoryRead(
        spot=enriched_spot,
        logs=logs,
        rating_trend=trend,
    )
