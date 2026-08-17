"""Progress API — history and insights endpoints."""
from datetime import date as date_type, datetime, timedelta, timezone
from enum import Enum
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_session
from app.models import (
    User,
    UserSettings,
    PracticeLog,
    SectionLog,
    BlockLog,
    TemplateSession,
)
from app.api.ownership import get_owned_instrument
from app.api.practice_api import _get_owned_log, _build_log_read
from app.api.settings_api import _get_or_create_settings
from app.schemas.practice import PracticeLogRead
from app.schemas.progress import (
    HistoryItem, HistoryResponse,
    HeatmapDay, HeatmapResponse,
    DailyBreakdown, WeekSummary, ComparisonResponse,
    WeekRatings, RatingsResponse,
)
from app.utils.pagination import encode_cursor, decode_cursor

router = APIRouter(prefix="/progress", tags=["progress"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _compute_rotation_label(
    session: AsyncSession,
    template_id: Optional[int],
    template_session_id: Optional[int],
) -> Optional[str]:
    """Compute 'session X of Y' label from template session position."""
    if not template_id or not template_session_id:
        return None

    # Get the session's display_order and total count in one pass
    result = await session.exec(
        select(TemplateSession.display_order)
        .where(
            TemplateSession.id == template_session_id,
            TemplateSession.template_id == template_id,
        )
    )
    display_order = result.first()
    if display_order is None:
        return None

    count_result = await session.exec(
        select(func.count(TemplateSession.id))
        .where(TemplateSession.template_id == template_id)
    )
    total = count_result.one()

    return f"session {display_order + 1} of {total}"


_WEEKDAY_NAMES = [
    "monday", "tuesday", "wednesday", "thursday",
    "friday", "saturday", "sunday",
]


def _week_start_date(d: date_type, week_starts_on: str) -> date_type:
    """Get the start of the week containing d."""
    if week_starts_on == "sunday":
        return d - timedelta(days=(d.weekday() + 1) % 7)
    return d - timedelta(days=d.weekday())


def _build_week_summary_from_rows(
    rows: list[tuple],
    week_start: date_type,
) -> WeekSummary:
    """Build a WeekSummary from (practice_date, duration) rows."""
    daily_minutes: dict[str, int] = {day: 0 for day in _WEEKDAY_NAMES}
    for practice_date, duration in rows:
        if week_start <= practice_date < week_start + timedelta(days=7):
            day_name = _WEEKDAY_NAMES[practice_date.weekday()]
            daily_minutes[day_name] += duration

    daily = [DailyBreakdown(day=d, minutes=m) for d, m in daily_minutes.items()]
    days_practiced = sum(1 for m in daily_minutes.values() if m > 0)
    total_minutes = sum(daily_minutes.values())

    return WeekSummary(
        days_practiced=days_practiced,
        total_minutes=total_minutes,
        daily=daily,
    )


def _build_history_item(
    log: PracticeLog,
    rotation_label: Optional[str],
) -> HistoryItem:
    """Build a collapsed history card from a loaded PracticeLog."""
    exercise_count = sum(
        len(sl.block_logs) for sl in log.section_logs
    )
    return HistoryItem(
        id=log.id,
        practice_date=log.practice_date,
        instrument_name=log.instrument.name if log.instrument else "",
        session_name=(
            log.template_session.name if log.template_session else None
        ),
        template_name=log.template.name if log.template else None,
        rotation_label=rotation_label,
        total_duration_minutes=log.total_duration_minutes,
        exercise_count=exercise_count,
        is_freeform=log.template_id is None,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/history", response_model=HistoryResponse)
async def list_history(
    instrument_id: Optional[int] = Query(default=None),
    period: Literal["all", "last_7_days", "last_30_days"] = Query(default="all"),
    cursor: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Paginated session history (completed sessions only)."""
    today = datetime.now(timezone.utc).date()

    query = (
        select(PracticeLog)
        .where(
            PracticeLog.user_id == current_user.id,
            PracticeLog.status == "completed",
            PracticeLog.deleted_at == None,  # noqa: E711
        )
        .options(
            selectinload(PracticeLog.instrument),  # type: ignore[arg-type]
            selectinload(PracticeLog.template),  # type: ignore[arg-type]
            selectinload(PracticeLog.template_session),  # type: ignore[arg-type]
            selectinload(PracticeLog.section_logs)  # type: ignore[arg-type]
            .selectinload(SectionLog.block_logs),  # type: ignore[arg-type]
        )
    )

    if instrument_id is not None:
        query = query.where(PracticeLog.instrument_id == instrument_id)

    # Rolling windows ending today, deliberately *not* calendar-aligned and not
    # affected by the user's `week_starts_on` (#272). History answers "show me
    # recent sessions", which is a recency question — a calendar week would make
    # Monday morning show an almost-empty list. The calendar definition lives in
    # Insights, where "this week vs. last" needs fixed boundaries. The `-6`/`-29`
    # offsets make the windows exactly 7 and 30 days *inclusive of today*.
    if period == "last_7_days":
        query = query.where(PracticeLog.practice_date >= today - timedelta(days=6))
    elif period == "last_30_days":
        query = query.where(PracticeLog.practice_date >= today - timedelta(days=29))

    if cursor:
        decoded = decode_cursor(cursor)
        if not decoded or "date" not in decoded or "id" not in decoded:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid cursor",
            )
        try:
            cursor_date = date_type.fromisoformat(decoded["date"])
            cursor_id = int(decoded["id"])
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid cursor",
            )
        # Composite cursor: (practice_date, id) < (cursor_date, cursor_id)
        query = query.where(
            or_(
                PracticeLog.practice_date < cursor_date,
                and_(
                    PracticeLog.practice_date == cursor_date,
                    PracticeLog.id < cursor_id,
                ),
            )
        )

    query = query.order_by(
        col(PracticeLog.practice_date).desc(),
        col(PracticeLog.id).desc(),
    ).limit(limit + 1)

    result = await session.exec(query)
    logs = list(result.all())

    # Detect next page
    next_cursor = None
    if len(logs) > limit:
        logs = logs[:limit]
        last = logs[-1]
        next_cursor = encode_cursor({
            "date": last.practice_date.isoformat(),
            "id": last.id,
        })

    # Build items with rotation labels
    # N+1: 2 queries per templated log for rotation_label. Acceptable for
    # page sizes up to 20; batch if this becomes a bottleneck.
    items = []
    for log in logs:
        rotation_label = await _compute_rotation_label(
            session, log.template_id, log.template_session_id
        )
        items.append(_build_history_item(log, rotation_label))

    return HistoryResponse(items=items, next_cursor=next_cursor)


@router.get("/history/{log_id}", response_model=PracticeLogRead)
async def get_history_detail(
    log_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Full session detail for a completed practice log."""
    log = await _get_owned_log(session, log_id, current_user.id)
    if log.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Practice log not found",
        )
    return await _build_log_read(session, log)


# ---------------------------------------------------------------------------
# Insights endpoints
# ---------------------------------------------------------------------------

@router.get("/insights/heatmap", response_model=HeatmapResponse)
async def get_heatmap(
    instrument_id: Optional[int] = Query(default=None),
    year: Optional[int] = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Practice calendar heatmap data."""
    if instrument_id is not None:
        await get_owned_instrument(session, instrument_id, current_user.id)
    if year is None:
        year = datetime.now(timezone.utc).year

    query = (
        select(
            PracticeLog.practice_date,
            func.sum(PracticeLog.total_duration_minutes).label("duration"),
        )
        .where(
            PracticeLog.user_id == current_user.id,
            PracticeLog.status == "completed",
            PracticeLog.deleted_at == None,  # noqa: E711
            func.extract("year", PracticeLog.practice_date) == year,
        )
        .group_by(PracticeLog.practice_date)
        .order_by(PracticeLog.practice_date)
    )

    if instrument_id is not None:
        query = query.where(PracticeLog.instrument_id == instrument_id)

    result = await session.exec(query)
    rows = result.all()

    days = [
        HeatmapDay(date=row[0], duration_minutes=row[1])
        for row in rows
    ]

    return HeatmapResponse(year=year, days=days)


@router.get("/insights/comparison", response_model=ComparisonResponse)
async def get_comparison(
    instrument_id: Optional[int] = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """This week vs. last week comparison."""
    if instrument_id is not None:
        await get_owned_instrument(session, instrument_id, current_user.id)
    today = datetime.now(timezone.utc).date()
    settings = await _get_or_create_settings(session, current_user.id)
    week_starts_on = settings.week_starts_on

    this_week_start = _week_start_date(today, week_starts_on)
    last_week_start = this_week_start - timedelta(days=7)

    query = (
        select(
            PracticeLog.practice_date,
            PracticeLog.total_duration_minutes,
        )
        .where(
            PracticeLog.user_id == current_user.id,
            PracticeLog.status == "completed",
            PracticeLog.deleted_at == None,  # noqa: E711
            PracticeLog.practice_date >= last_week_start,
            PracticeLog.practice_date < this_week_start + timedelta(days=7),
        )
    )

    if instrument_id is not None:
        query = query.where(PracticeLog.instrument_id == instrument_id)

    result = await session.exec(query)
    rows = result.all()

    this_week = _build_week_summary_from_rows(rows, this_week_start)
    last_week = _build_week_summary_from_rows(rows, last_week_start)

    return ComparisonResponse(
        this_week=this_week,
        last_week=last_week,
        delta_days=this_week.days_practiced - last_week.days_practiced,
        delta_minutes=this_week.total_minutes - last_week.total_minutes,
    )


@router.get("/insights/ratings", response_model=RatingsResponse)
async def get_ratings(
    instrument_id: int = Query(),
    weeks: int = Query(default=4, ge=1, le=52),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Rating trend over recent weeks."""
    await get_owned_instrument(session, instrument_id, current_user.id)
    today = datetime.now(timezone.utc).date()
    settings = await _get_or_create_settings(session, current_user.id)
    week_starts_on = settings.week_starts_on

    this_week_start = _week_start_date(today, week_starts_on)
    earliest_start = this_week_start - timedelta(days=7 * (weeks - 1))

    result = await session.exec(
        select(
            PracticeLog.practice_date,
            BlockLog.rating,
        )
        .join(SectionLog, PracticeLog.id == SectionLog.practice_log_id)
        .join(BlockLog, SectionLog.id == BlockLog.section_log_id)
        .where(
            PracticeLog.user_id == current_user.id,
            PracticeLog.instrument_id == instrument_id,
            PracticeLog.status == "completed",
            PracticeLog.deleted_at == None,  # noqa: E711
            BlockLog.rating != None,  # noqa: E711
            PracticeLog.practice_date >= earliest_start,
        )
    )
    rows = result.all()

    # Group ratings by week
    week_data: dict[date_type, dict[str, int]] = {}
    for practice_date, rating in rows:
        ws = _week_start_date(practice_date, week_starts_on)
        if ws not in week_data:
            week_data[ws] = {"step_back": 0, "steady": 0, "step_forward": 0}
        if rating == -1:
            week_data[ws]["step_back"] += 1
        elif rating == 0:
            week_data[ws]["steady"] += 1
        elif rating == 1:
            week_data[ws]["step_forward"] += 1

    # Build response for all requested weeks (include empty weeks)
    week_ratings = []
    for i in range(weeks):
        ws = this_week_start - timedelta(days=7 * i)
        data = week_data.get(ws, {"step_back": 0, "steady": 0, "step_forward": 0})
        total = data["step_back"] + data["steady"] + data["step_forward"]
        week_ratings.append(WeekRatings(
            week_start=ws,
            step_back=data["step_back"],
            steady=data["steady"],
            step_forward=data["step_forward"],
            total=total,
        ))

    return RatingsResponse(weeks=week_ratings)
