"""Unit tests for session-level suggestion rules.

All tests construct PracticeStats directly — no DB or async needed.
"""
import pytest

from app.suggestions.models import PracticeStats, SessionSuggestionType
from app.suggestions.rules import (
    ConsistencyNudge,
    SectionCoverage,
    BalanceSuggestion,
    DurationInsight,
    WarmupReminder,
    ALL_RULES,
)


def make_stats(**overrides) -> PracticeStats:
    """Helper to create PracticeStats with sensible defaults."""
    defaults = dict(
        user_id=1,
        instrument_id=1,
        days_since_last_practice=1,
        total_sessions_last_30_days=10,
        days_practiced_last_7_days=4,
        section_type_distribution={"warmup": 0.2, "scales": 0.3, "repertoire": 0.5},
        average_duration_last_10=45.0,
        average_duration_overall=45.0,
        all_known_section_types=["warmup", "scales", "repertoire", "etude"],
        section_types_last_14_days=["warmup", "scales", "repertoire", "etude"],
        recent_sessions_with_warmup=5,
        recent_sessions_total=10,
    )
    defaults.update(overrides)
    return PracticeStats(**defaults)


# ---------------------------------------------------------------------------
# ConsistencyNudge
# ---------------------------------------------------------------------------

class TestConsistencyNudge:
    rule = ConsistencyNudge()

    def test_triggers_when_3_plus_days(self):
        stats = make_stats(days_since_last_practice=3)
        result = self.rule.evaluate(stats)
        assert result is not None
        assert result.type == SessionSuggestionType.CONSISTENCY
        assert "3 days" in result.message

    def test_triggers_when_many_days(self):
        stats = make_stats(days_since_last_practice=7)
        result = self.rule.evaluate(stats)
        assert result is not None
        assert "7 days" in result.message

    def test_does_not_trigger_recent_practice(self):
        stats = make_stats(days_since_last_practice=1)
        result = self.rule.evaluate(stats)
        assert result is None

    def test_does_not_trigger_insufficient_data(self):
        stats = make_stats(total_sessions_last_30_days=2, days_since_last_practice=5)
        result = self.rule.evaluate(stats)
        assert result is None

    def test_does_not_trigger_no_practice(self):
        stats = make_stats(days_since_last_practice=None)
        result = self.rule.evaluate(stats)
        assert result is None

    def test_includes_weekly_count(self):
        stats = make_stats(days_since_last_practice=4, days_practiced_last_7_days=2)
        result = self.rule.evaluate(stats)
        assert result is not None
        assert "2 of 7 days" in result.message


# ---------------------------------------------------------------------------
# SectionCoverage
# ---------------------------------------------------------------------------

class TestSectionCoverage:
    rule = SectionCoverage()

    def test_triggers_when_sections_missing(self):
        stats = make_stats(
            all_known_section_types=["warmup", "scales", "etude", "repertoire"],
            section_types_last_14_days=["warmup", "scales"],
        )
        result = self.rule.evaluate(stats)
        assert result is not None
        assert result.type == SessionSuggestionType.COVERAGE
        assert "etude" in result.message or "repertoire" in result.message

    def test_does_not_trigger_all_covered(self):
        stats = make_stats(
            all_known_section_types=["warmup", "scales"],
            section_types_last_14_days=["warmup", "scales"],
        )
        result = self.rule.evaluate(stats)
        assert result is None

    def test_does_not_trigger_insufficient_data(self):
        stats = make_stats(
            total_sessions_last_30_days=1,
            all_known_section_types=["warmup", "scales", "etude"],
            section_types_last_14_days=["warmup"],
        )
        result = self.rule.evaluate(stats)
        assert result is None

    def test_does_not_trigger_no_known_types(self):
        stats = make_stats(all_known_section_types=[])
        result = self.rule.evaluate(stats)
        assert result is None

    def test_limits_display_to_3_missing(self):
        stats = make_stats(
            all_known_section_types=["a", "b", "c", "d", "e"],
            section_types_last_14_days=[],
        )
        result = self.rule.evaluate(stats)
        assert result is not None
        assert "+2 more" in result.message


# ---------------------------------------------------------------------------
# BalanceSuggestion
# ---------------------------------------------------------------------------

class TestBalanceSuggestion:
    rule = BalanceSuggestion()

    def test_triggers_when_one_section_dominates(self):
        stats = make_stats(section_type_distribution={"scales": 0.85, "warmup": 0.15})
        result = self.rule.evaluate(stats)
        assert result is not None
        assert result.type == SessionSuggestionType.BALANCE
        assert "85%" in result.message
        assert "scales" in result.message

    def test_does_not_trigger_balanced(self):
        stats = make_stats(
            section_type_distribution={"scales": 0.4, "warmup": 0.3, "repertoire": 0.3}
        )
        result = self.rule.evaluate(stats)
        assert result is None

    def test_does_not_trigger_insufficient_data(self):
        stats = make_stats(
            total_sessions_last_30_days=2,
            section_type_distribution={"scales": 1.0},
        )
        result = self.rule.evaluate(stats)
        assert result is None

    def test_does_not_trigger_empty_distribution(self):
        stats = make_stats(section_type_distribution={})
        result = self.rule.evaluate(stats)
        assert result is None

    def test_threshold_at_exactly_70(self):
        stats = make_stats(section_type_distribution={"scales": 0.70, "warmup": 0.30})
        result = self.rule.evaluate(stats)
        assert result is None  # Not strictly >70%


# ---------------------------------------------------------------------------
# DurationInsight
# ---------------------------------------------------------------------------

class TestDurationInsight:
    rule = DurationInsight()

    def test_triggers_short_sessions(self):
        stats = make_stats(average_duration_last_10=15.0)
        result = self.rule.evaluate(stats)
        assert result is not None
        assert result.type == SessionSuggestionType.DURATION
        assert "15 minutes" in result.message

    def test_triggers_significant_drop(self):
        stats = make_stats(average_duration_last_10=25.0, average_duration_overall=50.0)
        result = self.rule.evaluate(stats)
        assert result is not None
        assert "25 minutes" in result.message
        assert "50 minutes" in result.message

    def test_does_not_trigger_normal_duration(self):
        stats = make_stats(average_duration_last_10=45.0, average_duration_overall=50.0)
        result = self.rule.evaluate(stats)
        assert result is None

    def test_does_not_trigger_insufficient_data(self):
        stats = make_stats(total_sessions_last_30_days=1, average_duration_last_10=10.0)
        result = self.rule.evaluate(stats)
        assert result is None

    def test_does_not_trigger_no_duration_data(self):
        stats = make_stats(average_duration_last_10=None, average_duration_overall=None)
        result = self.rule.evaluate(stats)
        assert result is None

    def test_short_sessions_takes_precedence_over_drop(self):
        # Both conditions true — short session check runs first
        stats = make_stats(average_duration_last_10=15.0, average_duration_overall=50.0)
        result = self.rule.evaluate(stats)
        assert result is not None
        assert "adding 5-10 minutes" in result.message


# ---------------------------------------------------------------------------
# WarmupReminder
# ---------------------------------------------------------------------------

class TestWarmupReminder:
    rule = WarmupReminder()

    def test_triggers_low_warmup_rate(self):
        stats = make_stats(recent_sessions_with_warmup=1, recent_sessions_total=10)
        result = self.rule.evaluate(stats)
        assert result is not None
        assert result.type == SessionSuggestionType.WARMUP
        assert "1 of your last 10" in result.message

    def test_does_not_trigger_good_warmup_rate(self):
        stats = make_stats(recent_sessions_with_warmup=5, recent_sessions_total=10)
        result = self.rule.evaluate(stats)
        assert result is None

    def test_does_not_trigger_insufficient_data(self):
        stats = make_stats(recent_sessions_with_warmup=0, recent_sessions_total=2)
        result = self.rule.evaluate(stats)
        assert result is None

    def test_threshold_at_exactly_30_percent(self):
        stats = make_stats(recent_sessions_with_warmup=3, recent_sessions_total=10)
        result = self.rule.evaluate(stats)
        assert result is None  # Exactly 30% is not < 30%

    def test_zero_warmups(self):
        stats = make_stats(recent_sessions_with_warmup=0, recent_sessions_total=10)
        result = self.rule.evaluate(stats)
        assert result is not None
        assert "0 of your last 10" in result.message


# ---------------------------------------------------------------------------
# Orchestrator (evaluate_session_rules is async, so we test the logic here)
# ---------------------------------------------------------------------------

class TestOrchestrator:
    def test_all_rules_registered(self):
        assert len(ALL_RULES) == 5

    def test_rules_have_increasing_priority(self):
        priorities = [r.priority for r in ALL_RULES]
        assert priorities == sorted(priorities)

    def test_priority_ordering_and_cap(self):
        """Simulate what the orchestrator does: collect, sort, cap."""
        stats = make_stats(
            days_since_last_practice=5,
            section_type_distribution={"scales": 0.90, "warmup": 0.10},
            average_duration_last_10=12.0,
            recent_sessions_with_warmup=0,
            recent_sessions_total=10,
            all_known_section_types=["warmup", "scales", "etude"],
            section_types_last_14_days=["scales"],
        )
        results = []
        for rule in ALL_RULES:
            r = rule.evaluate(stats)
            if r is not None:
                results.append(r)
        results.sort(key=lambda s: s.priority)

        # All 5 rules should fire
        assert len(results) == 5

        # After cap to 3
        capped = results[:3]
        assert len(capped) == 3
        assert capped[0].type == SessionSuggestionType.CONSISTENCY
        assert capped[1].type == SessionSuggestionType.COVERAGE
        assert capped[2].type == SessionSuggestionType.BALANCE

    def test_no_suggestions_insufficient_data(self):
        stats = make_stats(
            total_sessions_last_30_days=1,
            recent_sessions_total=1,
        )
        results = [r.evaluate(stats) for r in ALL_RULES]
        results = [r for r in results if r is not None]
        assert len(results) == 0

    def test_suggestion_keys_are_unique(self):
        stats = make_stats(
            days_since_last_practice=5,
            section_type_distribution={"scales": 0.90},
            average_duration_last_10=12.0,
            recent_sessions_with_warmup=0,
            recent_sessions_total=10,
            all_known_section_types=["warmup", "scales", "etude"],
            section_types_last_14_days=["scales"],
        )
        results = [r.evaluate(stats) for r in ALL_RULES]
        results = [r for r in results if r is not None]
        keys = [r.key for r in results]
        assert len(keys) == len(set(keys)), f"Duplicate keys: {keys}"
