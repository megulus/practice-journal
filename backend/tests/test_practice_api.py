"""Tests for Practice session lifecycle — core API endpoints."""
import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import (
    Instrument,
    Template,
    TemplateSession,
    Section,
    Block,
    PracticeLog,
    SectionLog,
    BlockLog,
)
from datetime import date as date_type

from app.enums import SessionStatus


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def template_with_blocks(
    db_session: AsyncSession, test_user, test_instrument
):
    """A complete template hierarchy: template → session → 2 sections → blocks."""
    template = Template(
        user_id=test_user.id,
        instrument_id=test_instrument.id,
        name="Bruch concerto",
    )
    db_session.add(template)
    await db_session.commit()
    await db_session.refresh(template)

    ts = TemplateSession(
        template_id=template.id,
        name="Technique focus",
        focus_description="Slow practice",
        display_order=0,
    )
    db_session.add(ts)
    await db_session.commit()
    await db_session.refresh(ts)

    sec1 = Section(
        template_session_id=ts.id,
        name="Warm-up",
        section_type="warmup",
        estimated_duration_minutes=5,
        display_order=0,
    )
    sec2 = Section(
        template_session_id=ts.id,
        name="Scales",
        section_type="scales",
        estimated_duration_minutes=10,
        display_order=1,
    )
    db_session.add_all([sec1, sec2])
    await db_session.commit()
    await db_session.refresh(sec1)
    await db_session.refresh(sec2)

    b1 = Block(
        section_id=sec1.id,
        name="Open strings",
        tempo_bpm=60,
        display_order=0,
    )
    b2 = Block(
        section_id=sec2.id,
        name="G major scale",
        tempo_bpm=72,
        display_order=0,
    )
    b3 = Block(
        section_id=sec2.id,
        name="D minor scale",
        display_order=1,
    )
    db_session.add_all([b1, b2, b3])
    await db_session.commit()
    await db_session.refresh(b1)
    await db_session.refresh(b2)
    await db_session.refresh(b3)

    return template, ts, (sec1, sec2), (b1, b2, b3)


@pytest.fixture
async def started_session(client: AsyncClient, template_with_blocks):
    """Start a practice session and return the response data + fixture objects."""
    template, ts, sections, blocks = template_with_blocks
    resp = await client.post(
        "/api/practice/start",
        json={
            "instrument_id": template.instrument_id,
            "template_id": template.id,
            "template_session_id": ts.id,
        },
    )
    assert resp.status_code == 201
    return resp.json(), template, ts, sections, blocks


@pytest.fixture
async def other_user_log(db_session: AsyncSession, other_user):
    """A practice log belonging to other_user."""
    inst = Instrument(user_id=other_user.id, name="Piano")
    db_session.add(inst)
    await db_session.commit()
    await db_session.refresh(inst)

    log = PracticeLog(
        user_id=other_user.id,
        instrument_id=inst.id,
        practice_date=date_type(2026, 3, 30),
        status=SessionStatus.in_progress.value,
    )
    db_session.add(log)
    await db_session.commit()
    await db_session.refresh(log)

    sl = SectionLog(
        practice_log_id=log.id,
        section_type="warmup",
        section_name="Warm-up",
        actual_duration_minutes=5,
        display_order=0,
    )
    db_session.add(sl)
    await db_session.commit()
    await db_session.refresh(sl)

    bl = BlockLog(
        section_log_id=sl.id,
        block_name="Something",
        display_order=0,
    )
    db_session.add(bl)
    await db_session.commit()
    await db_session.refresh(bl)

    return log, sl, bl


# ===========================================================================
# POST /api/practice/start
# ===========================================================================

class TestStartPractice:
    async def test_start_template_session(
        self, client: AsyncClient, template_with_blocks
    ):
        template, ts, (sec1, sec2), (b1, b2, b3) = template_with_blocks
        resp = await client.post(
            "/api/practice/start",
            json={
                "instrument_id": template.instrument_id,
                "template_id": template.id,
                "template_session_id": ts.id,
            },
        )
        assert resp.status_code == 201
        data = resp.json()

        assert data["status"] == "in_progress"
        assert data["template_id"] == template.id
        assert data["template_session_id"] == ts.id
        assert data["instrument_name"] == "Violin"
        assert data["template_name"] == "Bruch concerto"
        assert data["session_name"] == "Technique focus"

        # Should scaffold 2 section logs
        assert len(data["section_logs"]) == 2
        sl1, sl2 = data["section_logs"]
        assert sl1["section_name"] == "Warm-up"
        assert sl1["section_type"] == "warmup"
        assert sl1["planned_duration_minutes"] == 5
        assert sl1["actual_duration_minutes"] == 5
        assert sl2["section_name"] == "Scales"
        assert sl2["planned_duration_minutes"] == 10

        # Block logs should be scaffolded with completed=false
        assert len(sl1["block_logs"]) == 1
        assert sl1["block_logs"][0]["block_name"] == "Open strings"
        assert sl1["block_logs"][0]["completed"] is False
        assert sl1["block_logs"][0]["rating"] is None

        assert len(sl2["block_logs"]) == 2
        assert sl2["block_logs"][0]["block_name"] == "G major scale"
        assert sl2["block_logs"][1]["block_name"] == "D minor scale"

    async def test_start_freeform_session(
        self, client: AsyncClient, test_instrument
    ):
        resp = await client.post(
            "/api/practice/start",
            json={"instrument_id": test_instrument.id},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "in_progress"
        assert data["template_id"] is None
        assert data["template_session_id"] is None
        assert data["section_logs"] == []

    async def test_instrument_not_found(self, client: AsyncClient):
        resp = await client.post(
            "/api/practice/start",
            json={"instrument_id": 99999},
        )
        assert resp.status_code == 404

    async def test_template_session_not_found(
        self, client: AsyncClient, template_with_blocks
    ):
        template, _, _, _ = template_with_blocks
        resp = await client.post(
            "/api/practice/start",
            json={
                "instrument_id": template.instrument_id,
                "template_id": template.id,
                "template_session_id": 99999,
            },
        )
        assert resp.status_code == 404

    async def test_smart_tempo_defaults(
        self, client: AsyncClient, db_session: AsyncSession,
        template_with_blocks, test_user
    ):
        """After a completed session with tempo data, the next start should
        include last_tempo_bpm on block logs."""
        template, ts, sections, (b1, b2, b3) = template_with_blocks

        # Create a completed session with tempo data on block b2
        log = PracticeLog(
            user_id=test_user.id,
            instrument_id=template.instrument_id,
            template_id=template.id,
            template_session_id=ts.id,
            practice_date=date_type(2026, 3, 29),
            status=SessionStatus.completed.value,
        )
        db_session.add(log)
        await db_session.commit()
        await db_session.refresh(log)

        sl = SectionLog(
            practice_log_id=log.id,
            section_type="scales",
            section_name="Scales",
            actual_duration_minutes=10,
            display_order=0,
        )
        db_session.add(sl)
        await db_session.commit()
        await db_session.refresh(sl)

        # b2 has tempo_bpm=72 on the Block model
        bl = BlockLog(
            section_log_id=sl.id,
            block_id=b2.id,
            block_name="G major scale",
            completed=True,
            display_order=0,
        )
        db_session.add(bl)
        await db_session.commit()

        # Now start a new session — b2 should have last_tempo_bpm=72
        resp = await client.post(
            "/api/practice/start",
            json={
                "instrument_id": template.instrument_id,
                "template_id": template.id,
                "template_session_id": ts.id,
            },
        )
        assert resp.status_code == 201
        data = resp.json()

        # Find the G major scale block log
        scales_section = [s for s in data["section_logs"] if s["section_name"] == "Scales"][0]
        g_major = [b for b in scales_section["block_logs"] if b["block_name"] == "G major scale"][0]
        assert g_major["last_tempo_bpm"] == 72

        # D minor has no previous logs
        d_minor = [b for b in scales_section["block_logs"] if b["block_name"] == "D minor scale"][0]
        assert d_minor["last_tempo_bpm"] is None

    async def test_cannot_start_with_other_users_template(
        self, client: AsyncClient, db_session: AsyncSession,
        test_instrument, other_user
    ):
        """Starting a session with another user's template returns 404."""
        other_inst = Instrument(user_id=other_user.id, name="Piano")
        db_session.add(other_inst)
        await db_session.commit()
        await db_session.refresh(other_inst)

        other_template = Template(
            user_id=other_user.id,
            instrument_id=other_inst.id,
            name="Not mine",
        )
        db_session.add(other_template)
        await db_session.commit()
        await db_session.refresh(other_template)

        other_ts = TemplateSession(
            template_id=other_template.id,
            name="S1",
            display_order=0,
        )
        db_session.add(other_ts)
        await db_session.commit()
        await db_session.refresh(other_ts)

        resp = await client.post(
            "/api/practice/start",
            json={
                "instrument_id": test_instrument.id,
                "template_id": other_template.id,
                "template_session_id": other_ts.id,
            },
        )
        assert resp.status_code == 404

    async def test_template_instrument_mismatch(
        self, client: AsyncClient, db_session: AsyncSession,
        template_with_blocks, test_user
    ):
        """Template must belong to the specified instrument."""
        template, ts, _, _ = template_with_blocks
        other_inst = Instrument(user_id=test_user.id, name="Viola")
        db_session.add(other_inst)
        await db_session.commit()
        await db_session.refresh(other_inst)

        resp = await client.post(
            "/api/practice/start",
            json={
                "instrument_id": other_inst.id,
                "template_id": template.id,
                "template_session_id": ts.id,
            },
        )
        assert resp.status_code == 404

    async def test_partial_template_ids_returns_422(
        self, client: AsyncClient, template_with_blocks
    ):
        """Providing template_id without template_session_id is rejected."""
        template, ts, _, _ = template_with_blocks
        resp = await client.post(
            "/api/practice/start",
            json={
                "instrument_id": template.instrument_id,
                "template_id": template.id,
            },
        )
        assert resp.status_code == 422

        resp = await client.post(
            "/api/practice/start",
            json={
                "instrument_id": template.instrument_id,
                "template_session_id": ts.id,
            },
        )
        assert resp.status_code == 422

    async def test_practice_date_is_today(
        self, client: AsyncClient, test_instrument
    ):
        resp = await client.post(
            "/api/practice/start",
            json={"instrument_id": test_instrument.id},
        )
        assert resp.status_code == 201
        assert resp.json()["practice_date"] == date_type.today().isoformat()


# ===========================================================================
# GET /api/practice/{logId}
# ===========================================================================

class TestGetPractice:
    async def test_get_session(self, client: AsyncClient, started_session):
        data, _, _, _, _ = started_session
        resp = await client.get(f"/api/practice/{data['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == data["id"]
        assert len(resp.json()["section_logs"]) == 2

    async def test_not_found(self, client: AsyncClient):
        resp = await client.get("/api/practice/99999")
        assert resp.status_code == 404

    async def test_cannot_get_other_users_log(
        self, client: AsyncClient, other_user_log
    ):
        log, _, _ = other_user_log
        resp = await client.get(f"/api/practice/{log.id}")
        assert resp.status_code == 404


# ===========================================================================
# PATCH /api/practice/{logId}
# ===========================================================================

class TestUpdatePractice:
    async def test_update_notes(self, client: AsyncClient, started_session):
        data, _, _, _, _ = started_session
        resp = await client.patch(
            f"/api/practice/{data['id']}",
            json={"notes": "Good session today"},
        )
        assert resp.status_code == 200
        assert resp.json()["notes"] == "Good session today"

    async def test_abandon_session(self, client: AsyncClient, started_session):
        data, _, _, _, _ = started_session
        resp = await client.patch(
            f"/api/practice/{data['id']}",
            json={"status": "abandoned"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "abandoned"

    async def test_empty_body_no_change(
        self, client: AsyncClient, started_session
    ):
        data, _, _, _, _ = started_session
        resp = await client.patch(
            f"/api/practice/{data['id']}", json={}
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_progress"

    async def test_not_found(self, client: AsyncClient):
        resp = await client.patch(
            "/api/practice/99999", json={"notes": "Nope"}
        )
        assert resp.status_code == 404

    async def test_cannot_update_other_users_log(
        self, client: AsyncClient, other_user_log
    ):
        log, _, _ = other_user_log
        resp = await client.patch(
            f"/api/practice/{log.id}", json={"notes": "Stolen"}
        )
        assert resp.status_code == 404

    async def test_invalid_status_returns_422(
        self, client: AsyncClient, started_session
    ):
        data, _, _, _, _ = started_session
        resp = await client.patch(
            f"/api/practice/{data['id']}",
            json={"status": "invalid_status"},
        )
        assert resp.status_code == 422

    async def test_completed_status_returns_422(
        self, client: AsyncClient, started_session
    ):
        """Cannot set status=completed via PATCH — must use finish endpoint."""
        data, _, _, _, _ = started_session
        resp = await client.patch(
            f"/api/practice/{data['id']}",
            json={"status": "completed"},
        )
        assert resp.status_code == 422


# ===========================================================================
# PUT /api/practice/{logId}/sections/{sectionLogId}
# ===========================================================================

class TestUpdateSectionLog:
    async def test_update_actual_duration(
        self, client: AsyncClient, started_session
    ):
        data, _, _, _, _ = started_session
        sl_id = data["section_logs"][0]["id"]
        resp = await client.put(
            f"/api/practice/{data['id']}/sections/{sl_id}",
            json={"actual_duration_minutes": 8},
        )
        assert resp.status_code == 200
        assert resp.json()["actual_duration_minutes"] == 8

    async def test_mark_all_done(self, client: AsyncClient, started_session):
        """mark_all_done sets completed=true on all block logs."""
        data, _, _, _, _ = started_session
        # Scales section has 2 blocks, both start as completed=false
        sl = data["section_logs"][1]
        assert sl["section_name"] == "Scales"
        assert all(b["completed"] is False for b in sl["block_logs"])

        resp = await client.put(
            f"/api/practice/{data['id']}/sections/{sl['id']}",
            json={"mark_all_done": True},
        )
        assert resp.status_code == 200
        result = resp.json()
        assert all(b["completed"] is True for b in result["block_logs"])
        # Ratings should remain null (mark_all_done doesn't set ratings)
        assert all(b["rating"] is None for b in result["block_logs"])

    async def test_skip_section(self, client: AsyncClient, started_session):
        """Setting completed=false cascades to all block logs."""
        data, _, _, _, _ = started_session
        sl = data["section_logs"][0]

        resp = await client.put(
            f"/api/practice/{data['id']}/sections/{sl['id']}",
            json={"completed": False},
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["completed"] is False
        assert all(b["completed"] is False for b in result["block_logs"])

    async def test_not_found(self, client: AsyncClient, started_session):
        data, _, _, _, _ = started_session
        resp = await client.put(
            f"/api/practice/{data['id']}/sections/99999",
            json={"actual_duration_minutes": 5},
        )
        assert resp.status_code == 404

    async def test_section_log_wrong_practice_log(
        self, client: AsyncClient, db_session: AsyncSession,
        started_session, test_instrument, test_user
    ):
        """A section log from a different practice log returns 404."""
        data, _, _, _, _ = started_session
        # Create another practice log with a section log
        log2 = PracticeLog(
            user_id=test_user.id,
            instrument_id=test_instrument.id,
            practice_date=date_type(2026, 3, 30),
            status=SessionStatus.in_progress.value,
        )
        db_session.add(log2)
        await db_session.commit()
        await db_session.refresh(log2)

        sl2 = SectionLog(
            practice_log_id=log2.id,
            section_type="warmup",
            section_name="Warm-up",
            actual_duration_minutes=5,
            display_order=0,
        )
        db_session.add(sl2)
        await db_session.commit()
        await db_session.refresh(sl2)

        # Try to access sl2 via the first practice log
        resp = await client.put(
            f"/api/practice/{data['id']}/sections/{sl2.id}",
            json={"actual_duration_minutes": 5},
        )
        assert resp.status_code == 404

    async def test_cannot_update_other_users_section_log(
        self, client: AsyncClient, other_user_log
    ):
        log, sl, _ = other_user_log
        resp = await client.put(
            f"/api/practice/{log.id}/sections/{sl.id}",
            json={"actual_duration_minutes": 5},
        )
        assert resp.status_code == 404

    async def test_negative_duration_returns_422(
        self, client: AsyncClient, started_session
    ):
        data, _, _, _, _ = started_session
        sl_id = data["section_logs"][0]["id"]
        resp = await client.put(
            f"/api/practice/{data['id']}/sections/{sl_id}",
            json={"actual_duration_minutes": -1},
        )
        assert resp.status_code == 422

    async def test_mark_all_done_and_skip_conflict_returns_422(
        self, client: AsyncClient, started_session
    ):
        """Cannot mark_all_done and skip in the same request."""
        data, _, _, _, _ = started_session
        sl_id = data["section_logs"][0]["id"]
        resp = await client.put(
            f"/api/practice/{data['id']}/sections/{sl_id}",
            json={"mark_all_done": True, "completed": False},
        )
        assert resp.status_code == 422


# ===========================================================================
# PUT /api/practice/{logId}/blocks/{blockLogId}
# ===========================================================================

class TestUpdateBlockLog:
    async def test_update_rating(self, client: AsyncClient, started_session):
        data, _, _, _, _ = started_session
        bl = data["section_logs"][0]["block_logs"][0]
        resp = await client.put(
            f"/api/practice/{data['id']}/blocks/{bl['id']}",
            json={"rating": 1, "completed": True},
        )
        assert resp.status_code == 200
        assert resp.json()["rating"] == 1
        assert resp.json()["completed"] is True

    async def test_update_notes(self, client: AsyncClient, started_session):
        data, _, _, _, _ = started_session
        bl = data["section_logs"][0]["block_logs"][0]
        resp = await client.put(
            f"/api/practice/{data['id']}/blocks/{bl['id']}",
            json={"notes": "Intonation shaky in top octave"},
        )
        assert resp.status_code == 200
        assert resp.json()["notes"] == "Intonation shaky in top octave"

    async def test_rating_step_back(
        self, client: AsyncClient, started_session
    ):
        data, _, _, _, _ = started_session
        bl = data["section_logs"][0]["block_logs"][0]
        resp = await client.put(
            f"/api/practice/{data['id']}/blocks/{bl['id']}",
            json={"rating": -1},
        )
        assert resp.status_code == 200
        assert resp.json()["rating"] == -1

    async def test_rating_validation(
        self, client: AsyncClient, started_session
    ):
        data, _, _, _, _ = started_session
        bl = data["section_logs"][0]["block_logs"][0]

        # Rating must be -1, 0, or 1
        resp = await client.put(
            f"/api/practice/{data['id']}/blocks/{bl['id']}",
            json={"rating": 2},
        )
        assert resp.status_code == 422

        resp = await client.put(
            f"/api/practice/{data['id']}/blocks/{bl['id']}",
            json={"rating": -2},
        )
        assert resp.status_code == 422

    async def test_not_found(self, client: AsyncClient, started_session):
        data, _, _, _, _ = started_session
        resp = await client.put(
            f"/api/practice/{data['id']}/blocks/99999",
            json={"rating": 0},
        )
        assert resp.status_code == 404

    async def test_block_log_wrong_practice_log(
        self, client: AsyncClient, db_session: AsyncSession,
        started_session, test_instrument, test_user
    ):
        """A block log from a different practice log returns 404."""
        data, _, _, _, _ = started_session
        log2 = PracticeLog(
            user_id=test_user.id,
            instrument_id=test_instrument.id,
            practice_date=date_type(2026, 3, 30),
            status=SessionStatus.in_progress.value,
        )
        db_session.add(log2)
        await db_session.commit()
        await db_session.refresh(log2)

        sl2 = SectionLog(
            practice_log_id=log2.id,
            section_type="warmup",
            section_name="Warm-up",
            actual_duration_minutes=5,
            display_order=0,
        )
        db_session.add(sl2)
        await db_session.commit()
        await db_session.refresh(sl2)

        bl2 = BlockLog(
            section_log_id=sl2.id,
            block_name="Test",
            display_order=0,
        )
        db_session.add(bl2)
        await db_session.commit()
        await db_session.refresh(bl2)

        resp = await client.put(
            f"/api/practice/{data['id']}/blocks/{bl2.id}",
            json={"rating": 0},
        )
        assert resp.status_code == 404

    async def test_cannot_update_other_users_block_log(
        self, client: AsyncClient, other_user_log
    ):
        log, _, bl = other_user_log
        resp = await client.put(
            f"/api/practice/{log.id}/blocks/{bl.id}",
            json={"rating": 0},
        )
        assert resp.status_code == 404

    async def test_empty_body_no_change(
        self, client: AsyncClient, started_session
    ):
        data, _, _, _, _ = started_session
        bl = data["section_logs"][0]["block_logs"][0]
        resp = await client.put(
            f"/api/practice/{data['id']}/blocks/{bl['id']}",
            json={},
        )
        assert resp.status_code == 200
        assert resp.json()["rating"] is None
        assert resp.json()["completed"] is False
