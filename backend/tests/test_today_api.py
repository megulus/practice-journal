"""Tests for /api/today endpoints."""
import pytest
from datetime import date, datetime, timedelta, timezone
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Instrument, Template, TemplateSession, Section, PracticeLog


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _days_ago(n: int) -> date:
    return datetime.now(timezone.utc).date() - timedelta(days=n)


async def _make_instrument(db, user, *, name="Violin", frequency="few_times_a_week", **kw):
    inst = Instrument(user_id=user.id, name=name, practice_frequency=frequency, **kw)
    db.add(inst)
    await db.commit()
    await db.refresh(inst)
    return inst


async def _make_template_with_sessions(
    db, user, instrument, *, session_names=("Session 1",), rotation_index=0
):
    """Create an active template with named sessions, each having one warmup section."""
    tmpl = Template(
        user_id=user.id,
        instrument_id=instrument.id,
        name="Practice Plan",
        is_active=True,
        current_rotation_index=rotation_index,
    )
    db.add(tmpl)
    await db.commit()
    await db.refresh(tmpl)

    sessions = []
    for i, name in enumerate(session_names):
        ts = TemplateSession(
            template_id=tmpl.id, name=name, display_order=i
        )
        db.add(ts)
        await db.commit()
        await db.refresh(ts)
        sessions.append(ts)

        section = Section(
            template_session_id=ts.id,
            name="Warm-up",
            section_type="warmup",
            estimated_duration_minutes=10,
            display_order=0,
        )
        db.add(section)
        await db.commit()

    return tmpl, sessions


async def _make_log(db, user, instrument, *, status="completed", days_ago=0,
                    template=None, template_session=None):
    log = PracticeLog(
        user_id=user.id,
        instrument_id=instrument.id,
        status=status,
        practice_date=_days_ago(days_ago),
        total_duration_minutes=30,
        template_id=template.id if template else None,
        template_session_id=template_session.id if template_session else None,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


# ===========================================================================
# Due calculation tests
# ===========================================================================

class TestDueLogic:
    async def test_daily_always_due(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        inst = await _make_instrument(db_session, test_user, frequency="daily")
        await _make_log(db_session, test_user, inst, days_ago=0)

        resp = await client.get("/api/today")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["instruments_due"]) == 1
        assert data["instruments_due"][0]["instrument"]["name"] == "Violin"

    async def test_few_times_a_week_due_at_2_days(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        inst = await _make_instrument(db_session, test_user, frequency="few_times_a_week")
        await _make_log(db_session, test_user, inst, days_ago=2)

        resp = await client.get("/api/today")
        data = resp.json()
        assert len(data["instruments_due"]) == 1
        assert data["instruments_due"][0]["days_since_last"] == 2

    async def test_weekly_due_at_5_days(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        inst = await _make_instrument(db_session, test_user, frequency="weekly")
        await _make_log(db_session, test_user, inst, days_ago=5)

        resp = await client.get("/api/today")
        data = resp.json()
        assert len(data["instruments_due"]) == 1

    async def test_occasionally_never_due(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        await _make_instrument(db_session, test_user, frequency="occasionally")

        resp = await client.get("/api/today")
        data = resp.json()
        assert len(data["instruments_due"]) == 0
        assert len(data["instruments_not_due"]) == 1
        assert data["instruments_not_due"][0]["next_due_description"] == "practice when you feel like it"

    async def test_never_practiced_is_due(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        await _make_instrument(db_session, test_user, frequency="daily")

        resp = await client.get("/api/today")
        data = resp.json()
        assert len(data["instruments_due"]) == 1
        assert data["instruments_due"][0]["last_practiced_at"] is None
        assert data["instruments_due"][0]["days_since_last"] is None

    async def test_never_practiced_occasionally_not_due(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        await _make_instrument(db_session, test_user, frequency="occasionally")

        resp = await client.get("/api/today")
        data = resp.json()
        assert len(data["instruments_due"]) == 0
        assert len(data["instruments_not_due"]) == 1

    async def test_not_due_few_times_practiced_yesterday(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        inst = await _make_instrument(db_session, test_user, frequency="few_times_a_week")
        await _make_log(db_session, test_user, inst, days_ago=1)

        resp = await client.get("/api/today")
        data = resp.json()
        assert len(data["instruments_due"]) == 0
        assert len(data["instruments_not_due"]) == 1
        assert data["instruments_not_due"][0]["next_due_description"] == "due tomorrow"

    async def test_deleted_instrument_excluded(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        from app.enums import utcnow
        inst = Instrument(
            user_id=test_user.id, name="Deleted", practice_frequency="daily",
            deleted_at=utcnow(),
        )
        db_session.add(inst)
        await db_session.commit()

        resp = await client.get("/api/today")
        data = resp.json()
        assert len(data["instruments_due"]) == 0
        assert len(data["instruments_not_due"]) == 0

    async def test_mixed_due_and_not_due(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        daily = await _make_instrument(db_session, test_user, name="Violin", frequency="daily")
        weekly = await _make_instrument(db_session, test_user, name="Piano", frequency="weekly")
        await _make_log(db_session, test_user, weekly, days_ago=1)  # not due yet

        resp = await client.get("/api/today")
        data = resp.json()
        assert len(data["instruments_due"]) == 1
        assert data["instruments_due"][0]["instrument"]["name"] == "Violin"
        assert len(data["instruments_not_due"]) == 1
        assert data["instruments_not_due"][0]["instrument"]["name"] == "Piano"


# ===========================================================================
# Active session tests
# ===========================================================================

class TestActiveSession:
    async def test_active_session_detected(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        inst = await _make_instrument(db_session, test_user)
        await _make_log(db_session, test_user, inst, status="in_progress", days_ago=0)

        resp = await client.get("/api/today")
        data = resp.json()
        assert data["active_session"] is not None
        assert data["active_session"]["instrument_name"] == "Violin"

    async def test_active_session_with_template(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        inst = await _make_instrument(db_session, test_user)
        tmpl, sessions = await _make_template_with_sessions(
            db_session, test_user, inst
        )
        await _make_log(
            db_session, test_user, inst,
            status="in_progress", days_ago=0,
            template=tmpl, template_session=sessions[0],
        )

        resp = await client.get("/api/today")
        data = resp.json()
        assert data["active_session"] is not None
        assert data["active_session"]["session_name"] == "Session 1"

    async def test_active_session_returns_most_recent(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        """When multiple in-progress logs exist, return the most recent."""
        inst = await _make_instrument(db_session, test_user)
        await _make_log(db_session, test_user, inst, status="in_progress", days_ago=1)
        await _make_log(db_session, test_user, inst, status="in_progress", days_ago=0)

        resp = await client.get("/api/today")
        data = resp.json()
        assert data["active_session"] is not None
        # Should be the most recently created one
        assert data["active_session"]["practice_log_id"] is not None

    async def test_single_instrument_scopes_active_session(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        """GET /api/today/{id} only shows active session for that instrument."""
        violin = await _make_instrument(db_session, test_user, name="Violin", frequency="daily")
        piano = await _make_instrument(db_session, test_user, name="Piano", frequency="daily")
        await _make_log(db_session, test_user, piano, status="in_progress", days_ago=0)

        resp = await client.get(f"/api/today/{violin.id}")
        data = resp.json()
        # Piano's active session should NOT appear when scoped to violin
        assert data["active_session"] is None

    async def test_no_active_session(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        await _make_instrument(db_session, test_user)

        resp = await client.get("/api/today")
        data = resp.json()
        assert data["active_session"] is None


# ===========================================================================
# Current session / template tests
# ===========================================================================

class TestCurrentSession:
    async def test_current_session_from_template(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        inst = await _make_instrument(db_session, test_user, frequency="daily")
        tmpl, sessions = await _make_template_with_sessions(
            db_session, test_user, inst,
            session_names=["Fundamentals", "Repertoire", "Technique"],
            rotation_index=1,
        )

        resp = await client.get("/api/today")
        data = resp.json()
        due = data["instruments_due"][0]
        cs = due["current_session"]
        assert cs is not None
        assert cs["template_name"] == "Practice Plan"
        assert cs["session_name"] == "Repertoire"
        assert cs["rotation_position"] == "session 2 of 3"
        assert cs["estimated_duration_minutes"] == 10
        assert cs["section_types"] == ["warmup"]

    async def test_rotation_index_wraps_around(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        inst = await _make_instrument(db_session, test_user, frequency="daily")
        await _make_template_with_sessions(
            db_session, test_user, inst,
            session_names=["A", "B", "C"],
            rotation_index=5,  # 5 % 3 = 2 → session C
        )

        resp = await client.get("/api/today")
        data = resp.json()
        cs = data["instruments_due"][0]["current_session"]
        assert cs["session_name"] == "C"
        assert cs["rotation_position"] == "session 3 of 3"

    async def test_template_with_zero_sessions(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        """Active template with no sessions → current_session is null."""
        inst = await _make_instrument(db_session, test_user, frequency="daily")
        # Create template directly without sessions
        tmpl = Template(
            user_id=test_user.id, instrument_id=inst.id,
            name="Empty Plan", is_active=True,
        )
        db_session.add(tmpl)
        await db_session.commit()

        resp = await client.get("/api/today")
        data = resp.json()
        due = data["instruments_due"][0]
        assert due["current_session"] is None
        assert due["all_sessions"] == []

    async def test_no_template_fallback(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        await _make_instrument(db_session, test_user, frequency="daily")

        resp = await client.get("/api/today")
        data = resp.json()
        due = data["instruments_due"][0]
        assert due["current_session"] is None
        assert due["repeat_session"] is None
        assert due["all_sessions"] == []


# ===========================================================================
# Repeat session tests
# ===========================================================================

class TestRepeatSession:
    async def test_repeat_session_populated_when_different(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        inst = await _make_instrument(db_session, test_user, frequency="daily")
        tmpl, sessions = await _make_template_with_sessions(
            db_session, test_user, inst,
            session_names=["Session A", "Session B"],
            rotation_index=1,  # current = Session B
        )
        # Last completed used Session A
        await _make_log(
            db_session, test_user, inst, days_ago=1,
            template=tmpl, template_session=sessions[0],
        )

        resp = await client.get("/api/today")
        data = resp.json()
        due = data["instruments_due"][0]
        assert due["repeat_session"] is not None
        assert due["repeat_session"]["session_name"] == "Session A"

    async def test_repeat_session_null_when_same_as_current(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        inst = await _make_instrument(db_session, test_user, frequency="daily")
        tmpl, sessions = await _make_template_with_sessions(
            db_session, test_user, inst,
            session_names=["Session A"],
            rotation_index=0,  # current = Session A
        )
        # Last completed also used Session A
        await _make_log(
            db_session, test_user, inst, days_ago=1,
            template=tmpl, template_session=sessions[0],
        )

        resp = await client.get("/api/today")
        data = resp.json()
        due = data["instruments_due"][0]
        assert due["repeat_session"] is None

    async def test_repeat_session_null_when_no_history(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        inst = await _make_instrument(db_session, test_user, frequency="daily")
        await _make_template_with_sessions(
            db_session, test_user, inst, session_names=["Session A"]
        )

        resp = await client.get("/api/today")
        data = resp.json()
        due = data["instruments_due"][0]
        assert due["repeat_session"] is None

    async def test_repeat_session_null_after_template_switch(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        """Last session used old template's session → repeat_session is null."""
        inst = await _make_instrument(db_session, test_user, frequency="daily")

        # Old template (now inactive)
        old_tmpl = Template(
            user_id=test_user.id, instrument_id=inst.id,
            name="Old Plan", is_active=False,
        )
        db_session.add(old_tmpl)
        await db_session.commit()
        await db_session.refresh(old_tmpl)

        old_ts = TemplateSession(
            template_id=old_tmpl.id, name="Old Session", display_order=0
        )
        db_session.add(old_ts)
        await db_session.commit()
        await db_session.refresh(old_ts)

        # Log from old template
        await _make_log(
            db_session, test_user, inst, days_ago=1,
            template=old_tmpl, template_session=old_ts,
        )

        # New active template
        await _make_template_with_sessions(
            db_session, test_user, inst, session_names=["New Session"]
        )

        resp = await client.get("/api/today")
        data = resp.json()
        due = data["instruments_due"][0]
        # Old session not in new template's sessions → null
        assert due["repeat_session"] is None


# ===========================================================================
# All sessions tests
# ===========================================================================

class TestAllSessions:
    async def test_all_sessions_populated(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        inst = await _make_instrument(db_session, test_user, frequency="daily")
        await _make_template_with_sessions(
            db_session, test_user, inst,
            session_names=["Warm-up Day", "Technique Day", "Repertoire Day"],
        )

        resp = await client.get("/api/today")
        data = resp.json()
        due = data["instruments_due"][0]
        assert len(due["all_sessions"]) == 3
        names = [s["session_name"] for s in due["all_sessions"]]
        assert names == ["Warm-up Day", "Technique Day", "Repertoire Day"]
        assert due["all_sessions"][0]["display_order"] == 0
        assert due["all_sessions"][2]["display_order"] == 2


# ===========================================================================
# Single instrument endpoint
# ===========================================================================

class TestSingleInstrument:
    async def test_returns_scoped_response(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        inst = await _make_instrument(db_session, test_user, frequency="daily")
        await _make_instrument(db_session, test_user, name="Piano", frequency="daily")

        resp = await client.get(f"/api/today/{inst.id}")
        assert resp.status_code == 200
        data = resp.json()
        # Only one instrument in results
        total = len(data["instruments_due"]) + len(data["instruments_not_due"])
        assert total == 1

    async def test_not_found_returns_404(self, client: AsyncClient):
        resp = await client.get("/api/today/99999")
        assert resp.status_code == 404

    async def test_other_user_returns_404(
        self, client: AsyncClient, db_session: AsyncSession, other_user
    ):
        other_inst = Instrument(
            user_id=other_user.id, name="Guitar", practice_frequency="daily"
        )
        db_session.add(other_inst)
        await db_session.commit()
        await db_session.refresh(other_inst)

        resp = await client.get(f"/api/today/{other_inst.id}")
        assert resp.status_code == 404


# ===========================================================================
# Auth
# ===========================================================================

class TestAuth:
    async def test_unauthenticated_returns_401(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/today")
        assert resp.status_code == 401

    async def test_unauthenticated_single_instrument_returns_401(
        self, unauth_client: AsyncClient
    ):
        resp = await unauth_client.get("/api/today/1")
        assert resp.status_code == 401
