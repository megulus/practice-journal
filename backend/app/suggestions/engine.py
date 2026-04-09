"""
Suggestion engine — orchestrates rule evaluation, dismissal filtering,
and preference-based opt-out.

Each `evaluate_*` function is the entry point for one tier. They return
either a single Suggestion (or None) for tiers that show one suggestion at
a time, or a list/dict for tiers that show multiple.
"""
from typing import Awaitable, Callable, List, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import (
    UserSettings, SuggestionDismissal, SectionLog, BlockLog, Block,
)
from app.enums import SuggestionTier, SuggestionsPreference
from app.suggestions.base import RuleContext, Suggestion
from app.suggestions import rules


# Rule registries by tier. Order matters — earlier rules win when multiple
# would fire and the tier shows only one suggestion.
PRE_SESSION_RULES: List[Callable[[RuleContext], Awaitable[Optional[Suggestion]]]] = [
    rules.consistency_nudge,
    rules.section_coverage_drop,
]

# In-the-moment rules are evaluated per block_log. The first matching rule
# wins per block_log.
IN_SESSION_RULES: List[Callable[[RuleContext], Awaitable[Optional[Suggestion]]]] = [
    rules.spot_step_forward_streak,
    rules.previous_block_note,
    rules.tempo_progression,
]

POST_SESSION_RULES: List[Callable[[RuleContext], Awaitable[Optional[Suggestion]]]] = [
    rules.spot_plateau,
    rules.weekly_consistency,
]

PATTERN_RULES: List[Callable[[RuleContext], Awaitable[Optional[Suggestion]]]] = [
    rules.whole_piece_overuse,
    rules.retired_spot_check,
]


# ---------------------------------------------------------------------------
# Cross-cutting helpers
# ---------------------------------------------------------------------------

# Tiers that the "fewer" preference still surfaces.
_FEWER_TIERS = {
    SuggestionTier.post_session,
    SuggestionTier.pattern_level,
}


async def _get_preference(
    session: AsyncSession, user_id: int
) -> SuggestionsPreference:
    """Return the user's suggestions_preference, defaulting to 'all'."""
    result = await session.exec(
        select(UserSettings.suggestions_preference).where(
            UserSettings.user_id == user_id
        )
    )
    pref_str = result.first() or SuggestionsPreference.all.value
    try:
        return SuggestionsPreference(pref_str)
    except ValueError:
        return SuggestionsPreference.all


def _tier_allowed(
    tier: SuggestionTier, preference: SuggestionsPreference
) -> bool:
    if preference == SuggestionsPreference.off:
        return False
    if preference == SuggestionsPreference.fewer:
        return tier in _FEWER_TIERS
    return True


async def _get_dismissed_rule_ids(
    session: AsyncSession,
    user_id: int,
    instrument_id: Optional[int],
) -> set[str]:
    """Return the set of dismissed rule_ids for this user/instrument scope.

    A dismissal is matched if its instrument_id matches OR is null
    (cross-instrument dismissals).
    """
    query = select(SuggestionDismissal.suggestion_rule_id).where(
        SuggestionDismissal.user_id == user_id,
    )
    if instrument_id is not None:
        from sqlalchemy import or_
        query = query.where(
            or_(
                SuggestionDismissal.instrument_id == instrument_id,
                SuggestionDismissal.instrument_id == None,  # noqa: E711
            )
        )
    else:
        query = query.where(SuggestionDismissal.instrument_id == None)  # noqa: E711

    result = await session.exec(query)
    return set(result.all())


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------

async def evaluate_pre_session(
    session: AsyncSession,
    user_id: int,
    instrument_id: int,
) -> Optional[Suggestion]:
    """Return at most one pre-session suggestion, or None."""
    pref = await _get_preference(session, user_id)
    if not _tier_allowed(SuggestionTier.pre_session, pref):
        return None

    dismissed = await _get_dismissed_rule_ids(session, user_id, instrument_id)
    ctx = RuleContext(
        session=session,
        user_id=user_id,
        instrument_id=instrument_id,
    )

    for rule in PRE_SESSION_RULES:
        if rule.__name__ in dismissed:
            continue
        result = await rule(ctx)
        if result is not None:
            return result
    return None


async def evaluate_in_session(
    session: AsyncSession,
    user_id: int,
    practice_log_id: int,
) -> dict[int, Suggestion]:
    """Return in-session suggestions keyed by block_log_id.

    Each block_log gets at most one suggestion (first matching rule wins).
    Returns an empty dict if the user has opted out.
    """
    pref = await _get_preference(session, user_id)
    if not _tier_allowed(SuggestionTier.in_the_moment, pref):
        return {}

    # Get the practice log's instrument so we can filter dismissals
    from app.models import PracticeLog
    inst_result = await session.exec(
        select(PracticeLog.instrument_id).where(
            PracticeLog.id == practice_log_id,
            PracticeLog.user_id == user_id,
        )
    )
    instrument_id = inst_result.first()
    if instrument_id is None:
        return {}

    dismissed = await _get_dismissed_rule_ids(session, user_id, instrument_id)

    # Load all block_logs in this practice log
    bl_result = await session.exec(
        select(BlockLog.id, BlockLog.block_id, BlockLog.spot_id)
        .join(SectionLog, BlockLog.section_log_id == SectionLog.id)
        .where(SectionLog.practice_log_id == practice_log_id)
    )
    rows = bl_result.all()

    suggestions: dict[int, Suggestion] = {}
    for bl_id, block_id, spot_id in rows:
        ctx = RuleContext(
            session=session,
            user_id=user_id,
            instrument_id=instrument_id,
            practice_log_id=practice_log_id,
            block_log_id=bl_id,
            block_id=block_id,
            spot_id=spot_id,
        )
        for rule in IN_SESSION_RULES:
            if rule.__name__ in dismissed:
                continue
            result = await rule(ctx)
            if result is not None:
                suggestions[bl_id] = result
                break
    return suggestions


async def evaluate_post_session(
    session: AsyncSession,
    user_id: int,
    instrument_id: int,
    practice_log_id: int,
) -> Optional[Suggestion]:
    """Return at most one post-session suggestion."""
    pref = await _get_preference(session, user_id)
    if not _tier_allowed(SuggestionTier.post_session, pref):
        return None

    dismissed = await _get_dismissed_rule_ids(session, user_id, instrument_id)
    ctx = RuleContext(
        session=session,
        user_id=user_id,
        instrument_id=instrument_id,
        practice_log_id=practice_log_id,
    )
    for rule in POST_SESSION_RULES:
        if rule.__name__ in dismissed:
            continue
        result = await rule(ctx)
        if result is not None:
            return result
    return None


async def evaluate_pattern_level(
    session: AsyncSession,
    user_id: int,
    instrument_id: int,
) -> Optional[Suggestion]:
    """Return at most one pattern-level suggestion (for the Progress tab)."""
    pref = await _get_preference(session, user_id)
    if not _tier_allowed(SuggestionTier.pattern_level, pref):
        return None

    dismissed = await _get_dismissed_rule_ids(session, user_id, instrument_id)
    ctx = RuleContext(
        session=session,
        user_id=user_id,
        instrument_id=instrument_id,
    )
    for rule in PATTERN_RULES:
        if rule.__name__ in dismissed:
            continue
        result = await rule(ctx)
        if result is not None:
            return result
    return None
