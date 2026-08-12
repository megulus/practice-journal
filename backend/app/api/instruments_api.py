"""
Instruments API — CRUD for user-owned instruments.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select, func, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import get_session
from app.models import User, Instrument, Piece, Template, PracticeLog
from app.auth import get_current_user
from app.enums import utcnow
from app.schemas.instrument import InstrumentCreate, InstrumentRead, InstrumentUpdate
from app.services.instrument_category import (
    CANONICAL_INSTRUMENT_CATEGORIES,
    derive_instrument_category,
)

router = APIRouter(prefix="/instruments", tags=["instruments"])


async def _enrich_instrument(
    session: AsyncSession, instrument: Instrument
) -> InstrumentRead:
    """Build InstrumentRead with computed fields."""
    # Active template count
    result = await session.exec(
        select(func.count(Template.id)).where(
            Template.instrument_id == instrument.id,
            Template.is_active == True,  # noqa: E712
            Template.deleted_at == None,  # noqa: E711
        )
    )
    active_template_count = result.one()

    # Every live template, archived ones included. This is the set
    # delete_instrument actually cascades to — it filters on deleted_at alone,
    # not is_active — so a delete-confirm that counted only the active ones
    # would under-report. Keep the two counts distinct; they answer different
    # questions ("how much is in rotation" vs. "how much a delete takes").
    result = await session.exec(
        select(func.count(Template.id)).where(
            Template.instrument_id == instrument.id,
            Template.deleted_at == None,  # noqa: E711
        )
    )
    template_count = result.one()

    # Repertoire size (pieces in the instrument's library)
    result = await session.exec(
        select(func.count(Piece.id)).where(
            Piece.instrument_id == instrument.id,
            Piece.deleted_at == None,  # noqa: E711
        )
    )
    piece_count = result.one()

    # Last practiced date
    result = await session.exec(
        select(func.max(PracticeLog.practice_date)).where(
            PracticeLog.instrument_id == instrument.id,
            PracticeLog.status == "completed",
            PracticeLog.deleted_at == None,  # noqa: E711
        )
    )
    last_practiced_at = result.one()

    return InstrumentRead(
        id=instrument.id,
        name=instrument.name,
        instrument_category=instrument.instrument_category,
        practice_frequency=instrument.practice_frequency,
        display_order=instrument.display_order,
        active_template_count=active_template_count,
        template_count=template_count,
        piece_count=piece_count,
        last_practiced_at=last_practiced_at,
    )


from app.api.ownership import get_owned_instrument as _get_owned_instrument


@router.get("", response_model=List[InstrumentRead])
async def list_instruments(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List user's active instruments, ordered by display_order."""
    result = await session.exec(
        select(Instrument)
        .where(
            Instrument.user_id == current_user.id,
            Instrument.deleted_at == None,  # noqa: E711
        )
        .order_by(Instrument.display_order, Instrument.id)
    )
    instruments = result.all()
    # N+1: 3 queries per instrument for computed fields. Fine for typical
    # usage (1-5 instruments per user); optimize with subqueries if needed.
    return [await _enrich_instrument(session, i) for i in instruments]


@router.post("", response_model=InstrumentRead, status_code=status.HTTP_201_CREATED)
async def create_instrument(
    body: InstrumentCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new instrument for the current user.

    `instrument_category` is derived from the name unless the client sends one
    explicitly.
    """
    instrument = Instrument(
        user_id=current_user.id,
        name=body.name,
        instrument_category=body.instrument_category,
        practice_frequency=body.practice_frequency.value,
    )
    session.add(instrument)
    await session.commit()
    await session.refresh(instrument)
    return await _enrich_instrument(session, instrument)


@router.patch("/{instrument_id}", response_model=InstrumentRead)
async def update_instrument(
    instrument_id: int,
    body: InstrumentUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update an instrument's name, practice_frequency, display_order, or
    instrument_category.

    Omitting `instrument_category` lets it follow a rename (see below); sending
    one sets it verbatim.
    """
    instrument = await _get_owned_instrument(session, instrument_id, current_user.id)

    # Every updatable column is NOT NULL, so an explicit null means "leave it
    # alone" rather than a write that would fail at the DB.
    update_data = {
        field: value
        for field, value in body.model_dump(exclude_unset=True, mode="json").items()
        if value is not None
    }
    for field, value in update_data.items():
        setattr(instrument, field, value)

    # Keep the category in step with a rename without losing a good one to a
    # decorated name. A new name that resolves to a canonical category wins
    # ("Violin" → "Cello" becomes cello; "Violn" → "Violin" recovers violin);
    # otherwise an existing canonical category is kept ("Violin" → "Stage
    # Strad" stays violin) and a fallback category tracks the name.
    if "name" in update_data and "instrument_category" not in update_data:
        derived = derive_instrument_category(instrument.name)
        if (
            derived in CANONICAL_INSTRUMENT_CATEGORIES
            or instrument.instrument_category not in CANONICAL_INSTRUMENT_CATEGORIES
        ):
            instrument.instrument_category = derived

    session.add(instrument)
    await session.commit()
    await session.refresh(instrument)
    return await _enrich_instrument(session, instrument)


@router.delete("/{instrument_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_instrument(
    instrument_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete an instrument and cascade to templates + in-progress sessions."""
    instrument = await _get_owned_instrument(session, instrument_id, current_user.id)

    now = utcnow()

    # Soft-delete the instrument
    instrument.deleted_at = now
    session.add(instrument)

    # Cascade: soft-delete all templates for this instrument
    result = await session.exec(
        select(Template).where(
            Template.instrument_id == instrument.id,
            Template.deleted_at == None,  # noqa: E711
        )
    )
    for template in result.all():
        template.deleted_at = now
        session.add(template)

    # Cascade: abandon any in-progress sessions for this instrument
    result = await session.exec(
        select(PracticeLog).where(
            PracticeLog.instrument_id == instrument.id,
            PracticeLog.status == "in_progress",
        )
    )
    for log in result.all():
        log.status = "abandoned"
        session.add(log)

    await session.commit()
