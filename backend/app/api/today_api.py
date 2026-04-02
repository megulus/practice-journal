"""Today tab API — surfaces which instruments are due and what to practice next."""
from datetime import date, datetime, timedelta, timezone
from typing import Optional, Union

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_session
from app.models import (
    User,
    Instrument,
    Template,
    TemplateSession,
    Section,
    PracticeLog,
)
from app.api.ownership import get_owned_instrument
from app.schemas.today import (
    TodayResponse,
    ActiveSessionInfo,
    InstrumentBrief,
    CurrentSessionInfo,
    InstrumentDue,
    InstrumentNotDue,
    RepeatSessionInfo,
    SessionBrief,
)

router = APIRouter(prefix="/today", tags=["today"])

# ---------------------------------------------------------------------------
# Due-logic thresholds (days since last practice)
# ---------------------------------------------------------------------------
_DUE_THRESHOLDS = {
    "daily": 0,
    "few_times_a_week": 2,
    "weekly": 5,
}


def _is_due(frequency: str, days_since_last: Optional[int]) -> bool:
    """Return True if the instrument is due for practice."""
    if frequency == "occasionally":
        return False
    threshold = _DUE_THRESHOLDS.get(frequency)
    if threshold is None:
        return False
    # Never practiced → due (except occasionally, handled above)
    if days_since_last is None:
        return True
    return days_since_last >= threshold


def _next_due_description(frequency: str, days_since_last: Optional[int]) -> Optional[str]:
    """Human-readable string for when an instrument is next due."""
    if frequency == "occasionally":
        return "practice when you feel like it"
    threshold = _DUE_THRESHOLDS.get(frequency)
    if threshold is None or days_since_last is None:
        return None
    days_remaining = threshold - days_since_last
    if days_remaining <= 0:
        return "due today"
    if days_remaining == 1:
        return "due tomorrow"
    return f"due in {days_remaining} days"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_active_session(
    session: AsyncSession,
    user_id: int,
    instrument_id: Optional[int] = None,
) -> Optional[ActiveSessionInfo]:
    """Find any in-progress PracticeLog for the user.

    When instrument_id is provided, scopes to that instrument only.
    """
    query = (
        select(PracticeLog)
        .where(
            PracticeLog.user_id == user_id,
            PracticeLog.status == "in_progress",
            PracticeLog.deleted_at == None,  # noqa: E711
        )
        .options(
            selectinload(PracticeLog.instrument),
            selectinload(PracticeLog.template_session),
        )
        .order_by(PracticeLog.created_at.desc())
        .limit(1)
    )
    if instrument_id is not None:
        query = query.where(PracticeLog.instrument_id == instrument_id)
    result = await session.exec(query)
    log = result.first()
    if not log:
        return None
    return ActiveSessionInfo(
        practice_log_id=log.id,
        instrument_id=log.instrument_id,
        instrument_name=log.instrument.name,
        session_name=log.template_session.name if log.template_session else None,
        started_at=log.created_at,
    )


async def _build_current_session(
    session: AsyncSession, template: Template, template_sessions: list[TemplateSession]
) -> Optional[CurrentSessionInfo]:
    """Build CurrentSessionInfo from the active template's current rotation."""
    if not template_sessions:
        return None

    idx = template.current_rotation_index % len(template_sessions)
    current_ts = template_sessions[idx]

    # Load sections for estimated duration and section types
    result = await session.exec(
        select(Section)
        .where(Section.template_session_id == current_ts.id)
        .order_by(Section.display_order)
    )
    sections = result.all()

    estimated_duration = sum(s.estimated_duration_minutes for s in sections) or None
    section_types = list(dict.fromkeys(s.section_type for s in sections))

    return CurrentSessionInfo(
        template_id=template.id,
        template_name=template.name,
        session_id=current_ts.id,
        session_name=current_ts.name,
        focus_description=current_ts.focus_description,
        rotation_position=f"session {idx + 1} of {len(template_sessions)}",
        estimated_duration_minutes=estimated_duration,
        section_types=section_types,
    )


async def _build_repeat_session(
    session: AsyncSession,
    instrument_id: int,
    user_id: int,
    current_session_id: Optional[int],
    template_sessions: list[TemplateSession],
) -> Optional[RepeatSessionInfo]:
    """Find the most recent completed session for repeat shortcut."""
    result = await session.exec(
        select(PracticeLog)
        .where(
            PracticeLog.user_id == user_id,
            PracticeLog.instrument_id == instrument_id,
            PracticeLog.status == "completed",
            PracticeLog.template_session_id != None,  # noqa: E711
            PracticeLog.deleted_at == None,  # noqa: E711
        )
        .order_by(PracticeLog.created_at.desc())
        .limit(1)
    )
    log = result.first()
    if not log:
        return None
    # Don't show repeat when it's the same as current
    if log.template_session_id == current_session_id:
        return None

    # Look up the session name from the already-loaded list
    ts = next((s for s in template_sessions if s.id == log.template_session_id), None)
    if not ts:
        return None

    return RepeatSessionInfo(
        session_id=ts.id,
        session_name=ts.name,
    )


async def _build_instrument_entry(
    session: AsyncSession,
    instrument: Instrument,
    user_id: int,
    today: date,
) -> Union[InstrumentDue, InstrumentNotDue]:
    """Build a due/not-due entry for a single instrument.

    N+1: runs 1-5 queries per instrument (last_practiced, template, sessions,
    sections, repeat log). Fine for typical usage (1-5 instruments per user).
    """
    # Last practiced date
    result = await session.exec(
        select(func.max(PracticeLog.practice_date)).where(
            PracticeLog.instrument_id == instrument.id,
            PracticeLog.user_id == user_id,
            PracticeLog.status == "completed",
            PracticeLog.deleted_at == None,  # noqa: E711
        )
    )
    last_practiced_at = result.one()

    days_since_last = (today - last_practiced_at).days if last_practiced_at else None

    brief = InstrumentBrief(
        id=instrument.id,
        name=instrument.name,
        practice_frequency=instrument.practice_frequency,
    )

    due = _is_due(instrument.practice_frequency, days_since_last)

    if not due:
        return InstrumentNotDue(
            instrument=brief,
            last_practiced_at=last_practiced_at,
            days_since_last=days_since_last,
            next_due_description=_next_due_description(
                instrument.practice_frequency, days_since_last
            ),
        )

    # Load active template and its sessions
    tmpl_result = await session.exec(
        select(Template).where(
            Template.instrument_id == instrument.id,
            Template.user_id == user_id,
            Template.is_active == True,  # noqa: E712
            Template.deleted_at == None,  # noqa: E711
        )
    )
    template = tmpl_result.first()

    current_session = None
    repeat_session = None
    all_sessions: list[SessionBrief] = []

    if template:
        # Load all sessions ordered by display_order
        ts_result = await session.exec(
            select(TemplateSession)
            .where(TemplateSession.template_id == template.id)
            .order_by(TemplateSession.display_order)
        )
        template_sessions = list(ts_result.all())

        current_session = await _build_current_session(
            session, template, template_sessions
        )

        current_session_id = current_session.session_id if current_session else None
        repeat_session = await _build_repeat_session(
            session, instrument.id, user_id, current_session_id, template_sessions
        )

        all_sessions = [
            SessionBrief(
                session_id=ts.id,
                session_name=ts.name,
                display_order=ts.display_order,
            )
            for ts in template_sessions
        ]

    return InstrumentDue(
        instrument=brief,
        last_practiced_at=last_practiced_at,
        days_since_last=days_since_last,
        current_session=current_session,
        repeat_session=repeat_session,
        all_sessions=all_sessions,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=TodayResponse)
async def get_today(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Today context for all user instruments."""
    today = datetime.now(timezone.utc).date()

    active_session = await _get_active_session(session, current_user.id)

    # Fetch all non-deleted instruments
    result = await session.exec(
        select(Instrument).where(
            Instrument.user_id == current_user.id,
            Instrument.deleted_at == None,  # noqa: E711
        )
        .order_by(Instrument.display_order, Instrument.id)
    )
    instruments = result.all()

    instruments_due = []
    instruments_not_due = []

    for instrument in instruments:
        entry = await _build_instrument_entry(
            session, instrument, current_user.id, today
        )
        if isinstance(entry, InstrumentDue):
            instruments_due.append(entry)
        else:
            instruments_not_due.append(entry)

    return TodayResponse(
        active_session=active_session,
        instruments_due=instruments_due,
        instruments_not_due=instruments_not_due,
    )


@router.get("/{instrument_id}", response_model=TodayResponse)
async def get_today_instrument(
    instrument_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Today context scoped to a single instrument."""
    instrument = await get_owned_instrument(session, instrument_id, current_user.id)
    today = datetime.now(timezone.utc).date()

    active_session = await _get_active_session(
        session, current_user.id, instrument_id=instrument.id
    )

    entry = await _build_instrument_entry(
        session, instrument, current_user.id, today
    )

    instruments_due = []
    instruments_not_due = []
    if isinstance(entry, InstrumentDue):
        instruments_due.append(entry)
    else:
        instruments_not_due.append(entry)

    return TodayResponse(
        active_session=active_session,
        instruments_due=instruments_due,
        instruments_not_due=instruments_not_due,
    )
