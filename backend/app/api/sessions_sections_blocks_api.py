"""
Sessions, Sections, and Blocks CRUD API.

Sub-resource endpoints for managing template sessions (rotation units),
sections within sessions, and blocks within sections.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models import (
    User, Template, TemplateSession, Section, Block,
    Piece, Spot, TemplateBlockSpot,
)
from app.auth import get_current_user
from app.api.ownership import (
    get_owned_template as _get_owned_template,
    get_owned_session as _get_owned_session,
    get_owned_section as _get_owned_section,
    get_owned_block as _get_owned_block,
)
from app.schemas.template import (
    BlockCreate,
    BlockRead,
    BlockUpdate,
    DefaultSpotAdd,
    DefaultSpotRead,
    DefaultSpotReorder,
    ReorderRequest,
    SectionCreate,
    SectionRead,
    SectionUpdate,
    TemplateSessionCreate,
    TemplateSessionRead,
    TemplateSessionUpdate,
)

router = APIRouter(tags=["sessions-sections-blocks"])


async def _next_display_order(
    session: AsyncSession, model, parent_field, parent_id: int
) -> int:
    """Get the next display_order value for a child of the given parent."""
    result = await session.exec(
        select(func.coalesce(func.max(model.display_order), -1)).where(
            parent_field == parent_id
        )
    )
    return result.one() + 1


async def _reorder_items(
    session: AsyncSession,
    model,
    parent_field,
    parent_id: int,
    ordered_ids: List[int],
    item_label: str,
):
    """Reorder items by updating display_order. Validates IDs match parent's children.

    Uses a two-pass approach to avoid unique constraint violations on
    (parent_id, display_order) when swapping positions.
    """
    result = await session.exec(
        select(model).where(parent_field == parent_id)
    )
    items_by_id = {item.id: item for item in result.all()}

    if set(ordered_ids) != set(items_by_id.keys()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ordered_ids must contain exactly the {item_label} belonging to this parent",
        )

    # Pass 1: set all to negative offsets to avoid unique constraint conflicts
    for i, item_id in enumerate(ordered_ids):
        items_by_id[item_id].display_order = -(i + 1)
        session.add(items_by_id[item_id])
    await session.flush()

    # Pass 2: set to final values
    for i, item_id in enumerate(ordered_ids):
        items_by_id[item_id].display_order = i
        session.add(items_by_id[item_id])

    await session.commit()


async def _build_session_read(
    session: AsyncSession, ts: TemplateSession
) -> TemplateSessionRead:
    """Load a template session with nested sections and blocks,
    computing estimated_duration_minutes."""
    result = await session.exec(
        select(TemplateSession)
        .where(TemplateSession.id == ts.id)
        .options(
            selectinload(TemplateSession.sections)  # type: ignore[arg-type]
            .selectinload(Section.blocks)  # type: ignore[arg-type]
        )
    )
    loaded = result.one()

    sorted_sections = sorted(loaded.sections, key=lambda s: s.display_order)
    section_reads = []
    for sec in sorted_sections:
        sorted_blocks = sorted(sec.blocks, key=lambda b: b.display_order)
        block_reads = [await _build_block_read(session, b) for b in sorted_blocks]
        section_reads.append({
            "id": sec.id,
            "name": sec.name,
            "section_type": sec.section_type,
            "estimated_duration_minutes": sec.estimated_duration_minutes,
            "display_order": sec.display_order,
            "blocks": block_reads,
        })

    estimated = sum(s.estimated_duration_minutes for s in sorted_sections)
    return TemplateSessionRead(
        id=loaded.id,
        name=loaded.name,
        focus_description=loaded.focus_description,
        display_order=loaded.display_order,
        estimated_duration_minutes=estimated,
        sections=section_reads,
    )


async def _build_section_read(
    session: AsyncSession, sec: Section
) -> SectionRead:
    """Load a section with nested blocks."""
    result = await session.exec(
        select(Section)
        .where(Section.id == sec.id)
        .options(selectinload(Section.blocks))  # type: ignore[arg-type]
    )
    loaded = result.one()
    sorted_blocks = sorted(loaded.blocks, key=lambda b: b.display_order)
    block_reads = [await _build_block_read(session, b) for b in sorted_blocks]
    return SectionRead(
        id=loaded.id,
        name=loaded.name,
        section_type=loaded.section_type,
        estimated_duration_minutes=loaded.estimated_duration_minutes,
        display_order=loaded.display_order,
        blocks=block_reads,
    )


# ---------------------------------------------------------------------------
# Template Session endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/templates/{template_id}/sessions",
    response_model=TemplateSessionRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_session(
    template_id: int,
    body: TemplateSessionCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Add a session to the template's rotation."""
    await _get_owned_template(session, template_id, current_user.id)

    display_order = await _next_display_order(
        session, TemplateSession, TemplateSession.template_id, template_id
    )
    ts = TemplateSession(
        template_id=template_id,
        name=body.name,
        focus_description=body.focus_description,
        display_order=display_order,
    )
    session.add(ts)
    await session.commit()
    await session.refresh(ts)
    return await _build_session_read(session, ts)


@router.patch("/sessions/{session_id}", response_model=TemplateSessionRead)
async def update_session(
    session_id: int,
    body: TemplateSessionUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a session's name or focus description."""
    ts = await _get_owned_session(session, session_id, current_user.id)

    update_data = body.model_dump(exclude_unset=True, mode="json")
    for field, value in update_data.items():
        setattr(ts, field, value)

    session.add(ts)
    await session.commit()
    await session.refresh(ts)
    return await _build_session_read(session, ts)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete a session, reorder remaining sessions, and adjust rotation index."""
    ts = await _get_owned_session(session, session_id, current_user.id)
    template_id = ts.template_id
    deleted_order = ts.display_order

    await session.delete(ts)

    # Reorder remaining sessions to fill the gap
    result = await session.exec(
        select(TemplateSession).where(
            TemplateSession.template_id == template_id,
            TemplateSession.display_order > deleted_order,
        )
    )
    for remaining in result.all():
        remaining.display_order -= 1
        session.add(remaining)

    # Adjust current_rotation_index on the template
    template = await _get_owned_template(session, template_id, current_user.id)
    remaining_count_result = await session.exec(
        select(func.count(TemplateSession.id)).where(
            TemplateSession.template_id == template_id,
        )
    )
    remaining_count = remaining_count_result.one()

    if remaining_count == 0:
        template.current_rotation_index = 0
    elif deleted_order < template.current_rotation_index:
        template.current_rotation_index -= 1
    elif deleted_order == template.current_rotation_index:
        # Wrap to 0 if we were at the end, otherwise stay (now points to next)
        if template.current_rotation_index >= remaining_count:
            template.current_rotation_index = 0

    session.add(template)
    await session.commit()


@router.put(
    "/templates/{template_id}/sessions/reorder",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def reorder_sessions(
    template_id: int,
    body: ReorderRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Reorder sessions in the template's rotation."""
    await _get_owned_template(session, template_id, current_user.id)
    await _reorder_items(
        session,
        TemplateSession,
        TemplateSession.template_id,
        template_id,
        body.ordered_ids,
        "sessions",
    )


# ---------------------------------------------------------------------------
# Section endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/sessions/{session_id}/sections",
    response_model=SectionRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_section(
    session_id: int,
    body: SectionCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Add a section to a template session."""
    await _get_owned_session(session, session_id, current_user.id)

    display_order = await _next_display_order(
        session, Section, Section.template_session_id, session_id
    )
    sec = Section(
        template_session_id=session_id,
        name=body.name,
        section_type=body.section_type.value,
        estimated_duration_minutes=body.estimated_duration_minutes,
        display_order=display_order,
    )
    session.add(sec)
    await session.commit()
    await session.refresh(sec)
    return await _build_section_read(session, sec)


@router.patch("/sections/{section_id}", response_model=SectionRead)
async def update_section(
    section_id: int,
    body: SectionUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a section's name, type, or estimated duration."""
    sec = await _get_owned_section(session, section_id, current_user.id)

    update_data = body.model_dump(exclude_unset=True, mode="json")
    for field, value in update_data.items():
        setattr(sec, field, value)

    session.add(sec)
    await session.commit()
    await session.refresh(sec)
    return await _build_section_read(session, sec)


@router.delete("/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_section(
    section_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete a section and its blocks."""
    sec = await _get_owned_section(session, section_id, current_user.id)
    parent_id = sec.template_session_id
    deleted_order = sec.display_order

    await session.delete(sec)

    # Reorder remaining sections to fill the gap
    result = await session.exec(
        select(Section).where(
            Section.template_session_id == parent_id,
            Section.display_order > deleted_order,
        )
    )
    for remaining in result.all():
        remaining.display_order -= 1
        session.add(remaining)

    await session.commit()


@router.put(
    "/sessions/{session_id}/sections/reorder",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def reorder_sections(
    session_id: int,
    body: ReorderRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Reorder sections within a template session."""
    await _get_owned_session(session, session_id, current_user.id)
    await _reorder_items(
        session,
        Section,
        Section.template_session_id,
        session_id,
        body.ordered_ids,
        "sections",
    )


# ---------------------------------------------------------------------------
# Block endpoints
# ---------------------------------------------------------------------------

async def _build_block_read(session: AsyncSession, block: Block) -> BlockRead:
    """Build a BlockRead, enriching repertoire blocks with piece_name and default_spots.

    Single-block path (2 queries for repertoire blocks). For batch loading in
    template detail responses, see _build_template_read in templates_api.py.
    """
    data = {
        "id": block.id,
        "name": block.name,
        "description": block.description,
        "estimated_duration_minutes": block.estimated_duration_minutes,
        "tempo_bpm": block.tempo_bpm,
        "key": block.key,
        "difficulty_level": block.difficulty_level,
        "display_order": block.display_order,
        "curated_block_id": block.curated_block_id,
        "piece_id": block.piece_id,
    }
    if block.piece_id is not None:
        # Fetch piece name
        result = await session.exec(
            select(Piece.name).where(Piece.id == block.piece_id)
        )
        data["piece_name"] = result.one()

        # Fetch default spots
        result = await session.exec(
            select(Spot.id, Spot.name, Spot.location, TemplateBlockSpot.display_order)
            .join(TemplateBlockSpot, TemplateBlockSpot.spot_id == Spot.id)
            .where(TemplateBlockSpot.block_id == block.id)
            .order_by(TemplateBlockSpot.display_order)
        )
        data["default_spots"] = [
            DefaultSpotRead(id=r[0], name=r[1], location=r[2], display_order=r[3])
            for r in result.all()
        ]
    return BlockRead(**data)


@router.post(
    "/sections/{section_id}/blocks",
    response_model=BlockRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_block(
    section_id: int,
    body: BlockCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Add a block to a section (standard or repertoire flavor)."""
    section = await _get_owned_section(session, section_id, current_user.id)

    display_order = await _next_display_order(
        session, Block, Block.section_id, section_id
    )

    if body.piece_id is not None:
        # Repertoire block — validate piece ownership through the template chain
        # The section belongs to a template which belongs to an instrument;
        # the piece must belong to the same instrument.
        result = await session.exec(
            select(TemplateSession)
            .where(TemplateSession.id == section.template_session_id)
        )
        ts = result.one()
        result = await session.exec(
            select(Template).where(Template.id == ts.template_id)
        )
        template = result.one()

        result = await session.exec(
            select(Piece).where(
                Piece.id == body.piece_id,
                Piece.instrument_id == template.instrument_id,
                Piece.deleted_at == None,  # noqa: E711
            )
        )
        piece = result.first()
        if not piece:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Piece not found or does not belong to this instrument",
            )

        # Validate ALL spots up front before creating anything, so a
        # validation failure doesn't leave an orphaned block.
        if body.default_spot_ids:
            for spot_id in body.default_spot_ids:
                result = await session.exec(
                    select(Spot).where(
                        Spot.id == spot_id,
                        Spot.piece_id == piece.id,
                        Spot.deleted_at == None,  # noqa: E711
                    )
                )
                if not result.first():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Spot {spot_id} not found or does not belong to this piece",
                    )

        block = Block(
            section_id=section_id,
            piece_id=piece.id,
            display_order=display_order,
        )
        session.add(block)
        await session.flush()  # get block.id without committing

        if body.default_spot_ids:
            for i, spot_id in enumerate(body.default_spot_ids):
                tbs = TemplateBlockSpot(
                    block_id=block.id, spot_id=spot_id, display_order=i
                )
                session.add(tbs)

        await session.commit()
        await session.refresh(block)
    else:
        # Standard block
        block = Block(
            section_id=section_id,
            name=body.name,
            curated_block_id=body.curated_block_id,
            description=body.description,
            estimated_duration_minutes=body.estimated_duration_minutes,
            tempo_bpm=body.tempo_bpm,
            key=body.key,
            difficulty_level=body.difficulty_level,
            display_order=display_order,
        )
        session.add(block)
        await session.commit()
        await session.refresh(block)

    return await _build_block_read(session, block)


@router.patch("/blocks/{block_id}", response_model=BlockRead)
async def update_block(
    block_id: int,
    body: BlockUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a block's name, tempo, key, duration, etc."""
    block = await _get_owned_block(session, block_id, current_user.id)

    update_data = body.model_dump(exclude_unset=True, mode="json")
    for field, value in update_data.items():
        setattr(block, field, value)

    session.add(block)
    await session.commit()
    await session.refresh(block)
    return await _build_block_read(session, block)


@router.delete("/blocks/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_block(
    block_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete a block."""
    block = await _get_owned_block(session, block_id, current_user.id)
    parent_id = block.section_id
    deleted_order = block.display_order

    await session.delete(block)

    # Reorder remaining blocks to fill the gap
    result = await session.exec(
        select(Block).where(
            Block.section_id == parent_id,
            Block.display_order > deleted_order,
        )
    )
    for remaining in result.all():
        remaining.display_order -= 1
        session.add(remaining)

    await session.commit()


@router.put(
    "/sections/{section_id}/blocks/reorder",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def reorder_blocks(
    section_id: int,
    body: ReorderRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Reorder blocks within a section."""
    await _get_owned_section(session, section_id, current_user.id)
    await _reorder_items(
        session,
        Block,
        Block.section_id,
        section_id,
        body.ordered_ids,
        "blocks",
    )


# ---------------------------------------------------------------------------
# Default spots — manage the spot list on a repertoire block
# ---------------------------------------------------------------------------

@router.post(
    "/blocks/{block_id}/default-spots",
    response_model=BlockRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_default_spot(
    block_id: int,
    body: DefaultSpotAdd,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Add a spot to a repertoire block's default list."""
    block = await _get_owned_block(session, block_id, current_user.id)

    if block.piece_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Block is not a repertoire block",
        )

    # Validate spot belongs to the same piece
    result = await session.exec(
        select(Spot).where(
            Spot.id == body.spot_id,
            Spot.piece_id == block.piece_id,
            Spot.deleted_at == None,  # noqa: E711
        )
    )
    spot = result.first()
    if not spot:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Spot not found or does not belong to this block's piece",
        )

    # Check for duplicate
    result = await session.exec(
        select(TemplateBlockSpot).where(
            TemplateBlockSpot.block_id == block.id,
            TemplateBlockSpot.spot_id == body.spot_id,
        )
    )
    if result.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Spot is already in this block's default list",
        )

    # Next display_order
    next_order = await _next_display_order(
        session, TemplateBlockSpot, TemplateBlockSpot.block_id, block.id
    )
    tbs = TemplateBlockSpot(
        block_id=block.id, spot_id=body.spot_id, display_order=next_order
    )
    session.add(tbs)
    await session.commit()

    return await _build_block_read(session, block)


@router.delete(
    "/blocks/{block_id}/default-spots/{spot_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_default_spot(
    block_id: int,
    spot_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Remove a spot from a repertoire block's default list.

    Does NOT retire or delete the spot itself.
    """
    block = await _get_owned_block(session, block_id, current_user.id)

    result = await session.exec(
        select(TemplateBlockSpot).where(
            TemplateBlockSpot.block_id == block.id,
            TemplateBlockSpot.spot_id == spot_id,
        )
    )
    tbs = result.first()
    if not tbs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Spot not in this block's default list",
        )

    deleted_order = tbs.display_order
    await session.delete(tbs)

    # Reorder remaining spots
    result = await session.exec(
        select(TemplateBlockSpot).where(
            TemplateBlockSpot.block_id == block.id,
            TemplateBlockSpot.display_order > deleted_order,
        )
    )
    for remaining in result.all():
        remaining.display_order -= 1
        session.add(remaining)

    await session.commit()


@router.put(
    "/blocks/{block_id}/default-spots/reorder",
    response_model=BlockRead,
)
async def reorder_default_spots(
    block_id: int,
    body: DefaultSpotReorder,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Reorder the default spot list on a repertoire block."""
    block = await _get_owned_block(session, block_id, current_user.id)

    if block.piece_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Block is not a repertoire block",
        )

    # Fetch existing default spots
    result = await session.exec(
        select(TemplateBlockSpot).where(
            TemplateBlockSpot.block_id == block.id
        )
    )
    tbs_by_spot = {t.spot_id: t for t in result.all()}

    if set(body.spot_ids) != set(tbs_by_spot.keys()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="spot_ids must contain exactly the spots in this block's default list",
        )

    for i, sid in enumerate(body.spot_ids):
        tbs_by_spot[sid].display_order = i
        session.add(tbs_by_spot[sid])

    await session.commit()
    return await _build_block_read(session, block)
