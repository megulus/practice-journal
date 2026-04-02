"""Progress API — history and insights endpoints."""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_session
from app.models import (
    User,
    PracticeLog,
    SectionLog,
    BlockLog,
    TemplateSession,
)
from app.api.practice_api import _get_owned_log, _build_log_read
from app.schemas.practice import PracticeLogRead
from app.schemas.progress import HistoryItem, HistoryResponse
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
        .where(TemplateSession.id == template_session_id)
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
    period: str = Query(default="all"),
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

    if period == "week":
        query = query.where(PracticeLog.practice_date >= today - timedelta(days=7))
    elif period == "month":
        query = query.where(PracticeLog.practice_date >= today - timedelta(days=30))

    if cursor:
        decoded = decode_cursor(cursor)
        if decoded and "date" in decoded and "id" in decoded:
            from sqlalchemy import or_, and_
            from datetime import date as date_type
            cursor_date = date_type.fromisoformat(decoded["date"])
            cursor_id = decoded["id"]
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
