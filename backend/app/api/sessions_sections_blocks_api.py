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
from app.models import User, Template, TemplateSession, Section, Block
from app.auth import get_current_user
from app.schemas.template import (
    BlockCreate,
    BlockRead,
    BlockUpdate,
    ReorderRequest,
    SectionCreate,
    SectionRead,
    SectionUpdate,
    TemplateSessionCreate,
    TemplateSessionRead,
    TemplateSessionUpdate,
)

router = APIRouter(tags=["sessions-sections-blocks"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_owned_template(
    session: AsyncSession, template_id: int, user_id: int
) -> Template:
    """Fetch a template, verifying ownership and not deleted."""
    result = await session.exec(
        select(Template).where(
            Template.id == template_id,
            Template.user_id == user_id,
            Template.deleted_at == None,  # noqa: E711
        )
    )
    template = result.first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    return template


async def _get_owned_session(
    session: AsyncSession, session_id: int, user_id: int
) -> TemplateSession:
    """Fetch a template session, verifying ownership through the template."""
    result = await session.exec(
        select(TemplateSession)
        .join(Template, TemplateSession.template_id == Template.id)
        .where(
            TemplateSession.id == session_id,
            Template.user_id == user_id,
            Template.deleted_at == None,  # noqa: E711
        )
    )
    ts = result.first()
    if not ts:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    return ts


async def _get_owned_section(
    session: AsyncSession, section_id: int, user_id: int
) -> Section:
    """Fetch a section, verifying ownership through the template chain."""
    result = await session.exec(
        select(Section)
        .join(TemplateSession, Section.template_session_id == TemplateSession.id)
        .join(Template, TemplateSession.template_id == Template.id)
        .where(
            Section.id == section_id,
            Template.user_id == user_id,
            Template.deleted_at == None,  # noqa: E711
        )
    )
    sec = result.first()
    if not sec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found",
        )
    return sec


async def _get_owned_block(
    session: AsyncSession, block_id: int, user_id: int
) -> Block:
    """Fetch a block, verifying ownership through the template chain."""
    result = await session.exec(
        select(Block)
        .join(Section, Block.section_id == Section.id)
        .join(TemplateSession, Section.template_session_id == TemplateSession.id)
        .join(Template, TemplateSession.template_id == Template.id)
        .where(
            Block.id == block_id,
            Template.user_id == user_id,
            Template.deleted_at == None,  # noqa: E711
        )
    )
    block = result.first()
    if not block:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Block not found",
        )
    return block


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
        section_reads.append({
            "id": sec.id,
            "name": sec.name,
            "section_type": sec.section_type,
            "estimated_duration_minutes": sec.estimated_duration_minutes,
            "display_order": sec.display_order,
            "blocks": sorted_blocks,
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
    return SectionRead(
        id=loaded.id,
        name=loaded.name,
        section_type=loaded.section_type,
        estimated_duration_minutes=loaded.estimated_duration_minutes,
        display_order=loaded.display_order,
        blocks=sorted_blocks,
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

    update_data = body.model_dump(exclude_unset=True)
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
    """Delete a session and reorder remaining sessions."""
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
    """Add a block to a section."""
    await _get_owned_section(session, section_id, current_user.id)

    display_order = await _next_display_order(
        session, Block, Block.section_id, section_id
    )
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
    return block


@router.patch("/blocks/{block_id}", response_model=BlockRead)
async def update_block(
    block_id: int,
    body: BlockUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a block's name, tempo, key, duration, etc."""
    block = await _get_owned_block(session, block_id, current_user.id)

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(block, field, value)

    session.add(block)
    await session.commit()
    await session.refresh(block)
    return block


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
