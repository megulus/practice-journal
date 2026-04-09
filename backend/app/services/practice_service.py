"""
Practice session lifecycle service functions.

Extracted from route handlers to keep endpoint code thin and
sub-operations independently testable.
"""
import random
from datetime import datetime, timezone, timedelta

from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import PracticeLog
from app.enums import SessionStatus
from app.schemas.practice import (
    RatingsSummary,
    SessionSummary,
)


# ---------------------------------------------------------------------------
# Reflection prompt pool (11 prompts from product spec §5.3)
# ---------------------------------------------------------------------------

REFLECTION_PROMPTS = [
    # Progress-oriented
    "What felt different today?",
    "What was easier than you expected?",
    "Did anything click that hadn't before?",
    # Forward-looking
    "What do you want to focus on next time?",
    "If you had 10 more minutes, what would you spend them on?",
    # Awareness-building
    "What did you notice about your playing today?",
    "Where did your attention go during the session?",
    "Was there a moment you want to remember?",
    # Honest check-in
    "What was the hardest part of today's session?",
    "Did anything surprise you?",
    "How does your body feel after playing?",
]


async def select_reflection_prompt(
    session: AsyncSession, user_id: int
) -> str:
    """Pick a reflection prompt, excluding the last 3 shown to this user."""
    result = await session.exec(
        select(PracticeLog.reflection_prompt)
        .where(
            PracticeLog.user_id == user_id,
            PracticeLog.status == SessionStatus.completed.value,
            PracticeLog.reflection_prompt != None,  # noqa: E711
            PracticeLog.deleted_at == None,  # noqa: E711
        )
        .order_by(col(PracticeLog.created_at).desc())
        .limit(3)
    )
    recent = set(result.all())

    candidates = [p for p in REFLECTION_PROMPTS if p not in recent]
    if not candidates:
        candidates = REFLECTION_PROMPTS
    return random.choice(candidates)


async def calculate_day_streak(
    session: AsyncSession, user_id: int
) -> int:
    """Count consecutive days the user has completed a practice session.

    Walks backward from today. If today has a session, it counts.
    If not but yesterday does, start from yesterday.
    """
    today = datetime.now(timezone.utc).date()

    cutoff = today - timedelta(days=90)
    result = await session.exec(
        select(PracticeLog.practice_date)
        .where(
            PracticeLog.user_id == user_id,
            PracticeLog.status == SessionStatus.completed.value,
            PracticeLog.deleted_at == None,  # noqa: E711
            PracticeLog.practice_date >= cutoff,
        )
        .distinct()
        .order_by(col(PracticeLog.practice_date).desc())
    )
    dates = result.all()

    if not dates:
        return 0

    date_set = set(dates)

    # Start from today or yesterday
    if today in date_set:
        check = today
    elif (today - timedelta(days=1)) in date_set:
        check = today - timedelta(days=1)
    else:
        return 0

    streak = 0
    while check in date_set:
        streak += 1
        check -= timedelta(days=1)

    return streak


def compute_session_summary(
    section_logs: list,
    day_streak: int,
) -> SessionSummary:
    """Build summary stats from loaded section/block logs."""
    total_duration = sum(sl.actual_duration_minutes for sl in section_logs)

    all_blocks = []
    for sl in section_logs:
        all_blocks.extend(sl.block_logs)

    exercises_total = len(all_blocks)
    exercises_completed = sum(1 for bl in all_blocks if bl.completed)

    step_forward = 0
    steady = 0
    step_back = 0
    skipped = 0
    for bl in all_blocks:
        if not bl.completed:
            skipped += 1
        elif bl.rating == 1:
            step_forward += 1
        elif bl.rating == 0:
            steady += 1
        elif bl.rating == -1:
            step_back += 1
        else:
            # completed but no rating
            steady += 1

    return SessionSummary(
        total_duration_minutes=total_duration,
        exercises_completed=exercises_completed,
        exercises_total=exercises_total,
        day_streak=day_streak,
        ratings=RatingsSummary(
            step_forward=step_forward,
            steady=steady,
            step_back=step_back,
            skipped=skipped,
        ),
    )
