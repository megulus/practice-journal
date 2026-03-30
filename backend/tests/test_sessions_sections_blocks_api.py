"""Tests for Sessions, Sections, and Blocks CRUD API endpoints."""
import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import (
    CuratedBlock,
    Instrument,
    Template,
    TemplateSession,
    Section,
    Block,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def template_with_session(
    db_session: AsyncSession, test_user, test_instrument
):
    """A template with one session (no sections)."""
    template = Template(
        user_id=test_user.id,
        instrument_id=test_instrument.id,
        name="Test Plan",
    )
    db_session.add(template)
    await db_session.commit()
    await db_session.refresh(template)

    ts = TemplateSession(
        template_id=template.id,
        name="Session 1",
        display_order=0,
    )
    db_session.add(ts)
    await db_session.commit()
    await db_session.refresh(ts)
    return template, ts


@pytest.fixture
async def full_hierarchy(db_session: AsyncSession, template_with_session):
    """Template → session → section → block."""
    template, ts = template_with_session

    section = Section(
        template_session_id=ts.id,
        name="Warm-up",
        section_type="warmup",
        estimated_duration_minutes=5,
        display_order=0,
    )
    db_session.add(section)
    await db_session.commit()
    await db_session.refresh(section)

    block = Block(
        section_id=section.id,
        name="Open strings",
        display_order=0,
    )
    db_session.add(block)
    await db_session.commit()
    await db_session.refresh(block)

    return template, ts, section, block


@pytest.fixture
async def other_user_template(db_session: AsyncSession, other_user):
    """A template belonging to other_user, for isolation tests."""
    inst = Instrument(user_id=other_user.id, name="Piano")
    db_session.add(inst)
    await db_session.commit()
    await db_session.refresh(inst)

    template = Template(
        user_id=other_user.id,
        instrument_id=inst.id,
        name="Other Plan",
    )
    db_session.add(template)
    await db_session.commit()
    await db_session.refresh(template)

    ts = TemplateSession(
        template_id=template.id, name="S1", display_order=0
    )
    db_session.add(ts)
    await db_session.commit()
    await db_session.refresh(ts)

    sec = Section(
        template_session_id=ts.id,
        name="Scales",
        section_type="scales",
        estimated_duration_minutes=10,
        display_order=0,
    )
    db_session.add(sec)
    await db_session.commit()
    await db_session.refresh(sec)

    block = Block(section_id=sec.id, name="G major", display_order=0)
    db_session.add(block)
    await db_session.commit()
    await db_session.refresh(block)

    return template, ts, sec, block


# ===========================================================================
# Template Session tests
# ===========================================================================

class TestCreateSession:
    async def test_create_session(self, client: AsyncClient, template_with_session):
        template, _ = template_with_session
        resp = await client.post(
            f"/api/templates/{template.id}/sessions",
            json={"name": "Repertoire day", "focus_description": "Run-through"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Repertoire day"
        assert data["focus_description"] == "Run-through"
        assert data["display_order"] == 1  # after existing session 0
        assert data["sections"] == []
        assert data["estimated_duration_minutes"] == 0

    async def test_auto_increments_display_order(
        self, client: AsyncClient, template_with_session
    ):
        template, _ = template_with_session
        resp1 = await client.post(
            f"/api/templates/{template.id}/sessions",
            json={"name": "Session 2"},
        )
        resp2 = await client.post(
            f"/api/templates/{template.id}/sessions",
            json={"name": "Session 3"},
        )
        assert resp1.json()["display_order"] == 1
        assert resp2.json()["display_order"] == 2

    async def test_template_not_found(self, client: AsyncClient):
        resp = await client.post(
            "/api/templates/99999/sessions",
            json={"name": "Nope"},
        )
        assert resp.status_code == 404

    async def test_cannot_create_on_other_users_template(
        self, client: AsyncClient, other_user_template
    ):
        template, _, _, _ = other_user_template
        resp = await client.post(
            f"/api/templates/{template.id}/sessions",
            json={"name": "Stolen"},
        )
        assert resp.status_code == 404

    async def test_empty_name_returns_422(
        self, client: AsyncClient, template_with_session
    ):
        template, _ = template_with_session
        resp = await client.post(
            f"/api/templates/{template.id}/sessions",
            json={"name": ""},
        )
        assert resp.status_code == 422

    async def test_missing_name_returns_422(
        self, client: AsyncClient, template_with_session
    ):
        template, _ = template_with_session
        resp = await client.post(
            f"/api/templates/{template.id}/sessions",
            json={},
        )
        assert resp.status_code == 422


class TestUpdateSession:
    async def test_update_name(self, client: AsyncClient, template_with_session):
        _, ts = template_with_session
        resp = await client.patch(
            f"/api/sessions/{ts.id}",
            json={"name": "Renamed"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Renamed"

    async def test_update_focus_description(
        self, client: AsyncClient, template_with_session
    ):
        _, ts = template_with_session
        resp = await client.patch(
            f"/api/sessions/{ts.id}",
            json={"focus_description": "Slow practice on mvt. II"},
        )
        assert resp.status_code == 200
        assert resp.json()["focus_description"] == "Slow practice on mvt. II"

    async def test_empty_body_no_change(
        self, client: AsyncClient, template_with_session
    ):
        _, ts = template_with_session
        resp = await client.patch(f"/api/sessions/{ts.id}", json={})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Session 1"

    async def test_not_found(self, client: AsyncClient):
        resp = await client.patch(
            "/api/sessions/99999", json={"name": "Nope"}
        )
        assert resp.status_code == 404

    async def test_cannot_update_other_users_session(
        self, client: AsyncClient, other_user_template
    ):
        _, ts, _, _ = other_user_template
        resp = await client.patch(
            f"/api/sessions/{ts.id}", json={"name": "Stolen"}
        )
        assert resp.status_code == 404

    async def test_empty_name_returns_422(
        self, client: AsyncClient, template_with_session
    ):
        _, ts = template_with_session
        resp = await client.patch(
            f"/api/sessions/{ts.id}", json={"name": ""}
        )
        assert resp.status_code == 422


class TestDeleteSession:
    async def test_delete_session(
        self, client: AsyncClient, db_session: AsyncSession, template_with_session
    ):
        _, ts = template_with_session
        resp = await client.delete(f"/api/sessions/{ts.id}")
        assert resp.status_code == 204

        result = await db_session.exec(
            select(TemplateSession).where(TemplateSession.id == ts.id)
        )
        assert result.first() is None  # hard delete via cascade

    async def test_reorders_remaining_sessions(
        self, client: AsyncClient, db_session: AsyncSession, template_with_session
    ):
        template, ts0 = template_with_session
        # Add two more sessions
        ts1 = TemplateSession(
            template_id=template.id, name="S2", display_order=1
        )
        ts2 = TemplateSession(
            template_id=template.id, name="S3", display_order=2
        )
        db_session.add_all([ts1, ts2])
        await db_session.commit()
        await db_session.refresh(ts1)
        await db_session.refresh(ts2)

        # Delete the first session
        await client.delete(f"/api/sessions/{ts0.id}")

        # Remaining sessions should have orders 0, 1
        await db_session.refresh(ts1)
        await db_session.refresh(ts2)
        assert ts1.display_order == 0
        assert ts2.display_order == 1

    async def test_cascades_to_sections_and_blocks(
        self, client: AsyncClient, db_session: AsyncSession, full_hierarchy
    ):
        _, ts, section, block = full_hierarchy

        await client.delete(f"/api/sessions/{ts.id}")

        result = await db_session.exec(
            select(Section).where(Section.id == section.id)
        )
        assert result.first() is None

        result = await db_session.exec(
            select(Block).where(Block.id == block.id)
        )
        assert result.first() is None

    async def test_not_found(self, client: AsyncClient):
        resp = await client.delete("/api/sessions/99999")
        assert resp.status_code == 404

    async def test_cannot_delete_other_users_session(
        self, client: AsyncClient, other_user_template
    ):
        _, ts, _, _ = other_user_template
        resp = await client.delete(f"/api/sessions/{ts.id}")
        assert resp.status_code == 404


class TestReorderSessions:
    async def test_reorder(
        self, client: AsyncClient, db_session: AsyncSession, template_with_session
    ):
        template, ts0 = template_with_session
        ts1 = TemplateSession(
            template_id=template.id, name="S2", display_order=1
        )
        db_session.add(ts1)
        await db_session.commit()
        await db_session.refresh(ts1)

        resp = await client.put(
            f"/api/templates/{template.id}/sessions/reorder",
            json={"ordered_ids": [ts1.id, ts0.id]},
        )
        assert resp.status_code == 204

        await db_session.refresh(ts0)
        await db_session.refresh(ts1)
        assert ts1.display_order == 0
        assert ts0.display_order == 1

    async def test_mismatched_ids_returns_400(
        self, client: AsyncClient, template_with_session
    ):
        template, ts0 = template_with_session
        resp = await client.put(
            f"/api/templates/{template.id}/sessions/reorder",
            json={"ordered_ids": [ts0.id, 99999]},
        )
        assert resp.status_code == 400

    async def test_missing_ids_returns_400(
        self, client: AsyncClient, db_session: AsyncSession, template_with_session
    ):
        template, ts0 = template_with_session
        ts1 = TemplateSession(
            template_id=template.id, name="S2", display_order=1
        )
        db_session.add(ts1)
        await db_session.commit()

        # Only provide one of two IDs
        resp = await client.put(
            f"/api/templates/{template.id}/sessions/reorder",
            json={"ordered_ids": [ts0.id]},
        )
        assert resp.status_code == 400

    async def test_template_not_found(self, client: AsyncClient):
        resp = await client.put(
            "/api/templates/99999/sessions/reorder",
            json={"ordered_ids": []},
        )
        assert resp.status_code == 404


# ===========================================================================
# Section tests
# ===========================================================================

class TestCreateSection:
    async def test_create_section(
        self, client: AsyncClient, template_with_session
    ):
        _, ts = template_with_session
        resp = await client.post(
            f"/api/sessions/{ts.id}/sections",
            json={
                "name": "Scales",
                "section_type": "scales",
                "estimated_duration_minutes": 10,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Scales"
        assert data["section_type"] == "scales"
        assert data["estimated_duration_minutes"] == 10
        assert data["display_order"] == 0
        assert data["blocks"] == []

    async def test_default_duration(
        self, client: AsyncClient, template_with_session
    ):
        _, ts = template_with_session
        resp = await client.post(
            f"/api/sessions/{ts.id}/sections",
            json={"name": "Warm-up", "section_type": "warmup"},
        )
        assert resp.status_code == 201
        assert resp.json()["estimated_duration_minutes"] == 5  # default

    async def test_auto_increments_display_order(
        self, client: AsyncClient, template_with_session
    ):
        _, ts = template_with_session
        resp1 = await client.post(
            f"/api/sessions/{ts.id}/sections",
            json={"name": "A", "section_type": "warmup"},
        )
        resp2 = await client.post(
            f"/api/sessions/{ts.id}/sections",
            json={"name": "B", "section_type": "scales"},
        )
        assert resp1.json()["display_order"] == 0
        assert resp2.json()["display_order"] == 1

    async def test_invalid_section_type_returns_422(
        self, client: AsyncClient, template_with_session
    ):
        _, ts = template_with_session
        resp = await client.post(
            f"/api/sessions/{ts.id}/sections",
            json={"name": "Bad", "section_type": "invalid_type"},
        )
        assert resp.status_code == 422

    async def test_session_not_found(self, client: AsyncClient):
        resp = await client.post(
            "/api/sessions/99999/sections",
            json={"name": "Nope", "section_type": "warmup"},
        )
        assert resp.status_code == 404

    async def test_cannot_create_on_other_users_session(
        self, client: AsyncClient, other_user_template
    ):
        _, ts, _, _ = other_user_template
        resp = await client.post(
            f"/api/sessions/{ts.id}/sections",
            json={"name": "Stolen", "section_type": "warmup"},
        )
        assert resp.status_code == 404

    async def test_empty_name_returns_422(
        self, client: AsyncClient, template_with_session
    ):
        _, ts = template_with_session
        resp = await client.post(
            f"/api/sessions/{ts.id}/sections",
            json={"name": "", "section_type": "warmup"},
        )
        assert resp.status_code == 422


class TestUpdateSection:
    async def test_update_name(self, client: AsyncClient, full_hierarchy):
        _, _, section, _ = full_hierarchy
        resp = await client.patch(
            f"/api/sections/{section.id}",
            json={"name": "Cool-down"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Cool-down"

    async def test_update_section_type(self, client: AsyncClient, full_hierarchy):
        _, _, section, _ = full_hierarchy
        resp = await client.patch(
            f"/api/sections/{section.id}",
            json={"section_type": "cooldown"},
        )
        assert resp.status_code == 200
        assert resp.json()["section_type"] == "cooldown"

    async def test_update_duration(self, client: AsyncClient, full_hierarchy):
        _, _, section, _ = full_hierarchy
        resp = await client.patch(
            f"/api/sections/{section.id}",
            json={"estimated_duration_minutes": 15},
        )
        assert resp.status_code == 200
        assert resp.json()["estimated_duration_minutes"] == 15

    async def test_empty_body_no_change(
        self, client: AsyncClient, full_hierarchy
    ):
        _, _, section, _ = full_hierarchy
        resp = await client.patch(f"/api/sections/{section.id}", json={})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Warm-up"

    async def test_not_found(self, client: AsyncClient):
        resp = await client.patch(
            "/api/sections/99999", json={"name": "Nope"}
        )
        assert resp.status_code == 404

    async def test_cannot_update_other_users_section(
        self, client: AsyncClient, other_user_template
    ):
        _, _, sec, _ = other_user_template
        resp = await client.patch(
            f"/api/sections/{sec.id}", json={"name": "Stolen"}
        )
        assert resp.status_code == 404


class TestDeleteSection:
    async def test_delete_section(
        self, client: AsyncClient, db_session: AsyncSession, full_hierarchy
    ):
        _, _, section, _ = full_hierarchy
        resp = await client.delete(f"/api/sections/{section.id}")
        assert resp.status_code == 204

        result = await db_session.exec(
            select(Section).where(Section.id == section.id)
        )
        assert result.first() is None

    async def test_cascades_to_blocks(
        self, client: AsyncClient, db_session: AsyncSession, full_hierarchy
    ):
        _, _, section, block = full_hierarchy
        await client.delete(f"/api/sections/{section.id}")

        result = await db_session.exec(
            select(Block).where(Block.id == block.id)
        )
        assert result.first() is None

    async def test_reorders_remaining_sections(
        self, client: AsyncClient, db_session: AsyncSession, full_hierarchy
    ):
        _, ts, sec0, _ = full_hierarchy
        sec1 = Section(
            template_session_id=ts.id,
            name="Scales",
            section_type="scales",
            estimated_duration_minutes=10,
            display_order=1,
        )
        sec2 = Section(
            template_session_id=ts.id,
            name="Repertoire",
            section_type="repertoire",
            estimated_duration_minutes=15,
            display_order=2,
        )
        db_session.add_all([sec1, sec2])
        await db_session.commit()
        await db_session.refresh(sec1)
        await db_session.refresh(sec2)

        await client.delete(f"/api/sections/{sec0.id}")

        await db_session.refresh(sec1)
        await db_session.refresh(sec2)
        assert sec1.display_order == 0
        assert sec2.display_order == 1

    async def test_not_found(self, client: AsyncClient):
        resp = await client.delete("/api/sections/99999")
        assert resp.status_code == 404

    async def test_cannot_delete_other_users_section(
        self, client: AsyncClient, other_user_template
    ):
        _, _, sec, _ = other_user_template
        resp = await client.delete(f"/api/sections/{sec.id}")
        assert resp.status_code == 404


class TestReorderSections:
    async def test_reorder(
        self, client: AsyncClient, db_session: AsyncSession, full_hierarchy
    ):
        _, ts, sec0, _ = full_hierarchy
        sec1 = Section(
            template_session_id=ts.id,
            name="Scales",
            section_type="scales",
            estimated_duration_minutes=10,
            display_order=1,
        )
        db_session.add(sec1)
        await db_session.commit()
        await db_session.refresh(sec1)

        resp = await client.put(
            f"/api/sessions/{ts.id}/sections/reorder",
            json={"ordered_ids": [sec1.id, sec0.id]},
        )
        assert resp.status_code == 204

        await db_session.refresh(sec0)
        await db_session.refresh(sec1)
        assert sec1.display_order == 0
        assert sec0.display_order == 1

    async def test_mismatched_ids_returns_400(
        self, client: AsyncClient, full_hierarchy
    ):
        _, ts, sec0, _ = full_hierarchy
        resp = await client.put(
            f"/api/sessions/{ts.id}/sections/reorder",
            json={"ordered_ids": [sec0.id, 99999]},
        )
        assert resp.status_code == 400

    async def test_session_not_found(self, client: AsyncClient):
        resp = await client.put(
            "/api/sessions/99999/sections/reorder",
            json={"ordered_ids": []},
        )
        assert resp.status_code == 404


# ===========================================================================
# Block tests
# ===========================================================================

class TestCreateBlock:
    async def test_create_block(self, client: AsyncClient, full_hierarchy):
        _, _, section, _ = full_hierarchy
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={
                "name": "G major scale, 3 octaves",
                "tempo_bpm": 72,
                "key": "G major",
                "estimated_duration_minutes": 3,
                "difficulty_level": 2,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "G major scale, 3 octaves"
        assert data["tempo_bpm"] == 72
        assert data["key"] == "G major"
        assert data["estimated_duration_minutes"] == 3
        assert data["difficulty_level"] == 2
        assert data["display_order"] == 1  # after existing block at 0

    async def test_create_minimal_block(
        self, client: AsyncClient, full_hierarchy
    ):
        _, _, section, _ = full_hierarchy
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={"name": "Spiccato exercise"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Spiccato exercise"
        assert data["tempo_bpm"] is None
        assert data["curated_block_id"] is None

    async def test_create_with_curated_block_id(
        self, client: AsyncClient, db_session: AsyncSession, full_hierarchy
    ):
        _, _, section, _ = full_hierarchy
        curated = CuratedBlock(
            instrument_category="violin",
            name="3-octave major scales",
            section_type="scales",
            default_duration_minutes=5,
        )
        db_session.add(curated)
        await db_session.commit()
        await db_session.refresh(curated)

        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={"name": "From library", "curated_block_id": curated.id},
        )
        assert resp.status_code == 201
        assert resp.json()["curated_block_id"] == curated.id

    async def test_difficulty_level_validation(
        self, client: AsyncClient, full_hierarchy
    ):
        _, _, section, _ = full_hierarchy
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={"name": "Bad", "difficulty_level": 6},
        )
        assert resp.status_code == 422

        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={"name": "Bad", "difficulty_level": 0},
        )
        assert resp.status_code == 422

    async def test_section_not_found(self, client: AsyncClient):
        resp = await client.post(
            "/api/sections/99999/blocks",
            json={"name": "Nope"},
        )
        assert resp.status_code == 404

    async def test_cannot_create_on_other_users_section(
        self, client: AsyncClient, other_user_template
    ):
        _, _, sec, _ = other_user_template
        resp = await client.post(
            f"/api/sections/{sec.id}/blocks",
            json={"name": "Stolen"},
        )
        assert resp.status_code == 404

    async def test_empty_name_returns_422(
        self, client: AsyncClient, full_hierarchy
    ):
        _, _, section, _ = full_hierarchy
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={"name": ""},
        )
        assert resp.status_code == 422


class TestUpdateBlock:
    async def test_update_name(self, client: AsyncClient, full_hierarchy):
        _, _, _, block = full_hierarchy
        resp = await client.patch(
            f"/api/blocks/{block.id}",
            json={"name": "Renamed"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Renamed"

    async def test_update_tempo(self, client: AsyncClient, full_hierarchy):
        _, _, _, block = full_hierarchy
        resp = await client.patch(
            f"/api/blocks/{block.id}",
            json={"tempo_bpm": 80},
        )
        assert resp.status_code == 200
        assert resp.json()["tempo_bpm"] == 80

    async def test_update_multiple_fields(
        self, client: AsyncClient, full_hierarchy
    ):
        _, _, _, block = full_hierarchy
        resp = await client.patch(
            f"/api/blocks/{block.id}",
            json={"name": "Updated", "key": "D minor", "difficulty_level": 3},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Updated"
        assert data["key"] == "D minor"
        assert data["difficulty_level"] == 3

    async def test_empty_body_no_change(
        self, client: AsyncClient, full_hierarchy
    ):
        _, _, _, block = full_hierarchy
        resp = await client.patch(f"/api/blocks/{block.id}", json={})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Open strings"

    async def test_not_found(self, client: AsyncClient):
        resp = await client.patch(
            "/api/blocks/99999", json={"name": "Nope"}
        )
        assert resp.status_code == 404

    async def test_cannot_update_other_users_block(
        self, client: AsyncClient, other_user_template
    ):
        _, _, _, block = other_user_template
        resp = await client.patch(
            f"/api/blocks/{block.id}", json={"name": "Stolen"}
        )
        assert resp.status_code == 404

    async def test_empty_name_returns_422(
        self, client: AsyncClient, full_hierarchy
    ):
        _, _, _, block = full_hierarchy
        resp = await client.patch(
            f"/api/blocks/{block.id}", json={"name": ""}
        )
        assert resp.status_code == 422

    async def test_difficulty_level_validation(
        self, client: AsyncClient, full_hierarchy
    ):
        _, _, _, block = full_hierarchy
        resp = await client.patch(
            f"/api/blocks/{block.id}", json={"difficulty_level": 6}
        )
        assert resp.status_code == 422


class TestDeleteBlock:
    async def test_delete_block(
        self, client: AsyncClient, db_session: AsyncSession, full_hierarchy
    ):
        _, _, _, block = full_hierarchy
        resp = await client.delete(f"/api/blocks/{block.id}")
        assert resp.status_code == 204

        result = await db_session.exec(
            select(Block).where(Block.id == block.id)
        )
        assert result.first() is None

    async def test_reorders_remaining_blocks(
        self, client: AsyncClient, db_session: AsyncSession, full_hierarchy
    ):
        _, _, section, block0 = full_hierarchy
        block1 = Block(
            section_id=section.id, name="B1", display_order=1
        )
        block2 = Block(
            section_id=section.id, name="B2", display_order=2
        )
        db_session.add_all([block1, block2])
        await db_session.commit()
        await db_session.refresh(block1)
        await db_session.refresh(block2)

        await client.delete(f"/api/blocks/{block0.id}")

        await db_session.refresh(block1)
        await db_session.refresh(block2)
        assert block1.display_order == 0
        assert block2.display_order == 1

    async def test_not_found(self, client: AsyncClient):
        resp = await client.delete("/api/blocks/99999")
        assert resp.status_code == 404

    async def test_cannot_delete_other_users_block(
        self, client: AsyncClient, other_user_template
    ):
        _, _, _, block = other_user_template
        resp = await client.delete(f"/api/blocks/{block.id}")
        assert resp.status_code == 404


class TestReorderBlocks:
    async def test_reorder(
        self, client: AsyncClient, db_session: AsyncSession, full_hierarchy
    ):
        _, _, section, block0 = full_hierarchy
        block1 = Block(
            section_id=section.id, name="B1", display_order=1
        )
        db_session.add(block1)
        await db_session.commit()
        await db_session.refresh(block1)

        resp = await client.put(
            f"/api/sections/{section.id}/blocks/reorder",
            json={"ordered_ids": [block1.id, block0.id]},
        )
        assert resp.status_code == 204

        await db_session.refresh(block0)
        await db_session.refresh(block1)
        assert block1.display_order == 0
        assert block0.display_order == 1

    async def test_mismatched_ids_returns_400(
        self, client: AsyncClient, full_hierarchy
    ):
        _, _, section, block0 = full_hierarchy
        resp = await client.put(
            f"/api/sections/{section.id}/blocks/reorder",
            json={"ordered_ids": [block0.id, 99999]},
        )
        assert resp.status_code == 400

    async def test_section_not_found(self, client: AsyncClient):
        resp = await client.put(
            "/api/sections/99999/blocks/reorder",
            json={"ordered_ids": []},
        )
        assert resp.status_code == 404
