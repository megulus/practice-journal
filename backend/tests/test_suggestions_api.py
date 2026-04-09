"""Tests for /api/suggestions endpoints (pre-session, in-session, dismiss, interact)."""
import pytest
from datetime import datetime, timezone, timedelta, date
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import (
    Instrument, Template, TemplateSession, Section, Block,
    PracticeLog, SectionLog, BlockLog,
    SuggestionDismissal, SuggestionInteraction,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _make_log(db_session, user, instrument, practice_date, status="completed"):
    log = PracticeLog(
        user_id=user.id,
        instrument_id=instrument.id,
        status=status,
        practice_date=practice_date,
        total_duration_minutes=20,
    )
    db_session.add(log)
    await db_session.commit()
    await db_session.refresh(log)
    return log


# ===================================================================
# GET /api/suggestions/pre-session
# ===================================================================

class TestPreSessionEndpoint:
    async def test_returns_null_when_nothing_to_suggest(
        self, client: AsyncClient, test_instrument
    ):
        resp = await client.get(
            f"/api/suggestions/pre-session?instrument_id={test_instrument.id}"
        )
        assert resp.status_code == 200
        assert resp.json() == {"suggestion": None}

    async def test_returns_suggestion(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        test_instrument.practice_frequency = "daily"
        db_session.add(test_instrument)
        await _make_log(
            db_session, test_user, test_instrument,
            practice_date=datetime.now(timezone.utc).date() - timedelta(days=5),
        )

        resp = await client.get(
            f"/api/suggestions/pre-session?instrument_id={test_instrument.id}"
        )
        assert resp.status_code == 200
        s = resp.json()["suggestion"]
        assert s is not None
        assert s["rule_id"] == "consistency_nudge"
        assert s["tier"] == "pre_session"
        assert "5 days" in s["text"]

    async def test_instrument_required(self, client: AsyncClient):
        resp = await client.get("/api/suggestions/pre-session")
        assert resp.status_code == 422

    async def test_other_users_instrument_404(
        self, client: AsyncClient, db_session, other_user
    ):
        other_inst = Instrument(user_id=other_user.id, name="Guitar")
        db_session.add(other_inst)
        await db_session.commit()
        await db_session.refresh(other_inst)
        resp = await client.get(
            f"/api/suggestions/pre-session?instrument_id={other_inst.id}"
        )
        assert resp.status_code == 404

    async def test_unauthenticated_returns_401(
        self, unauth_client: AsyncClient, test_instrument
    ):
        resp = await unauth_client.get(
            f"/api/suggestions/pre-session?instrument_id={test_instrument.id}"
        )
        assert resp.status_code == 401


# ===================================================================
# GET /api/suggestions/in-session/{logId}
# ===================================================================

class TestInSessionEndpoint:
    async def test_returns_empty_when_no_blocks(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        log = await _make_log(
            db_session, test_user, test_instrument,
            practice_date=date(2026, 4, 8), status="in_progress",
        )
        resp = await client.get(f"/api/suggestions/in-session/{log.id}")
        assert resp.status_code == 200
        assert resp.json() == {"suggestions": {}}

    async def test_returns_keyed_by_block_log_id(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        # Create a Block with a tempo + 2 prior step_forward sessions
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
            section_id=section.id, name="G major", tempo_bpm=72, display_order=0
        )
        db_session.add(block)
        await db_session.commit()
        await db_session.refresh(block)

        for d in [date(2026, 4, 1), date(2026, 4, 4)]:
            old_log = await _make_log(
                db_session, test_user, test_instrument, practice_date=d
            )
            sl = SectionLog(
                practice_log_id=old_log.id,
                section_type="scales",
                section_name="Scales",
                actual_duration_minutes=10,
            )
            db_session.add(sl)
            await db_session.commit()
            await db_session.refresh(sl)
            db_session.add(BlockLog(
                section_log_id=sl.id, block_id=block.id,
                block_name="G major", rating=1, completed=True,
            ))
            await db_session.commit()

        # New in-progress session
        new_log = await _make_log(
            db_session, test_user, test_instrument,
            practice_date=date(2026, 4, 8), status="in_progress",
        )
        new_sl = SectionLog(
            practice_log_id=new_log.id,
            section_type="scales",
            section_name="Scales",
            actual_duration_minutes=10,
        )
        db_session.add(new_sl)
        await db_session.commit()
        await db_session.refresh(new_sl)
        new_bl = BlockLog(
            section_log_id=new_sl.id, block_id=block.id,
            block_name="G major", completed=False,
        )
        db_session.add(new_bl)
        await db_session.commit()
        await db_session.refresh(new_bl)

        resp = await client.get(f"/api/suggestions/in-session/{new_log.id}")
        assert resp.status_code == 200
        suggestions = resp.json()["suggestions"]
        assert str(new_bl.id) in suggestions
        assert suggestions[str(new_bl.id)]["rule_id"] == "tempo_progression"

    async def test_other_users_log_returns_404(
        self, client: AsyncClient, db_session, other_user
    ):
        other_inst = Instrument(user_id=other_user.id, name="G")
        db_session.add(other_inst)
        await db_session.commit()
        await db_session.refresh(other_inst)
        log = await _make_log(
            db_session, other_user, other_inst,
            practice_date=date(2026, 4, 8), status="in_progress",
        )
        resp = await client.get(f"/api/suggestions/in-session/{log.id}")
        assert resp.status_code == 404


# ===================================================================
# POST /api/suggestions/dismiss
# ===================================================================

class TestDismissEndpoint:
    async def test_dismiss_creates_record(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        resp = await client.post("/api/suggestions/dismiss", json={
            "rule_id": "consistency_nudge",
            "instrument_id": test_instrument.id,
            "tier": "pre_session",
        })
        assert resp.status_code == 204

        result = await db_session.exec(
            select(SuggestionDismissal).where(
                SuggestionDismissal.user_id == test_user.id,
                SuggestionDismissal.suggestion_rule_id == "consistency_nudge",
            )
        )
        d = result.first()
        assert d is not None
        assert d.instrument_id == test_instrument.id

    async def test_dismiss_is_idempotent(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        body = {
            "rule_id": "consistency_nudge",
            "instrument_id": test_instrument.id,
            "tier": "pre_session",
        }
        await client.post("/api/suggestions/dismiss", json=body)
        await client.post("/api/suggestions/dismiss", json=body)

        result = await db_session.exec(
            select(SuggestionDismissal).where(
                SuggestionDismissal.user_id == test_user.id,
                SuggestionDismissal.suggestion_rule_id == "consistency_nudge",
            )
        )
        rows = result.all()
        assert len(rows) == 1

    async def test_dismiss_cross_instrument(
        self, client: AsyncClient, db_session, test_user
    ):
        resp = await client.post("/api/suggestions/dismiss", json={
            "rule_id": "weekly_consistency",
            "tier": "post_session",
        })
        assert resp.status_code == 204

        result = await db_session.exec(
            select(SuggestionDismissal).where(
                SuggestionDismissal.user_id == test_user.id,
            )
        )
        d = result.first()
        assert d.instrument_id is None

    async def test_dismiss_other_users_instrument_404(
        self, client: AsyncClient, db_session, other_user
    ):
        other_inst = Instrument(user_id=other_user.id, name="G")
        db_session.add(other_inst)
        await db_session.commit()
        await db_session.refresh(other_inst)

        resp = await client.post("/api/suggestions/dismiss", json={
            "rule_id": "consistency_nudge",
            "instrument_id": other_inst.id,
            "tier": "pre_session",
        })
        assert resp.status_code == 404

    async def test_invalid_tier_returns_422(self, client: AsyncClient):
        resp = await client.post("/api/suggestions/dismiss", json={
            "rule_id": "x",
            "tier": "not_a_tier",
        })
        assert resp.status_code == 422

    async def test_dismissal_silences_rule_in_endpoint(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        """End-to-end: dismiss → pre-session no longer fires."""
        test_instrument.practice_frequency = "daily"
        db_session.add(test_instrument)
        await _make_log(
            db_session, test_user, test_instrument,
            practice_date=datetime.now(timezone.utc).date() - timedelta(days=5),
        )

        # Verify it fires first
        resp = await client.get(
            f"/api/suggestions/pre-session?instrument_id={test_instrument.id}"
        )
        assert resp.json()["suggestion"] is not None

        # Dismiss
        await client.post("/api/suggestions/dismiss", json={
            "rule_id": "consistency_nudge",
            "instrument_id": test_instrument.id,
            "tier": "pre_session",
        })

        # Now the rule should no longer fire
        resp = await client.get(
            f"/api/suggestions/pre-session?instrument_id={test_instrument.id}"
        )
        assert resp.json()["suggestion"] is None


# ===================================================================
# POST /api/suggestions/interact
# ===================================================================

class TestInteractEndpoint:
    async def test_records_interaction(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        resp = await client.post("/api/suggestions/interact", json={
            "suggestion_rule_id": "consistency_nudge",
            "suggestion_tier": "pre_session",
            "suggestion_text": "It's been 5 days...",
            "interaction_type": "shown",
            "instrument_id": test_instrument.id,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["suggestion_rule_id"] == "consistency_nudge"
        assert data["interaction_type"] == "shown"

        result = await db_session.exec(
            select(SuggestionInteraction).where(
                SuggestionInteraction.user_id == test_user.id,
            )
        )
        rows = result.all()
        assert len(rows) == 1

    async def test_invalid_interaction_type(self, client: AsyncClient):
        resp = await client.post("/api/suggestions/interact", json={
            "suggestion_rule_id": "x",
            "suggestion_tier": "pre_session",
            "suggestion_text": "x",
            "interaction_type": "not_a_type",
        })
        assert resp.status_code == 422

    async def test_other_users_instrument_404(
        self, client: AsyncClient, db_session, other_user
    ):
        other_inst = Instrument(user_id=other_user.id, name="G")
        db_session.add(other_inst)
        await db_session.commit()
        await db_session.refresh(other_inst)
        resp = await client.post("/api/suggestions/interact", json={
            "suggestion_rule_id": "x",
            "suggestion_tier": "pre_session",
            "suggestion_text": "x",
            "interaction_type": "shown",
            "instrument_id": other_inst.id,
        })
        assert resp.status_code == 404
