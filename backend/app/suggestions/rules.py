"""
Suggestion rule implementations.

Each rule is an async function that takes a RuleContext and returns either
a Suggestion or None. Rules query the database directly. The engine
handles dismissal filtering, opt-out preferences, and selection.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlmodel import select, func, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import (
    Instrument, Template, TemplateSession, Section, Block,
    Piece, Spot, PracticeLog, SectionLog, BlockLog,
)
from app.enums import SuggestionTier, PracticeFrequency, SessionStatus
from app.suggestions.base import RuleContext, Suggestion


# ===================================================================
# Pre-session rules
# ===================================================================

# Map practice_frequency to the "due" threshold in days. Beyond this many
# days since last practice, the consistency_nudge fires.
_FREQUENCY_THRESHOLDS = {
    PracticeFrequency.daily.value: 2,
    PracticeFrequency.few_times_a_week.value: 3,
    PracticeFrequency.weekly.value: 8,
    PracticeFrequency.occasionally.value: 30,
}


async def consistency_nudge(ctx: RuleContext) -> Optional[Suggestion]:
    """Fires when days since last practice exceeds the instrument's threshold."""
    if ctx.instrument_id is None:
        return None

    inst_result = await ctx.session.exec(
        select(Instrument.practice_frequency).where(
            Instrument.id == ctx.instrument_id
        )
    )
    freq = inst_result.first() or PracticeFrequency.few_times_a_week.value
    threshold = _FREQUENCY_THRESHOLDS.get(freq, 3)

    last_result = await ctx.session.exec(
        select(func.max(PracticeLog.practice_date)).where(
            PracticeLog.user_id == ctx.user_id,
            PracticeLog.instrument_id == ctx.instrument_id,
            PracticeLog.status == SessionStatus.completed.value,
            PracticeLog.deleted_at == None,  # noqa: E711
        )
    )
    last_date = last_result.first()
    if last_date is None:
        return None

    today = datetime.now(timezone.utc).date()
    days_since = (today - last_date).days

    if days_since < threshold:
        return None

    text = (
        f"It's been {days_since} days since you last practiced — "
        f"even a short session counts."
    )
    return Suggestion(
        rule_id="consistency_nudge",
        tier=SuggestionTier.pre_session,
        text=text,
    )


async def section_coverage_drop(ctx: RuleContext) -> Optional[Suggestion]:
    """Fires when a section type that was practiced regularly has dropped off.

    Compares the last 14 days against the prior 14 days for this instrument.
    Surfaces the first section type that appeared in the older window but
    not in the recent one.
    """
    if ctx.instrument_id is None:
        return None

    today = datetime.now(timezone.utc).date()
    recent_start = today - timedelta(days=14)
    older_start = today - timedelta(days=28)

    # Section types in the most recent 14 days
    recent_result = await ctx.session.exec(
        select(SectionLog.section_type)
        .join(PracticeLog, SectionLog.practice_log_id == PracticeLog.id)
        .where(
            PracticeLog.user_id == ctx.user_id,
            PracticeLog.instrument_id == ctx.instrument_id,
            PracticeLog.status == SessionStatus.completed.value,
            PracticeLog.deleted_at == None,  # noqa: E711
            PracticeLog.practice_date >= recent_start,
            PracticeLog.practice_date <= today,
        )
        .distinct()
    )
    recent = set(recent_result.all())

    # Section types in the prior 14 days
    older_result = await ctx.session.exec(
        select(SectionLog.section_type)
        .join(PracticeLog, SectionLog.practice_log_id == PracticeLog.id)
        .where(
            PracticeLog.user_id == ctx.user_id,
            PracticeLog.instrument_id == ctx.instrument_id,
            PracticeLog.status == SessionStatus.completed.value,
            PracticeLog.deleted_at == None,  # noqa: E711
            PracticeLog.practice_date >= older_start,
            PracticeLog.practice_date < recent_start,
        )
        .distinct()
    )
    older = set(older_result.all())

    dropped = sorted(older - recent)
    if not dropped:
        return None

    section = dropped[0]
    text = (
        f"Your {section.replace('_', ' ')} coverage has dropped off — "
        f"consider adding a {section.replace('_', ' ')} block today."
    )
    return Suggestion(
        rule_id="section_coverage_drop",
        tier=SuggestionTier.pre_session,
        text=text,
    )


# ===================================================================
# In-the-moment rules
# ===================================================================

async def previous_block_note(ctx: RuleContext) -> Optional[Suggestion]:
    """Surface the user's note from the previous time they practiced this block."""
    if ctx.block_id is None or ctx.block_log_id is None:
        return None

    # Exclude the entire current session, not just the current block_log,
    # so other block_logs in the same session can't leak through.
    where_clauses = [
        BlockLog.block_id == ctx.block_id,
        BlockLog.notes != None,  # noqa: E711
        BlockLog.notes != "",
        PracticeLog.user_id == ctx.user_id,
        PracticeLog.status == SessionStatus.completed.value,
        PracticeLog.deleted_at == None,  # noqa: E711
    ]
    if ctx.practice_log_id is not None:
        where_clauses.append(PracticeLog.id != ctx.practice_log_id)

    result = await ctx.session.exec(
        select(BlockLog.notes, PracticeLog.practice_date)
        .join(SectionLog, BlockLog.section_log_id == SectionLog.id)
        .join(PracticeLog, SectionLog.practice_log_id == PracticeLog.id)
        .where(*where_clauses)
        .order_by(col(PracticeLog.practice_date).desc())
        .limit(1)
    )
    row = result.first()
    if row is None:
        return None

    note, _ = row
    text = f'Last session you noted: "{note}"'
    return Suggestion(
        rule_id="previous_block_note",
        tier=SuggestionTier.in_the_moment,
        text=text,
        block_log_id=ctx.block_log_id,
    )


async def tempo_progression(ctx: RuleContext) -> Optional[Suggestion]:
    """Suggest bumping tempo when the last 2+ sessions on this block were
    rated step_forward."""
    if ctx.block_id is None or ctx.block_log_id is None:
        return None

    # Exclude the entire current session, not just the current block_log
    where_clauses = [
        BlockLog.block_id == ctx.block_id,
        BlockLog.rating != None,  # noqa: E711
        PracticeLog.user_id == ctx.user_id,
        PracticeLog.status == SessionStatus.completed.value,
        PracticeLog.deleted_at == None,  # noqa: E711
    ]
    if ctx.practice_log_id is not None:
        where_clauses.append(PracticeLog.id != ctx.practice_log_id)

    # Pull this block's last 2 completed ratings
    result = await ctx.session.exec(
        select(BlockLog.rating, PracticeLog.practice_date)
        .join(SectionLog, BlockLog.section_log_id == SectionLog.id)
        .join(PracticeLog, SectionLog.practice_log_id == PracticeLog.id)
        .where(*where_clauses)
        .order_by(col(PracticeLog.practice_date).desc())
        .limit(2)
    )
    ratings = [r[0] for r in result.all()]
    if len(ratings) < 2 or not all(r == 1 for r in ratings):
        return None

    # Look up the block's current tempo, if any
    block_result = await ctx.session.exec(
        select(Block.tempo_bpm).where(Block.id == ctx.block_id)
    )
    tempo = block_result.first()
    if tempo:
        text = (
            f"Two sessions trending forward — try bumping the tempo "
            f"to {tempo + 4} this time."
        )
    else:
        text = "Two sessions trending forward — try a small tempo bump."

    return Suggestion(
        rule_id="tempo_progression",
        tier=SuggestionTier.in_the_moment,
        text=text,
        block_log_id=ctx.block_log_id,
    )


async def spot_step_forward_streak(ctx: RuleContext) -> Optional[Suggestion]:
    """Fires when a spot's last 3+ block_logs are all rated step_forward."""
    if ctx.spot_id is None or ctx.block_log_id is None:
        return None

    # Exclude the entire current session, not just the current block_log
    where_clauses = [
        BlockLog.spot_id == ctx.spot_id,
        BlockLog.rating != None,  # noqa: E711
        PracticeLog.user_id == ctx.user_id,
        PracticeLog.status == SessionStatus.completed.value,
        PracticeLog.deleted_at == None,  # noqa: E711
    ]
    if ctx.practice_log_id is not None:
        where_clauses.append(PracticeLog.id != ctx.practice_log_id)

    # Order by practice_date (consistent with the other rules), tie-breaking
    # by BlockLog.id for determinism within a session.
    result = await ctx.session.exec(
        select(BlockLog.rating)
        .join(SectionLog, BlockLog.section_log_id == SectionLog.id)
        .join(PracticeLog, SectionLog.practice_log_id == PracticeLog.id)
        .where(*where_clauses)
        .order_by(col(PracticeLog.practice_date).desc(), col(BlockLog.id).desc())
        .limit(3)
    )
    ratings = [r for r in result.all()]
    if len(ratings) < 3 or not all(r == 1 for r in ratings):
        return None

    text = (
        "This spot has been step-forward three sessions in a row — "
        "try the next page or a faster tempo."
    )
    return Suggestion(
        rule_id="spot_step_forward_streak",
        tier=SuggestionTier.in_the_moment,
        text=text,
        block_log_id=ctx.block_log_id,
    )


# ===================================================================
# Post-session rules
# ===================================================================

async def weekly_consistency(ctx: RuleContext) -> Optional[Suggestion]:
    """Compares days practiced in the last 7 days to the user's effective goal,
    derived from the instrument's frequency setting.

    The window is rolling, not a calendar week — so the copy says "the last 7
    days" rather than "this week", which in this product means the calendar week
    shown in Insights (#272)."""
    if ctx.instrument_id is None:
        return None

    today = datetime.now(timezone.utc).date()
    window_start = today - timedelta(days=6)

    days_result = await ctx.session.exec(
        select(func.count(func.distinct(PracticeLog.practice_date))).where(
            PracticeLog.user_id == ctx.user_id,
            PracticeLog.instrument_id == ctx.instrument_id,
            PracticeLog.status == SessionStatus.completed.value,
            PracticeLog.deleted_at == None,  # noqa: E711
            PracticeLog.practice_date >= window_start,
            PracticeLog.practice_date <= today,
        )
    )
    days_in_window = days_result.one() or 0

    inst_result = await ctx.session.exec(
        select(Instrument.practice_frequency).where(
            Instrument.id == ctx.instrument_id
        )
    )
    freq = inst_result.first() or PracticeFrequency.few_times_a_week.value
    targets = {
        PracticeFrequency.daily.value: 7,
        PracticeFrequency.few_times_a_week.value: 4,
        PracticeFrequency.weekly.value: 1,
        PracticeFrequency.occasionally.value: 1,
    }
    target = targets.get(freq, 4)

    if days_in_window >= target:
        text = (
            f"You've practiced {days_in_window} of the last 7 days — "
            f"you've hit your goal! Keep the momentum going."
        )
    else:
        remaining = target - days_in_window
        word = "one more" if remaining == 1 else f"{remaining} more"
        text = (
            f"You've practiced {days_in_window} of the last 7 days — "
            f"{word} and you'll match your goal."
        )

    return Suggestion(
        rule_id="weekly_consistency",
        tier=SuggestionTier.post_session,
        text=text,
    )


async def spot_plateau(ctx: RuleContext) -> Optional[Suggestion]:
    """Fires when a spot's last 5+ rated block_logs are predominantly steady
    with no step_forward in the last 14 days.

    Note: this rule examines block_logs (not distinct sessions) per spec.
    A user who logs the same spot multiple times in one session will see
    each log counted independently. For post-session evaluation, scans all
    spots practiced in the just-finished session.
    """
    if ctx.practice_log_id is None:
        return None

    # Find spot_ids practiced in this session
    spots_result = await ctx.session.exec(
        select(BlockLog.spot_id)
        .join(SectionLog, BlockLog.section_log_id == SectionLog.id)
        .where(
            SectionLog.practice_log_id == ctx.practice_log_id,
            BlockLog.spot_id != None,  # noqa: E711
        )
        .distinct()
    )
    spot_ids = [r for r in spots_result.all() if r is not None]
    if not spot_ids:
        return None

    today = datetime.now(timezone.utc).date()
    # "Last 14 days" = strictly more recent than 14 days ago.
    forward_cutoff = today - timedelta(days=14)

    for spot_id in spot_ids:
        # Last 5 ratings on this spot, most recent first
        ratings_result = await ctx.session.exec(
            select(BlockLog.rating, PracticeLog.practice_date)
            .join(SectionLog, BlockLog.section_log_id == SectionLog.id)
            .join(PracticeLog, SectionLog.practice_log_id == PracticeLog.id)
            .where(
                BlockLog.spot_id == spot_id,
                BlockLog.rating != None,  # noqa: E711
                PracticeLog.user_id == ctx.user_id,
                PracticeLog.status == SessionStatus.completed.value,
                PracticeLog.deleted_at == None,  # noqa: E711
            )
            .order_by(col(PracticeLog.practice_date).desc())
            .limit(5)
        )
        rows = ratings_result.all()
        if len(rows) < 5:
            continue

        ratings = [r[0] for r in rows]
        steady_count = sum(1 for r in ratings if r == 0)
        # "no step_forward in 2+ weeks" means: no forward-rated log within
        # the last 14 days. Use `>` not `>=` so the boundary is exactly 14d.
        forward_recent = any(
            r[0] == 1 and r[1] > forward_cutoff for r in rows
        )

        if steady_count >= 3 and not forward_recent:
            # Look up spot + piece names for the message
            spot_row = await ctx.session.exec(
                select(Spot.name, Piece.name)
                .join(Piece, Piece.id == Spot.piece_id)
                .where(Spot.id == spot_id)
            )
            row = spot_row.first()
            if row is None:
                continue
            spot_name, piece_name = row
            text = (
                f"Your '{spot_name}' on {piece_name} has been steady for "
                f"a while — try changing your approach (slower, smaller chunks, "
                f"or a different focus)."
            )
            return Suggestion(
                rule_id="spot_plateau",
                tier=SuggestionTier.post_session,
                text=text,
            )

    return None


# ===================================================================
# Pattern-level rules
# ===================================================================

async def retired_spot_check(ctx: RuleContext) -> Optional[Suggestion]:
    """Fires when a spot has been retired for 4+ weeks. Suggests a check-in."""
    if ctx.instrument_id is None:
        return None

    # The Spot model declares retired_at as Optional[datetime] (no tz), so
    # SQLAlchemy binds parameters as TIMESTAMP WITHOUT TIME ZONE. Use naive
    # UTC datetimes for the comparison and the math.
    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    cutoff = now_naive - timedelta(weeks=4)

    result = await ctx.session.exec(
        select(Spot.name, Piece.name, Spot.retired_at)
        .join(Piece, Piece.id == Spot.piece_id)
        .where(
            Piece.instrument_id == ctx.instrument_id,
            Piece.deleted_at == None,  # noqa: E711
            Spot.deleted_at == None,  # noqa: E711
            Spot.retired_at != None,  # noqa: E711
            Spot.retired_at <= cutoff,
        )
        .order_by(col(Spot.retired_at).asc())
        .limit(1)
    )
    row = result.first()
    if row is None:
        return None

    spot_name, piece_name, retired_at = row
    # If the driver returned a tz-aware value, drop the tz to compare
    if retired_at.tzinfo is not None:
        retired_at = retired_at.astimezone(timezone.utc).replace(tzinfo=None)
    weeks = (now_naive - retired_at).days // 7
    text = (
        f"You retired '{spot_name}' on {piece_name} {weeks} weeks ago — "
        f"want to spot-check it?"
    )
    return Suggestion(
        rule_id="retired_spot_check",
        tier=SuggestionTier.pattern_level,
        text=text,
    )


async def whole_piece_overuse(ctx: RuleContext) -> Optional[Suggestion]:
    """Fires when the user has logged a piece at the piece level (no spot)
    for the last 5+ distinct *sessions* in a row, suggesting they might
    benefit from picking spots.

    Semantics:
    - Look at the last N sessions in which this piece was practiced at all.
    - For each such session, classify it as "spot-level" (any block_log
      with spot_id IS NOT NULL for this piece) or "piece-only" (only
      block_logs with spot_id IS NULL for this piece).
    - Fire if the most recent 5+ sessions are all piece-only.
    """
    if ctx.instrument_id is None:
        return None

    pieces_result = await ctx.session.exec(
        select(Piece.id, Piece.name).where(
            Piece.instrument_id == ctx.instrument_id,
            Piece.deleted_at == None,  # noqa: E711
        )
    )
    pieces = pieces_result.all()

    for piece_id, piece_name in pieces:
        # For each session that touched this piece, compute whether it
        # contained any spot-level log. We aggregate per practice_log_id.
        sessions_result = await ctx.session.exec(
            select(
                PracticeLog.id,
                PracticeLog.practice_date,
                func.bool_or(BlockLog.spot_id != None).label("had_spot"),  # noqa: E711
            )
            .select_from(BlockLog)
            .join(Block, Block.id == BlockLog.block_id)
            .join(SectionLog, BlockLog.section_log_id == SectionLog.id)
            .join(PracticeLog, SectionLog.practice_log_id == PracticeLog.id)
            .where(
                Block.piece_id == piece_id,
                PracticeLog.user_id == ctx.user_id,
                PracticeLog.status == SessionStatus.completed.value,
                PracticeLog.deleted_at == None,  # noqa: E711
            )
            .group_by(PracticeLog.id, PracticeLog.practice_date)
            .order_by(col(PracticeLog.practice_date).desc(), col(PracticeLog.id).desc())
            .limit(5)
        )
        sessions = sessions_result.all()
        if len(sessions) < 5:
            continue

        # All five most recent sessions must be piece-only (no spot logs)
        if all(not row[2] for row in sessions):
            text = (
                f"You've logged {piece_name} as a whole piece for the last "
                f"{len(sessions)} sessions — try picking specific spots to "
                f"focus your practice."
            )
            return Suggestion(
                rule_id="whole_piece_overuse",
                tier=SuggestionTier.pattern_level,
                text=text,
            )

    return None
