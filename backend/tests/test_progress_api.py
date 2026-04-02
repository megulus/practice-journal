"""Tests for /api/progress/history endpoints."""
import pytest
from datetime import date, datetime, timedelta, timezone
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import (
    Instrument, Template, TemplateSession, Section, PracticeLog,
    SectionLog, BlockLog,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _days_ago(n: int) -> date:
    return datetime.now(timezone.utc).date() - timedelta(days=n)


async def _make_instrument(db, user, *, name="Violin", **kw):
    inst = Instrument(user_id=user.id, name=name, practice_frequency="daily", **kw)
    db.add(inst)
    await db.commit()
    await db.refresh(inst)
    return inst


async def _make_template_with_sessions(db, user, instrument, *, session_count=3):
    """Create a template with N sessions, each with a warmup section and one block."""
    tmpl = Template(
        user_id=user.id, instrument_id=instrument.id,
        name="Practice Plan", is_active=True,
    )
    db.add(tmpl)
    await db.commit()
    await db.refresh(tmpl)

    sessions = []
    for i in range(session_count):
        ts = TemplateSession(
            template_id=tmpl.id, name=f"Session {i + 1}", display_order=i,
        )
        db.add(ts)
        await db.commit()
        await db.refresh(ts)
        sessions.append(ts)

        section = Section(
            template_session_id=ts.id, name="Warm-up",
            section_type="warmup", estimated_duration_minutes=10, display_order=0,
        )
        db.add(section)
        await db.commit()

    return tmpl, sessions


async def _make_completed_log(
    db, user, instrument, *, days_ago=0, template=None, template_session=None,
    duration=30, with_blocks=False,
):
    """Create a completed practice log, optionally with section/block logs."""
    log = PracticeLog(
        user_id=user.id, instrument_id=instrument.id,
        status="completed", practice_date=_days_ago(days_ago),
        total_duration_minutes=duration,
        template_id=template.id if template else None,
        template_session_id=template_session.id if template_session else None,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)

    if with_blocks:
        sl = SectionLog(
            practice_log_id=log.id, section_type="warmup",
            section_name="Warm-up", actual_duration_minutes=10, display_order=0,
        )
        db.add(sl)
        await db.commit()
        await db.refresh(sl)

        for j in range(3):
            bl = BlockLog(
                section_log_id=sl.id, block_name=f"Exercise {j + 1}",
                completed=True, display_order=j,
            )
            db.add(bl)
        await db.commit()

    return log


# ===========================================================================
# History list tests
# ===========================================================================

class TestHistoryList:
    async def test_empty_history(self, client: AsyncClient, db_session, test_user):
        resp = await client.get("/api/progress/history")
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["next_cursor"] is None

    async def test_returns_completed_only(
        self, client: AsyncClient, db_session, test_user
    ):
        inst = await _make_instrument(db_session, test_user)
        await _make_completed_log(db_session, test_user, inst, days_ago=1)
        # These should not appear
        in_prog = PracticeLog(
            user_id=test_user.id, instrument_id=inst.id,
            status="in_progress", practice_date=_days_ago(0),
        )
        abandoned = PracticeLog(
            user_id=test_user.id, instrument_id=inst.id,
            status="abandoned", practice_date=_days_ago(2),
        )
        db_session.add_all([in_prog, abandoned])
        await db_session.commit()

        resp = await client.get("/api/progress/history")
        data = resp.json()
        assert len(data["items"]) == 1

    async def test_instrument_filter(
        self, client: AsyncClient, db_session, test_user
    ):
        violin = await _make_instrument(db_session, test_user, name="Violin")
        piano = await _make_instrument(db_session, test_user, name="Piano")
        await _make_completed_log(db_session, test_user, violin, days_ago=1)
        await _make_completed_log(db_session, test_user, piano, days_ago=1)

        resp = await client.get(f"/api/progress/history?instrument_id={violin.id}")
        data = resp.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["instrument_name"] == "Violin"

    async def test_period_week(
        self, client: AsyncClient, db_session, test_user
    ):
        inst = await _make_instrument(db_session, test_user)
        await _make_completed_log(db_session, test_user, inst, days_ago=3)  # within
        await _make_completed_log(db_session, test_user, inst, days_ago=10)  # outside

        resp = await client.get("/api/progress/history?period=week")
        data = resp.json()
        assert len(data["items"]) == 1

    async def test_period_month(
        self, client: AsyncClient, db_session, test_user
    ):
        inst = await _make_instrument(db_session, test_user)
        await _make_completed_log(db_session, test_user, inst, days_ago=15)  # within
        await _make_completed_log(db_session, test_user, inst, days_ago=45)  # outside

        resp = await client.get("/api/progress/history?period=month")
        data = resp.json()
        assert len(data["items"]) == 1

    async def test_pagination(
        self, client: AsyncClient, db_session, test_user
    ):
        inst = await _make_instrument(db_session, test_user)
        # Create 5 logs
        for i in range(5):
            await _make_completed_log(db_session, test_user, inst, days_ago=i)

        # Page 1 with limit=3
        resp = await client.get("/api/progress/history?limit=3")
        data = resp.json()
        assert len(data["items"]) == 3
        assert data["next_cursor"] is not None

        # Page 2
        resp2 = await client.get(
            f"/api/progress/history?limit=3&cursor={data['next_cursor']}"
        )
        data2 = resp2.json()
        assert len(data2["items"]) == 2
        assert data2["next_cursor"] is None

        # No overlap between pages
        page1_ids = {i["id"] for i in data["items"]}
        page2_ids = {i["id"] for i in data2["items"]}
        assert page1_ids.isdisjoint(page2_ids)

    async def test_cursor_exhaustion(
        self, client: AsyncClient, db_session, test_user
    ):
        inst = await _make_instrument(db_session, test_user)
        await _make_completed_log(db_session, test_user, inst)

        resp = await client.get("/api/progress/history?limit=10")
        data = resp.json()
        assert len(data["items"]) == 1
        assert data["next_cursor"] is None

    async def test_history_item_fields(
        self, client: AsyncClient, db_session, test_user
    ):
        inst = await _make_instrument(db_session, test_user)
        tmpl, sessions = await _make_template_with_sessions(
            db_session, test_user, inst, session_count=3
        )
        await _make_completed_log(
            db_session, test_user, inst, days_ago=1,
            template=tmpl, template_session=sessions[1],
            duration=25, with_blocks=True,
        )

        resp = await client.get("/api/progress/history")
        data = resp.json()
        item = data["items"][0]
        assert item["instrument_name"] == "Violin"
        assert item["session_name"] == "Session 2"
        assert item["template_name"] == "Practice Plan"
        assert item["rotation_label"] == "session 2 of 3"
        assert item["total_duration_minutes"] == 25
        assert item["exercise_count"] == 3
        assert item["is_freeform"] is False

    async def test_freeform_log(
        self, client: AsyncClient, db_session, test_user
    ):
        inst = await _make_instrument(db_session, test_user)
        await _make_completed_log(db_session, test_user, inst, days_ago=1)

        resp = await client.get("/api/progress/history")
        data = resp.json()
        item = data["items"][0]
        assert item["is_freeform"] is True
        assert item["session_name"] is None
        assert item["template_name"] is None
        assert item["rotation_label"] is None

    async def test_other_user_excluded(
        self, client: AsyncClient, db_session, test_user, other_user
    ):
        other_inst = Instrument(
            user_id=other_user.id, name="Guitar", practice_frequency="daily"
        )
        db_session.add(other_inst)
        await db_session.commit()
        await db_session.refresh(other_inst)

        other_log = PracticeLog(
            user_id=other_user.id, instrument_id=other_inst.id,
            status="completed", practice_date=_days_ago(1),
            total_duration_minutes=20,
        )
        db_session.add(other_log)
        await db_session.commit()

        resp = await client.get("/api/progress/history")
        data = resp.json()
        assert len(data["items"]) == 0

    async def test_ordered_most_recent_first(
        self, client: AsyncClient, db_session, test_user
    ):
        inst = await _make_instrument(db_session, test_user)
        await _make_completed_log(db_session, test_user, inst, days_ago=5)
        await _make_completed_log(db_session, test_user, inst, days_ago=1)

        resp = await client.get("/api/progress/history")
        data = resp.json()
        dates = [i["practice_date"] for i in data["items"]]
        assert dates == sorted(dates, reverse=True)


# ===========================================================================
# History detail tests
# ===========================================================================

class TestHistoryDetail:
    async def test_returns_full_detail(
        self, client: AsyncClient, db_session, test_user
    ):
        inst = await _make_instrument(db_session, test_user)
        log = await _make_completed_log(
            db_session, test_user, inst, with_blocks=True,
        )

        resp = await client.get(f"/api/progress/history/{log.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == log.id
        assert data["status"] == "completed"
        assert len(data["section_logs"]) == 1
        assert len(data["section_logs"][0]["block_logs"]) == 3

    async def test_not_found(self, client: AsyncClient):
        resp = await client.get("/api/progress/history/99999")
        assert resp.status_code == 404

    async def test_excludes_non_completed(
        self, client: AsyncClient, db_session, test_user
    ):
        inst = await _make_instrument(db_session, test_user)
        log = PracticeLog(
            user_id=test_user.id, instrument_id=inst.id,
            status="in_progress", practice_date=_days_ago(0),
        )
        db_session.add(log)
        await db_session.commit()
        await db_session.refresh(log)

        resp = await client.get(f"/api/progress/history/{log.id}")
        assert resp.status_code == 404


# ===========================================================================
# Auth
# ===========================================================================

class TestAuth:
    async def test_unauthenticated_list_returns_401(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/progress/history")
        assert resp.status_code == 401

    async def test_unauthenticated_detail_returns_401(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/progress/history/1")
        assert resp.status_code == 401
