"""
Templates API — CRUD for practice templates within instruments.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models import (
    User, Instrument, Template, TemplateSession, Section, Block,
    UserSettings, Piece, Spot, TemplateBlockSpot,
)
from app.auth import get_current_user
from app.enums import SectionType, utcnow
from app.schemas.template import (
    BlockRead,
    DefaultSpotRead,
    DuplicateRequest,
    TemplateCreate,
    TemplateListItem,
    TemplateRead,
    TemplateSessionRead,
    TemplateUpdate,
)

router = APIRouter(tags=["templates"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

from app.api.ownership import (
    get_owned_instrument as _get_owned_instrument,
    get_owned_template as _get_owned_template,
)


async def _build_template_read(
    session: AsyncSession, template: Template
) -> TemplateRead:
    """Load a template with full nested sessions → sections → blocks
    and compute estimated_duration_minutes on each session.

    Repertoire blocks are enriched with piece_name and default_spots.
    """
    result = await session.exec(
        select(Template)
        .where(Template.id == template.id)
        .options(
            selectinload(Template.sessions)  # type: ignore[arg-type]
            .selectinload(TemplateSession.sections)  # type: ignore[arg-type]
            .selectinload(Section.blocks)  # type: ignore[arg-type]
            .selectinload(Block.template_block_spots)  # type: ignore[arg-type]
            .selectinload(TemplateBlockSpot.spot)  # type: ignore[arg-type]
        )
    )
    loaded = result.one()

    # Collect piece_ids for repertoire blocks so we can batch-fetch names
    piece_ids = set()
    for ts in loaded.sessions:
        for sec in ts.sections:
            for blk in sec.blocks:
                if blk.piece_id is not None:
                    piece_ids.add(blk.piece_id)

    piece_names: dict[int, str] = {}
    if piece_ids:
        result = await session.exec(
            select(Piece.id, Piece.name).where(Piece.id.in_(piece_ids))  # type: ignore[attr-defined]
        )
        piece_names = {r[0]: r[1] for r in result.all()}

    # Sort and compute estimated_duration_minutes per session
    session_reads = []
    for ts in sorted(loaded.sessions, key=lambda s: s.display_order):
        sorted_sections = sorted(ts.sections, key=lambda s: s.display_order)
        section_reads = []
        for sec in sorted_sections:
            sorted_blocks = sorted(sec.blocks, key=lambda b: b.display_order)
            block_reads = []
            for blk in sorted_blocks:
                br = BlockRead(
                    id=blk.id,
                    name=blk.name,
                    description=blk.description,
                    estimated_duration_minutes=blk.estimated_duration_minutes,
                    tempo_bpm=blk.tempo_bpm,
                    key=blk.key,
                    difficulty_level=blk.difficulty_level,
                    display_order=blk.display_order,
                    curated_block_id=blk.curated_block_id,
                    piece_id=blk.piece_id,
                )
                if blk.piece_id is not None:
                    br.piece_name = piece_names.get(blk.piece_id)
                    br.default_spots = sorted(
                        [
                            DefaultSpotRead(
                                id=tbs.spot.id,
                                name=tbs.spot.name,
                                location=tbs.spot.location,
                                display_order=tbs.display_order,
                            )
                            for tbs in blk.template_block_spots
                            if tbs.spot is not None
                        ],
                        key=lambda s: s.display_order,
                    )
                block_reads.append(br)

            section_reads.append({
                "id": sec.id,
                "name": sec.name,
                "section_type": sec.section_type,
                "estimated_duration_minutes": sec.estimated_duration_minutes,
                "display_order": sec.display_order,
                "blocks": block_reads,
            })

        estimated = sum(s.estimated_duration_minutes for s in sorted_sections)
        ts_read = TemplateSessionRead(
            id=ts.id,
            name=ts.name,
            focus_description=ts.focus_description,
            display_order=ts.display_order,
            estimated_duration_minutes=estimated,
            sections=section_reads,
        )
        session_reads.append(ts_read)

    return TemplateRead(
        id=loaded.id,
        instrument_id=loaded.instrument_id,
        name=loaded.name,
        description=loaded.description,
        is_active=loaded.is_active,
        current_rotation_index=loaded.current_rotation_index,
        sessions=session_reads,
    )


_DEFAULT_SECTIONS = [
    ("Warm-up", SectionType.warmup),
    ("Scales", SectionType.scales),
    ("Repertoire", SectionType.repertoire),
    ("Cool-down", SectionType.cooldown),
]


async def _get_or_create_settings(
    session: AsyncSession, user_id: int
) -> UserSettings:
    """Get user settings, auto-creating with defaults if missing."""
    result = await session.exec(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = result.first()
    if settings:
        return settings

    settings = UserSettings(user_id=user_id)
    session.add(settings)
    await session.flush()
    await session.refresh(settings)
    return settings


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/instruments/{instrument_id}/templates",
    response_model=List[TemplateListItem],
)
async def list_templates(
    instrument_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List templates for an instrument with per-plan aggregates.

    Eager-loads sessions → sections (durations only) so each row can report
    its session count and estimated total time without an N+1.
    """
    await _get_owned_instrument(session, instrument_id, current_user.id)

    result = await session.exec(
        select(Template)
        .where(
            Template.instrument_id == instrument_id,
            Template.user_id == current_user.id,
            Template.deleted_at == None,  # noqa: E711
        )
        .order_by(col(Template.created_at).desc())
        .options(
            selectinload(Template.sessions)  # type: ignore[arg-type]
            .selectinload(TemplateSession.sections)  # type: ignore[arg-type]
        )
    )
    templates = result.all()

    return [
        TemplateListItem(
            id=t.id,
            instrument_id=t.instrument_id,
            name=t.name,
            description=t.description,
            is_active=t.is_active,
            current_rotation_index=t.current_rotation_index,
            session_count=len(t.sessions),
            estimated_total_minutes=sum(
                (sec.estimated_duration_minutes or 0)
                for ts in t.sessions
                for sec in ts.sections
            ),
        )
        for t in templates
    ]


@router.post(
    "/instruments/{instrument_id}/templates",
    response_model=TemplateRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_template(
    instrument_id: int,
    body: TemplateCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a template with one auto-created session and default sections."""
    await _get_owned_instrument(session, instrument_id, current_user.id)

    # Deactivate current active template for this instrument (if any)
    result = await session.exec(
        select(Template).where(
            Template.instrument_id == instrument_id,
            Template.user_id == current_user.id,
            Template.is_active == True,  # noqa: E712
            Template.deleted_at == None,  # noqa: E711
        )
    )
    current_active = result.first()
    if current_active:
        current_active.is_active = False
        session.add(current_active)

    # Create template
    template = Template(
        user_id=current_user.id,
        instrument_id=instrument_id,
        name=body.name,
        description=body.description,
    )
    session.add(template)
    await session.flush()

    # Auto-create one session
    ts = TemplateSession(
        template_id=template.id,
        name="Session 1",
        display_order=0,
    )
    session.add(ts)
    await session.flush()

    # Auto-create default sections based on user settings
    user_settings = await _get_or_create_settings(session, current_user.id)
    total_minutes = user_settings.default_session_duration_minutes
    num_sections = len(_DEFAULT_SECTIONS)
    per_section = total_minutes // num_sections
    remainder = total_minutes % num_sections

    for i, (name, section_type) in enumerate(_DEFAULT_SECTIONS):
        duration = per_section + (1 if i < remainder else 0)
        section = Section(
            template_session_id=ts.id,
            name=name,
            section_type=section_type.value,
            estimated_duration_minutes=duration,
            display_order=i,
        )
        session.add(section)

    await session.commit()
    await session.refresh(template)
    return await _build_template_read(session, template)


@router.get("/templates/{template_id}", response_model=TemplateRead)
async def get_template(
    template_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get a template with full nested sessions → sections → blocks."""
    template = await _get_owned_template(session, template_id, current_user.id)
    return await _build_template_read(session, template)


@router.patch("/templates/{template_id}", response_model=TemplateRead)
async def update_template(
    template_id: int,
    body: TemplateUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update template metadata. Setting is_active=true deactivates the
    instrument's current active template first."""
    template = await _get_owned_template(session, template_id, current_user.id)

    update_data = body.model_dump(exclude_unset=True, mode="json")

    # Handle is_active toggle: deactivate current active template first
    if update_data.get("is_active") is True and not template.is_active:
        result = await session.exec(
            select(Template).where(
                Template.instrument_id == template.instrument_id,
                Template.user_id == current_user.id,
                Template.is_active == True,  # noqa: E712
                Template.deleted_at == None,  # noqa: E711
            )
        )
        current_active = result.first()
        if current_active:
            current_active.is_active = False
            session.add(current_active)

    for field, value in update_data.items():
        setattr(template, field, value)

    session.add(template)
    await session.commit()
    await session.refresh(template)
    return await _build_template_read(session, template)


@router.post(
    "/templates/{template_id}/duplicate",
    response_model=TemplateRead,
    status_code=status.HTTP_201_CREATED,
)
async def duplicate_template(
    template_id: int,
    body: DuplicateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Duplicate a template with all sessions, sections, and blocks.

    The new template is created as inactive. When copy_default_spots is true,
    repertoire blocks reference the same Piece and Spot entities (both
    templates contribute to the same spot histories). When false, repertoire
    blocks are created with empty default spot lists.
    """
    # Load the source template with full hierarchy
    result = await session.exec(
        select(Template)
        .where(
            Template.id == template_id,
            Template.user_id == current_user.id,
            Template.deleted_at == None,  # noqa: E711
        )
        .options(
            selectinload(Template.sessions)  # type: ignore[arg-type]
            .selectinload(TemplateSession.sections)  # type: ignore[arg-type]
            .selectinload(Section.blocks)  # type: ignore[arg-type]
            .selectinload(Block.template_block_spots)  # type: ignore[arg-type]
        )
    )
    source = result.first()
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )

    # Create the new template (inactive, rotation reset)
    new_template = Template(
        user_id=current_user.id,
        instrument_id=source.instrument_id,
        name=f"Copy of {source.name}"[:200],
        description=source.description,
        is_active=False,
        current_rotation_index=0,
    )
    session.add(new_template)
    await session.flush()

    # Deep-copy sessions → sections → blocks
    for src_ts in sorted(source.sessions, key=lambda s: s.display_order):
        new_ts = TemplateSession(
            template_id=new_template.id,
            name=src_ts.name,
            focus_description=src_ts.focus_description,
            display_order=src_ts.display_order,
        )
        session.add(new_ts)
        await session.flush()

        for src_sec in sorted(src_ts.sections, key=lambda s: s.display_order):
            new_sec = Section(
                template_session_id=new_ts.id,
                name=src_sec.name,
                section_type=src_sec.section_type,
                estimated_duration_minutes=src_sec.estimated_duration_minutes,
                display_order=src_sec.display_order,
            )
            session.add(new_sec)
            await session.flush()

            for src_blk in sorted(src_sec.blocks, key=lambda b: b.display_order):
                new_blk = Block(
                    section_id=new_sec.id,
                    curated_block_id=src_blk.curated_block_id,
                    piece_id=src_blk.piece_id,
                    name=src_blk.name,
                    description=src_blk.description,
                    estimated_duration_minutes=src_blk.estimated_duration_minutes,
                    tempo_bpm=src_blk.tempo_bpm,
                    key=src_blk.key,
                    difficulty_level=src_blk.difficulty_level,
                    display_order=src_blk.display_order,
                )
                session.add(new_blk)
                await session.flush()

                # Copy default spots for repertoire blocks
                if body.copy_default_spots and src_blk.piece_id is not None:
                    for tbs in sorted(
                        src_blk.template_block_spots,
                        key=lambda t: t.display_order,
                    ):
                        new_tbs = TemplateBlockSpot(
                            block_id=new_blk.id,
                            spot_id=tbs.spot_id,
                            display_order=tbs.display_order,
                        )
                        session.add(new_tbs)

    await session.commit()
    await session.refresh(new_template)
    return await _build_template_read(session, new_template)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a template."""
    template = await _get_owned_template(session, template_id, current_user.id)
    template.deleted_at = utcnow()
    session.add(template)
    await session.commit()
