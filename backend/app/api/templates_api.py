"""
Templates API — CRUD for practice templates within instruments.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models import User, Instrument, Template, TemplateSession, Section, UserSettings
from app.auth import get_current_user
from app.enums import SectionType, utcnow
from app.schemas.template import (
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

async def _get_owned_instrument(
    session: AsyncSession, instrument_id: int, user_id: int
) -> Instrument:
    """Fetch an instrument, verifying ownership and not deleted."""
    result = await session.exec(
        select(Instrument).where(
            Instrument.id == instrument_id,
            Instrument.user_id == user_id,
            Instrument.deleted_at == None,  # noqa: E711
        )
    )
    instrument = result.first()
    if not instrument:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instrument not found",
        )
    return instrument


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


async def _build_template_read(
    session: AsyncSession, template: Template
) -> TemplateRead:
    """Load a template with full nested sessions → sections → blocks
    and compute estimated_duration_minutes on each session."""
    result = await session.exec(
        select(Template)
        .where(Template.id == template.id)
        .options(
            selectinload(Template.sessions)  # type: ignore[arg-type]
            .selectinload(TemplateSession.sections)  # type: ignore[arg-type]
            .selectinload(Section.blocks)  # type: ignore[arg-type]
        )
    )
    loaded = result.one()

    # Sort and compute estimated_duration_minutes per session
    session_reads = []
    for ts in sorted(loaded.sessions, key=lambda s: s.display_order):
        sorted_sections = sorted(ts.sections, key=lambda s: s.display_order)
        for sec in sorted_sections:
            sec.blocks = sorted(sec.blocks, key=lambda b: b.display_order)

        estimated = sum(s.estimated_duration_minutes for s in sorted_sections)
        ts_read = TemplateSessionRead(
            id=ts.id,
            name=ts.name,
            focus_description=ts.focus_description,
            display_order=ts.display_order,
            estimated_duration_minutes=estimated,
            sections=sorted_sections,
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
    await session.commit()
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
    """List templates for an instrument (lightweight, no nested sessions)."""
    await _get_owned_instrument(session, instrument_id, current_user.id)

    result = await session.exec(
        select(Template)
        .where(
            Template.instrument_id == instrument_id,
            Template.user_id == current_user.id,
            Template.deleted_at == None,  # noqa: E711
        )
        .order_by(col(Template.created_at).desc())
    )
    return result.all()


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

    for i, (name, section_type) in enumerate(_DEFAULT_SECTIONS):
        section = Section(
            template_session_id=ts.id,
            name=name,
            section_type=section_type.value,
            estimated_duration_minutes=per_section,
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

    update_data = body.model_dump(exclude_unset=True)

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
