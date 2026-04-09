"""Unit tests for the 9 suggestion rules and the engine orchestration.

Tests each rule in isolation by setting up the minimal data needed for it
to fire (or not fire), then asserting the engine returns the expected
suggestion.
"""
import pytest
from datetime import datetime, timezone, timedelta, date
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import (
    Instrument, Template, TemplateSession, Section, Block,
    Piece, Spot, PracticeLog, SectionLog, BlockLog,
    UserSettings, SuggestionDismissal,
)
from app.enums import SuggestionTier, PracticeFrequency, SessionStatus, SuggestionsPreference
from app.suggestions import (
    evaluate_pre_session,
    evaluate_in_session,
    evaluate_post_session,
    evaluate_pattern_level,
)
from app.suggestions import rules as rule_funcs
from app.suggestions.base import RuleContext


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _make_log(
    db_session, user, instrument, practice_date,
    status="completed", template_id=None, template_session_id=None,
):
    log = PracticeLog(
        user_id=user.id,
        instrument_id=instrument.id,
        template_id=template_id,
        template_session_id=template_session_id,
        status=status,
        practice_date=practice_date,
        total_duration_minutes=20,
    )
    db_session.add(log)
    await db_session.commit()
    await db_session.refresh(log)
    return log


async def _make_section_log(db_session, log, section_type="scales", duration=10):
    sl = SectionLog(
        practice_log_id=log.id,
        section_type=section_type,
        section_name=section_type.replace("_", " ").title(),
        actual_duration_minutes=duration,
    )
    db_session.add(sl)
    await db_session.commit()
    await db_session.refresh(sl)
    return sl


async def _make_block_log(
    db_session, sl, name="Block", block_id=None, spot_id=None,
    rating=None, notes=None, completed=True,
):
    bl = BlockLog(
        section_log_id=sl.id,
        block_id=block_id,
        spot_id=spot_id,
        block_name=name,
        rating=rating,
        notes=notes,
        completed=completed,
    )
    db_session.add(bl)
    await db_session.commit()
    await db_session.refresh(bl)
    return bl


# ===================================================================
# PRE-SESSION RULES
# ===================================================================

class TestConsistencyNudge:
    async def test_fires_when_overdue(
        self, db_session, test_user, test_instrument
    ):
        # daily instrument, last practice 5 days ago
        test_instrument.practice_frequency = "daily"
        db_session.add(test_instrument)
        await _make_log(
            db_session, test_user, test_instrument,
            practice_date=datetime.now(timezone.utc).date() - timedelta(days=5),
        )
        result = await evaluate_pre_session(
            db_session, test_user.id, test_instrument.id
        )
        assert result is not None
        assert result.rule_id == "consistency_nudge"
        assert "5 days" in result.text

    async def test_silent_when_recent(
        self, db_session, test_user, test_instrument
    ):
        await _make_log(
            db_session, test_user, test_instrument,
            practice_date=datetime.now(timezone.utc).date(),
        )
        result = await evaluate_pre_session(
            db_session, test_user.id, test_instrument.id
        )
        assert result is None

    async def test_silent_when_no_history(
        self, db_session, test_user, test_instrument
    ):
        result = await evaluate_pre_session(
            db_session, test_user.id, test_instrument.id
        )
        assert result is None

    async def test_respects_dismissal(
        self, db_session, test_user, test_instrument
    ):
        test_instrument.practice_frequency = "daily"
        db_session.add(test_instrument)
        await _make_log(
            db_session, test_user, test_instrument,
            practice_date=datetime.now(timezone.utc).date() - timedelta(days=5),
        )
        dismissal = SuggestionDismissal(
            user_id=test_user.id,
            instrument_id=test_instrument.id,
            suggestion_rule_id="consistency_nudge",
            suggestion_tier=SuggestionTier.pre_session.value,
        )
        db_session.add(dismissal)
        await db_session.commit()

        result = await evaluate_pre_session(
            db_session, test_user.id, test_instrument.id
        )
        # consistency dismissed → falls through to next rule (none here) → None
        assert result is None


class TestSectionCoverageDrop:
    async def test_fires_when_section_dropped_off(
        self, db_session, test_user, test_instrument
    ):
        today = datetime.now(timezone.utc).date()

        # Old window (15-28 days ago): had scales
        old_log = await _make_log(
            db_session, test_user, test_instrument,
            practice_date=today - timedelta(days=20),
        )
        await _make_section_log(db_session, old_log, section_type="scales")

        # Recent window (last 14 days): only warmup, no scales
        recent_log = await _make_log(
            db_session, test_user, test_instrument,
            practice_date=today - timedelta(days=3),
        )
        await _make_section_log(db_session, recent_log, section_type="warmup")

        result = await evaluate_pre_session(
            db_session, test_user.id, test_instrument.id
        )
        assert result is not None
        # Note: consistency_nudge has higher priority, so check rule_id
        # Only fires if it was triggered. Use the rule directly to verify behavior.
        ctx = RuleContext(
            session=db_session,
            user_id=test_user.id,
            instrument_id=test_instrument.id,
        )
        direct = await rule_funcs.section_coverage_drop(ctx)
        assert direct is not None
        assert direct.rule_id == "section_coverage_drop"
        assert "scales" in direct.text


# ===================================================================
# IN-SESSION RULES
# ===================================================================

class TestPreviousBlockNote:
    async def test_surfaces_prior_note(
        self, db_session, test_user, test_instrument
    ):
        # Set up: a Block plus an old block_log with a note, then a new
        # in-progress session referencing the same block
        template = Template(
            user_id=test_user.id, instrument_id=test_instrument.id, name="P"
        )
        db_session.add(template)
        await db_session.commit()
        await db_session.refresh(template)
        ts = TemplateSession(template_id=template.id, name="S", display_order=0)
        db_session.add(ts)
        await db_session.commit()
        await db_session.refresh(ts)
        section = Section(
            template_session_id=ts.id, name="Scales", section_type="scales",
            display_order=0,
        )
        db_session.add(section)
        await db_session.commit()
        await db_session.refresh(section)
        block = Block(section_id=section.id, name="G major", display_order=0)
        db_session.add(block)
        await db_session.commit()
        await db_session.refresh(block)

        # Old completed log with note
        old_log = await _make_log(
            db_session, test_user, test_instrument,
            practice_date=date(2026, 4, 1),
        )
        old_sl = await _make_section_log(db_session, old_log)
        await _make_block_log(
            db_session, old_sl, name="G major", block_id=block.id,
            rating=0, notes="intonation shaky in top octave",
        )

        # New in-progress session with the same block
        new_log = await _make_log(
            db_session, test_user, test_instrument,
            practice_date=date(2026, 4, 8), status="in_progress",
        )
        new_sl = await _make_section_log(db_session, new_log)
        new_bl = await _make_block_log(
            db_session, new_sl, name="G major", block_id=block.id,
            completed=False,
        )

        suggestions = await evaluate_in_session(
            db_session, test_user.id, new_log.id
        )
        assert new_bl.id in suggestions
        s = suggestions[new_bl.id]
        assert s.rule_id == "previous_block_note"
        assert "intonation" in s.text


class TestTempoProgression:
    async def test_fires_after_two_step_forward(
        self, db_session, test_user, test_instrument
    ):
        template = Template(
            user_id=test_user.id, instrument_id=test_instrument.id, name="P"
        )
        db_session.add(template)
        await db_session.commit()
        await db_session.refresh(template)
        ts = TemplateSession(template_id=template.id, name="S", display_order=0)
        db_session.add(ts)
        await db_session.commit()
        await db_session.refresh(ts)
        section = Section(
            template_session_id=ts.id, name="Scales", section_type="scales",
            display_order=0,
        )
        db_session.add(section)
        await db_session.commit()
        await db_session.refresh(section)
        block = Block(
            section_id=section.id, name="G major", tempo_bpm=72,
            display_order=0,
        )
        db_session.add(block)
        await db_session.commit()
        await db_session.refresh(block)

        # Two completed sessions rated step_forward
        for d in [date(2026, 4, 1), date(2026, 4, 4)]:
            log = await _make_log(
                db_session, test_user, test_instrument, practice_date=d
            )
            sl = await _make_section_log(db_session, log)
            await _make_block_log(
                db_session, sl, name="G major", block_id=block.id, rating=1,
            )

        # New in-progress session with the same block
        new_log = await _make_log(
            db_session, test_user, test_instrument,
            practice_date=date(2026, 4, 8), status="in_progress",
        )
        new_sl = await _make_section_log(db_session, new_log)
        new_bl = await _make_block_log(
            db_session, new_sl, name="G major", block_id=block.id,
            completed=False,
        )

        suggestions = await evaluate_in_session(
            db_session, test_user.id, new_log.id
        )
        s = suggestions.get(new_bl.id)
        assert s is not None
        # Note: previous_block_note has no notes set on the old logs, so
        # tempo_progression should win
        assert s.rule_id == "tempo_progression"
        assert "76" in s.text  # 72 + 4


class TestSpotStepForwardStreak:
    async def test_fires_after_three_in_a_row(
        self, db_session, test_user, test_instrument
    ):
        piece = Piece(instrument_id=test_instrument.id, name="Bruch")
        db_session.add(piece)
        await db_session.commit()
        await db_session.refresh(piece)
        spot = Spot(piece_id=piece.id, name="first page")
        db_session.add(spot)
        await db_session.commit()
        await db_session.refresh(spot)

        for d in [date(2026, 4, 1), date(2026, 4, 3), date(2026, 4, 5)]:
            log = await _make_log(
                db_session, test_user, test_instrument, practice_date=d
            )
            sl = await _make_section_log(db_session, log)
            await _make_block_log(
                db_session, sl, name="Bruch — first page", spot_id=spot.id,
                rating=1,
            )

        new_log = await _make_log(
            db_session, test_user, test_instrument,
            practice_date=date(2026, 4, 8), status="in_progress",
        )
        new_sl = await _make_section_log(db_session, new_log)
        new_bl = await _make_block_log(
            db_session, new_sl, name="Bruch — first page", spot_id=spot.id,
            completed=False,
        )

        suggestions = await evaluate_in_session(
            db_session, test_user.id, new_log.id
        )
        s = suggestions.get(new_bl.id)
        assert s is not None
        assert s.rule_id == "spot_step_forward_streak"


# ===================================================================
# POST-SESSION RULES
# ===================================================================

class TestWeeklyConsistency:
    async def test_under_goal(
        self, db_session, test_user, test_instrument
    ):
        # 1 session this week against a few_times_a_week instrument (target=4)
        log = await _make_log(
            db_session, test_user, test_instrument,
            practice_date=datetime.now(timezone.utc).date(),
        )
        result = await evaluate_post_session(
            db_session, test_user.id, test_instrument.id, log.id
        )
        assert result is not None
        assert result.rule_id == "weekly_consistency"
        assert "1 of the last 7 days" in result.text

    async def test_at_goal(
        self, db_session, test_user, test_instrument
    ):
        test_instrument.practice_frequency = "weekly"
        db_session.add(test_instrument)
        log = await _make_log(
            db_session, test_user, test_instrument,
            practice_date=datetime.now(timezone.utc).date(),
        )
        result = await evaluate_post_session(
            db_session, test_user.id, test_instrument.id, log.id
        )
        assert result is not None
        assert "hit your goal" in result.text


class TestSpotPlateau:
    async def test_fires_for_steady_spot(
        self, db_session, test_user, test_instrument
    ):
        piece = Piece(instrument_id=test_instrument.id, name="Bach")
        db_session.add(piece)
        await db_session.commit()
        await db_session.refresh(piece)
        spot = Spot(piece_id=piece.id, name="Allemande")
        db_session.add(spot)
        await db_session.commit()
        await db_session.refresh(spot)

        # 5 old sessions, all steady, all >14 days ago
        today = datetime.now(timezone.utc).date()
        for i in range(5):
            log = await _make_log(
                db_session, test_user, test_instrument,
                practice_date=today - timedelta(days=20 + i),
            )
            sl = await _make_section_log(db_session, log)
            await _make_block_log(
                db_session, sl, name="Bach — Allemande", spot_id=spot.id,
                rating=0,
            )

        # Today's session also has the spot (so post-session can find it)
        current_log = await _make_log(
            db_session, test_user, test_instrument, practice_date=today,
        )
        cur_sl = await _make_section_log(db_session, current_log)
        await _make_block_log(
            db_session, cur_sl, name="Bach — Allemande", spot_id=spot.id,
            rating=0,
        )

        result = await evaluate_post_session(
            db_session, test_user.id, test_instrument.id, current_log.id
        )
        assert result is not None
        # spot_plateau is checked first in POST_SESSION_RULES
        assert result.rule_id == "spot_plateau"
        assert "Allemande" in result.text


# ===================================================================
# PATTERN-LEVEL RULES
# ===================================================================

class TestRetiredSpotCheck:
    async def test_fires_for_long_retired_spot(
        self, db_session, test_user, test_instrument
    ):
        piece = Piece(instrument_id=test_instrument.id, name="Mozart")
        db_session.add(piece)
        await db_session.commit()
        await db_session.refresh(piece)

        retired_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(weeks=6)
        spot = Spot(
            piece_id=piece.id, name="cadenza", retired_at=retired_at
        )
        db_session.add(spot)
        await db_session.commit()

        result = await evaluate_pattern_level(
            db_session, test_user.id, test_instrument.id
        )
        assert result is not None
        assert result.rule_id == "retired_spot_check"
        assert "cadenza" in result.text

    async def test_silent_for_recently_retired(
        self, db_session, test_user, test_instrument
    ):
        piece = Piece(instrument_id=test_instrument.id, name="Mozart")
        db_session.add(piece)
        await db_session.commit()
        await db_session.refresh(piece)

        retired_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(weeks=1)
        spot = Spot(
            piece_id=piece.id, name="cadenza", retired_at=retired_at
        )
        db_session.add(spot)
        await db_session.commit()

        result = await evaluate_pattern_level(
            db_session, test_user.id, test_instrument.id
        )
        assert result is None


class TestWholePieceOveruse:
    async def test_fires_after_six_piece_level_logs(
        self, db_session, test_user, test_instrument
    ):
        piece = Piece(instrument_id=test_instrument.id, name="Brahms")
        db_session.add(piece)
        await db_session.commit()
        await db_session.refresh(piece)

        # Create a Block with piece_id so the join works
        template = Template(
            user_id=test_user.id, instrument_id=test_instrument.id, name="P"
        )
        db_session.add(template)
        await db_session.commit()
        await db_session.refresh(template)
        ts = TemplateSession(template_id=template.id, name="S", display_order=0)
        db_session.add(ts)
        await db_session.commit()
        await db_session.refresh(ts)
        section = Section(
            template_session_id=ts.id, name="Rep", section_type="repertoire",
            display_order=0,
        )
        db_session.add(section)
        await db_session.commit()
        await db_session.refresh(section)
        block = Block(section_id=section.id, piece_id=piece.id, display_order=0)
        db_session.add(block)
        await db_session.commit()
        await db_session.refresh(block)

        for i in range(6):
            log = await _make_log(
                db_session, test_user, test_instrument,
                practice_date=date(2026, 4, 1) + timedelta(days=i),
            )
            sl = await _make_section_log(db_session, log)
            await _make_block_log(
                db_session, sl, name="Brahms",
                block_id=block.id, spot_id=None, rating=0,
            )

        result = await evaluate_pattern_level(
            db_session, test_user.id, test_instrument.id
        )
        assert result is not None
        assert result.rule_id == "whole_piece_overuse"


# ===================================================================
# CROSS-CUTTING: suggestions_preference
# ===================================================================

class TestSuggestionsPreference:
    async def _set_pref(self, db_session, user, pref):
        result_q = await db_session.exec(
            __import__("sqlmodel").select(UserSettings).where(
                UserSettings.user_id == user.id
            )
        )
        existing = result_q.first()
        if existing:
            existing.suggestions_preference = pref
            db_session.add(existing)
        else:
            db_session.add(UserSettings(
                user_id=user.id, suggestions_preference=pref,
            ))
        await db_session.commit()

    async def test_off_disables_pre_session(
        self, db_session, test_user, test_instrument
    ):
        await self._set_pref(db_session, test_user, "off")
        test_instrument.practice_frequency = "daily"
        db_session.add(test_instrument)
        await _make_log(
            db_session, test_user, test_instrument,
            practice_date=datetime.now(timezone.utc).date() - timedelta(days=5),
        )
        result = await evaluate_pre_session(
            db_session, test_user.id, test_instrument.id
        )
        assert result is None

    async def test_off_disables_post_session(
        self, db_session, test_user, test_instrument
    ):
        await self._set_pref(db_session, test_user, "off")
        log = await _make_log(
            db_session, test_user, test_instrument,
            practice_date=datetime.now(timezone.utc).date(),
        )
        result = await evaluate_post_session(
            db_session, test_user.id, test_instrument.id, log.id
        )
        assert result is None

    async def test_fewer_disables_pre_session(
        self, db_session, test_user, test_instrument
    ):
        await self._set_pref(db_session, test_user, "fewer")
        test_instrument.practice_frequency = "daily"
        db_session.add(test_instrument)
        await _make_log(
            db_session, test_user, test_instrument,
            practice_date=datetime.now(timezone.utc).date() - timedelta(days=5),
        )
        result = await evaluate_pre_session(
            db_session, test_user.id, test_instrument.id
        )
        assert result is None

    async def test_fewer_keeps_post_session(
        self, db_session, test_user, test_instrument
    ):
        await self._set_pref(db_session, test_user, "fewer")
        log = await _make_log(
            db_session, test_user, test_instrument,
            practice_date=datetime.now(timezone.utc).date(),
        )
        result = await evaluate_post_session(
            db_session, test_user.id, test_instrument.id, log.id
        )
        assert result is not None
