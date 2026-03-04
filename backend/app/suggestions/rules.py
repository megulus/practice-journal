from typing import Optional, Protocol

from sqlmodel.ext.asyncio.session import AsyncSession

from app.suggestions.models import PracticeStats, SessionSuggestion, SessionSuggestionType
from app.suggestions.data_service import PracticeDataService


class SessionRule(Protocol):
    rule_id: str
    priority: int

    def evaluate(self, stats: PracticeStats) -> Optional[SessionSuggestion]: ...


# ---------------------------------------------------------------------------
# Rules
# ---------------------------------------------------------------------------

class ConsistencyNudge:
    rule_id = "consistency"
    priority = 1

    def evaluate(self, stats: PracticeStats) -> Optional[SessionSuggestion]:
        if stats.total_sessions_last_30_days < 3:
            return None
        if stats.days_since_last_practice is None:
            return None
        if stats.days_since_last_practice < 3:
            return None

        days = stats.days_since_last_practice
        weekly = stats.days_practiced_last_7_days
        message = (
            f"It's been {days} days since your last practice. "
            f"You've practiced {weekly} of 7 days this week — "
            f"a short session today keeps the momentum going!"
        )
        return SessionSuggestion(
            key=f"session_{self.rule_id}_{stats.instrument_id or 'all'}",
            type=SessionSuggestionType.CONSISTENCY,
            message=message,
            priority=self.priority,
            instrument_id=stats.instrument_id,
        )


class SectionCoverage:
    rule_id = "coverage"
    priority = 2

    def evaluate(self, stats: PracticeStats) -> Optional[SessionSuggestion]:
        if stats.total_sessions_last_30_days < 3:
            return None
        if not stats.all_known_section_types:
            return None

        recent = set(stats.section_types_last_14_days)
        known = set(stats.all_known_section_types)
        missing = known - recent
        if not missing:
            return None

        missing_list = ", ".join(sorted(missing)[:3])
        extra = len(missing) - 3
        label = missing_list + (f" (+{extra} more)" if extra > 0 else "")
        message = (
            f"You haven't practiced these areas in the last 2 weeks: {label}. "
            f"Consider adding them to your next session."
        )
        return SessionSuggestion(
            key=f"session_{self.rule_id}_{stats.instrument_id or 'all'}",
            type=SessionSuggestionType.COVERAGE,
            message=message,
            priority=self.priority,
            instrument_id=stats.instrument_id,
        )


class BalanceSuggestion:
    rule_id = "balance"
    priority = 3

    def evaluate(self, stats: PracticeStats) -> Optional[SessionSuggestion]:
        if stats.total_sessions_last_30_days < 3:
            return None
        if not stats.section_type_distribution:
            return None

        for section_type, pct in stats.section_type_distribution.items():
            if pct > 0.70:
                pct_display = round(pct * 100)
                message = (
                    f"Your recent practice is {pct_display}% {section_type}. "
                    f"Mixing in other areas can accelerate overall progress."
                )
                return SessionSuggestion(
                    key=f"session_{self.rule_id}_{stats.instrument_id or 'all'}",
                    type=SessionSuggestionType.BALANCE,
                    message=message,
                    priority=self.priority,
                    instrument_id=stats.instrument_id,
                )
        return None


class DurationInsight:
    rule_id = "duration"
    priority = 4

    def evaluate(self, stats: PracticeStats) -> Optional[SessionSuggestion]:
        if stats.total_sessions_last_30_days < 3:
            return None

        # Check if recent average is very short
        if (
            stats.average_duration_last_10 is not None
            and stats.average_duration_last_10 < 20
        ):
            avg = round(stats.average_duration_last_10)
            message = (
                f"Your recent sessions average {avg} minutes. "
                f"Even adding 5-10 minutes can make a noticeable difference in progress."
            )
            return SessionSuggestion(
                key=f"session_{self.rule_id}_{stats.instrument_id or 'all'}",
                type=SessionSuggestionType.DURATION,
                message=message,
                priority=self.priority,
                instrument_id=stats.instrument_id,
            )

        # Check if recent average dropped significantly from overall
        if (
            stats.average_duration_last_10 is not None
            and stats.average_duration_overall is not None
            and stats.average_duration_overall > 0
        ):
            drop = 1 - (stats.average_duration_last_10 / stats.average_duration_overall)
            if drop > 0.40:
                recent = round(stats.average_duration_last_10)
                overall = round(stats.average_duration_overall)
                message = (
                    f"Your recent sessions average {recent} minutes, "
                    f"down from your usual {overall} minutes. "
                    f"Shorter sessions are fine, but consistency in duration helps build habits."
                )
                return SessionSuggestion(
                    key=f"session_{self.rule_id}_{stats.instrument_id or 'all'}",
                    type=SessionSuggestionType.DURATION,
                    message=message,
                    priority=self.priority,
                    instrument_id=stats.instrument_id,
                )

        return None


class WarmupReminder:
    rule_id = "warmup"
    priority = 5

    def evaluate(self, stats: PracticeStats) -> Optional[SessionSuggestion]:
        if stats.recent_sessions_total < 3:
            return None

        warmup_pct = stats.recent_sessions_with_warmup / stats.recent_sessions_total
        if warmup_pct >= 0.30:
            return None

        message = (
            f"Only {stats.recent_sessions_with_warmup} of your last "
            f"{stats.recent_sessions_total} sessions included a warmup. "
            f"Starting with a warmup can improve technique and prevent strain."
        )
        return SessionSuggestion(
            key=f"session_{self.rule_id}_{stats.instrument_id or 'all'}",
            type=SessionSuggestionType.WARMUP,
            message=message,
            priority=self.priority,
            instrument_id=stats.instrument_id,
        )


# ---------------------------------------------------------------------------
# Registry & orchestrator
# ---------------------------------------------------------------------------

ALL_RULES: list[SessionRule] = [
    ConsistencyNudge(),
    SectionCoverage(),
    BalanceSuggestion(),
    DurationInsight(),
    WarmupReminder(),
]


async def evaluate_session_rules(
    session: AsyncSession,
    user_id: int,
    instrument_id: Optional[int] = None,
    max_suggestions: int = 3,
) -> list[SessionSuggestion]:
    stats = await PracticeDataService(session, user_id, instrument_id).get_stats()
    suggestions: list[SessionSuggestion] = []
    for rule in ALL_RULES:
        result = rule.evaluate(stats)
        if result is not None:
            suggestions.append(result)
    suggestions.sort(key=lambda s: s.priority)
    return suggestions[:max_suggestions]
