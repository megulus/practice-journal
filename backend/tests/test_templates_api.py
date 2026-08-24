"""Tests for Templates CRUD API endpoints."""
import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Instrument, Template, TemplateSession, Section, Block, UserSettings
from app.enums import utcnow


class TestListTemplates:
    async def test_empty_list(self, client: AsyncClient, test_instrument):
        resp = await client.get(f"/api/instruments/{test_instrument.id}/templates")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_returns_templates(self, client: AsyncClient, test_template, test_instrument):
        resp = await client.get(f"/api/instruments/{test_instrument.id}/templates")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Test Practice Plan"
        # List endpoint uses TemplateListItem (no sessions)
        assert "sessions" not in data[0]

    async def test_includes_session_count_and_estimated_total(
        self, client: AsyncClient, test_template, test_instrument
    ):
        # Fixture has one session with one 5-minute section.
        resp = await client.get(f"/api/instruments/{test_instrument.id}/templates")
        assert resp.status_code == 200
        data = resp.json()
        assert data[0]["session_count"] == 1
        assert data[0]["estimated_total_minutes"] == 5

    async def test_estimated_total_sums_across_all_sessions(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_template,
        test_instrument,
    ):
        ts2 = TemplateSession(
            template_id=test_template.id, name="Session 2", display_order=1
        )
        db_session.add(ts2)
        await db_session.commit()
        await db_session.refresh(ts2)
        db_session.add(
            Section(
                template_session_id=ts2.id,
                name="Scales",
                section_type="scales",
                estimated_duration_minutes=7,
                display_order=0,
            )
        )
        db_session.add(
            Section(
                template_session_id=ts2.id,
                name="Repertoire",
                section_type="repertoire",
                estimated_duration_minutes=8,
                display_order=1,
            )
        )
        await db_session.commit()

        resp = await client.get(f"/api/instruments/{test_instrument.id}/templates")
        assert resp.status_code == 200
        item = next(t for t in resp.json() if t["id"] == test_template.id)
        assert item["session_count"] == 2
        assert item["estimated_total_minutes"] == 5 + 7 + 8

    async def test_aggregates_zero_for_session_less_plan(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_instrument,
        test_user,
    ):
        t = Template(
            user_id=test_user.id, instrument_id=test_instrument.id, name="Bare plan"
        )
        db_session.add(t)
        await db_session.commit()

        resp = await client.get(f"/api/instruments/{test_instrument.id}/templates")
        assert resp.status_code == 200
        item = next(x for x in resp.json() if x["name"] == "Bare plan")
        assert item["session_count"] == 0
        assert item["estimated_total_minutes"] == 0

    async def test_estimated_total_zero_for_section_less_session(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_instrument,
        test_user,
    ):
        t = Template(
            user_id=test_user.id, instrument_id=test_instrument.id, name="No sections"
        )
        db_session.add(t)
        await db_session.commit()
        await db_session.refresh(t)
        db_session.add(
            TemplateSession(template_id=t.id, name="Session 1", display_order=0)
        )
        await db_session.commit()

        resp = await client.get(f"/api/instruments/{test_instrument.id}/templates")
        assert resp.status_code == 200
        item = next(x for x in resp.json() if x["name"] == "No sections")
        assert item["session_count"] == 1
        assert item["estimated_total_minutes"] == 0

    async def test_excludes_deleted_templates(
        self, client: AsyncClient, db_session: AsyncSession, test_instrument, test_user
    ):
        t = Template(
            user_id=test_user.id,
            instrument_id=test_instrument.id,
            name="Deleted",
            deleted_at=utcnow(),
        )
        db_session.add(t)
        await db_session.commit()

        resp = await client.get(f"/api/instruments/{test_instrument.id}/templates")
        assert resp.status_code == 200
        assert len(resp.json()) == 0

    async def test_excludes_other_instruments(
        self, client: AsyncClient, db_session: AsyncSession, test_user, test_template
    ):
        other_inst = Instrument(user_id=test_user.id, name="Piano")
        db_session.add(other_inst)
        await db_session.commit()
        await db_session.refresh(other_inst)

        resp = await client.get(f"/api/instruments/{other_inst.id}/templates")
        assert resp.status_code == 200
        assert len(resp.json()) == 0

    async def test_instrument_not_found(self, client: AsyncClient):
        resp = await client.get("/api/instruments/99999/templates")
        assert resp.status_code == 404

    async def test_unauthenticated_returns_401(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/instruments/1/templates")
        assert resp.status_code == 401


class TestCreateTemplate:
    async def test_create_with_auto_session_and_sections(
        self, client: AsyncClient, test_instrument
    ):
        resp = await client.post(
            f"/api/instruments/{test_instrument.id}/templates",
            json={"name": "My Practice Plan"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "My Practice Plan"
        assert data["is_active"] is True
        assert data["instrument_id"] == test_instrument.id
        assert data["current_rotation_index"] == 0

        # Should have one auto-created session
        assert len(data["sessions"]) == 1
        session = data["sessions"][0]
        assert session["name"] == "Session 1"
        assert session["display_order"] == 0

        # Should have 4 default sections
        sections = session["sections"]
        assert len(sections) == 4
        assert sections[0]["name"] == "Warm-up"
        assert sections[0]["section_type"] == "warmup"
        assert sections[1]["name"] == "Scales"
        assert sections[2]["name"] == "Repertoire"
        assert sections[3]["name"] == "Cool-down"

        # Sections should be ordered
        for i, sec in enumerate(sections):
            assert sec["display_order"] == i

    async def test_create_with_description(self, client: AsyncClient, test_instrument):
        resp = await client.post(
            f"/api/instruments/{test_instrument.id}/templates",
            json={"name": "Bruch concerto", "description": "Focus on mvt II"},
        )
        assert resp.status_code == 201
        assert resp.json()["description"] == "Focus on mvt II"

    async def test_deactivates_existing_active_template(
        self, client: AsyncClient, test_instrument, db_session: AsyncSession
    ):
        # Create first template (will be active)
        resp1 = await client.post(
            f"/api/instruments/{test_instrument.id}/templates",
            json={"name": "Template 1"},
        )
        assert resp1.status_code == 201
        t1_id = resp1.json()["id"]

        # Create second template — should deactivate the first
        resp2 = await client.post(
            f"/api/instruments/{test_instrument.id}/templates",
            json={"name": "Template 2"},
        )
        assert resp2.status_code == 201
        assert resp2.json()["is_active"] is True

        # First template should now be inactive
        resp = await client.get(f"/api/templates/{t1_id}")
        assert resp.json()["is_active"] is False

    async def test_section_durations_from_user_settings(
        self, client: AsyncClient, db_session: AsyncSession, test_user, test_instrument
    ):
        # Set custom default duration
        settings = UserSettings(
            user_id=test_user.id,
            default_session_duration_minutes=60,
        )
        db_session.add(settings)
        await db_session.commit()

        resp = await client.post(
            f"/api/instruments/{test_instrument.id}/templates",
            json={"name": "Long Session"},
        )
        assert resp.status_code == 201
        sections = resp.json()["sessions"][0]["sections"]
        # 60 / 4 sections = 15 minutes each
        for sec in sections:
            assert sec["estimated_duration_minutes"] == 15

    async def test_session_estimated_duration_is_sum(
        self, client: AsyncClient, test_instrument
    ):
        resp = await client.post(
            f"/api/instruments/{test_instrument.id}/templates",
            json={"name": "Test"},
        )
        assert resp.status_code == 201
        session = resp.json()["sessions"][0]
        section_sum = sum(s["estimated_duration_minutes"] for s in session["sections"])
        assert session["estimated_duration_minutes"] == section_sum

    async def test_instrument_not_found(self, client: AsyncClient):
        resp = await client.post(
            "/api/instruments/99999/templates",
            json={"name": "Nope"},
        )
        assert resp.status_code == 404

    async def test_missing_name_returns_422(self, client: AsyncClient, test_instrument):
        resp = await client.post(
            f"/api/instruments/{test_instrument.id}/templates",
            json={},
        )
        assert resp.status_code == 422

    async def test_empty_name_returns_422(self, client: AsyncClient, test_instrument):
        resp = await client.post(
            f"/api/instruments/{test_instrument.id}/templates",
            json={"name": ""},
        )
        assert resp.status_code == 422

    async def test_section_duration_remainder_distributed(
        self, client: AsyncClient, db_session: AsyncSession, test_user, test_instrument
    ):
        """With 30 min / 4 sections, first 2 get 8 min and last 2 get 7 min."""
        settings = UserSettings(
            user_id=test_user.id,
            default_session_duration_minutes=30,
        )
        db_session.add(settings)
        await db_session.commit()

        resp = await client.post(
            f"/api/instruments/{test_instrument.id}/templates",
            json={"name": "Remainder Test"},
        )
        assert resp.status_code == 201
        sections = resp.json()["sessions"][0]["sections"]
        durations = [s["estimated_duration_minutes"] for s in sections]
        assert durations == [8, 8, 7, 7]
        assert sum(durations) == 30


class TestGetTemplate:
    async def test_get_with_nested_data(
        self, client: AsyncClient, db_session: AsyncSession, test_template, test_instrument
    ):
        # Add a block to the existing section
        result = await db_session.exec(
            select(Section).where(Section.name == "Warm-up")
        )
        section = result.one()
        block = Block(
            section_id=section.id,
            name="Open strings",
            display_order=0,
        )
        db_session.add(block)
        await db_session.commit()

        resp = await client.get(f"/api/templates/{test_template.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Test Practice Plan"
        assert len(data["sessions"]) == 1
        assert len(data["sessions"][0]["sections"]) == 1
        assert len(data["sessions"][0]["sections"][0]["blocks"]) == 1
        assert data["sessions"][0]["sections"][0]["blocks"][0]["name"] == "Open strings"

    async def test_computed_session_duration(
        self, client: AsyncClient, db_session: AsyncSession, test_user, test_instrument
    ):
        template = Template(
            user_id=test_user.id,
            instrument_id=test_instrument.id,
            name="Duration Test",
            is_active=False,
        )
        db_session.add(template)
        await db_session.commit()
        await db_session.refresh(template)

        ts = TemplateSession(template_id=template.id, name="S1", display_order=0)
        db_session.add(ts)
        await db_session.commit()
        await db_session.refresh(ts)

        s1 = Section(
            template_session_id=ts.id, name="A", section_type="warmup",
            estimated_duration_minutes=10, display_order=0,
        )
        s2 = Section(
            template_session_id=ts.id, name="B", section_type="scales",
            estimated_duration_minutes=15, display_order=1,
        )
        db_session.add_all([s1, s2])
        await db_session.commit()

        resp = await client.get(f"/api/templates/{template.id}")
        assert resp.json()["sessions"][0]["estimated_duration_minutes"] == 25

    async def test_not_found(self, client: AsyncClient):
        resp = await client.get("/api/templates/99999")
        assert resp.status_code == 404

    async def test_cannot_get_other_users_template(
        self, client: AsyncClient, db_session: AsyncSession, other_user, test_instrument
    ):
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

        resp = await client.get(f"/api/templates/{other_template.id}")
        assert resp.status_code == 404

    async def test_cannot_get_deleted_template(
        self, client: AsyncClient, db_session: AsyncSession, test_template
    ):
        test_template.deleted_at = utcnow()
        db_session.add(test_template)
        await db_session.commit()

        resp = await client.get(f"/api/templates/{test_template.id}")
        assert resp.status_code == 404


class TestUpdateTemplate:
    async def test_update_name(self, client: AsyncClient, test_template):
        resp = await client.patch(
            f"/api/templates/{test_template.id}",
            json={"name": "Renamed"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Renamed"

    async def test_update_description(self, client: AsyncClient, test_template):
        resp = await client.patch(
            f"/api/templates/{test_template.id}",
            json={"description": "New description"},
        )
        assert resp.status_code == 200
        assert resp.json()["description"] == "New description"

    async def test_empty_body_no_change(self, client: AsyncClient, test_template):
        resp = await client.patch(
            f"/api/templates/{test_template.id}",
            json={},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Test Practice Plan"

    async def test_activate_deactivates_current_active(
        self, client: AsyncClient, db_session: AsyncSession, test_user, test_instrument
    ):
        # Create two templates: t1 active, t2 inactive
        t1 = Template(
            user_id=test_user.id,
            instrument_id=test_instrument.id,
            name="Active",
            is_active=True,
        )
        t2 = Template(
            user_id=test_user.id,
            instrument_id=test_instrument.id,
            name="Inactive",
            is_active=False,
        )
        db_session.add_all([t1, t2])
        await db_session.commit()
        await db_session.refresh(t1)
        await db_session.refresh(t2)

        # Activate t2
        resp = await client.patch(
            f"/api/templates/{t2.id}",
            json={"is_active": True},
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True
        # The client never named t1, so the response has to (#289).
        assert resp.json()["deactivated_template_name"] == "Active"

        # t1 should be deactivated
        resp = await client.get(f"/api/templates/{t1.id}")
        assert resp.json()["is_active"] is False

    async def test_activate_with_no_current_active_names_nothing(
        self, client: AsyncClient, db_session: AsyncSession, test_user, test_instrument
    ):
        """Nothing was displaced, so nothing is named — the editor keys its
        "no longer active" notice off this field."""
        t = Template(
            user_id=test_user.id,
            instrument_id=test_instrument.id,
            name="Only plan",
            is_active=False,
        )
        db_session.add(t)
        await db_session.commit()
        await db_session.refresh(t)

        resp = await client.patch(f"/api/templates/{t.id}", json={"is_active": True})
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True
        assert resp.json()["deactivated_template_name"] is None

    async def test_activate_ignores_another_instruments_active_template(
        self, client: AsyncClient, db_session: AsyncSession, test_user, test_instrument
    ):
        """One active plan *per instrument* — a viola plan going active must
        not claim it displaced the violin's."""
        other_instrument = Instrument(user_id=test_user.id, name="Viola")
        db_session.add(other_instrument)
        await db_session.flush()
        active_elsewhere = Template(
            user_id=test_user.id,
            instrument_id=test_instrument.id,
            name="Violin plan",
            is_active=True,
        )
        target = Template(
            user_id=test_user.id,
            instrument_id=other_instrument.id,
            name="Viola plan",
            is_active=False,
        )
        db_session.add_all([active_elsewhere, target])
        await db_session.commit()
        await db_session.refresh(target)
        await db_session.refresh(active_elsewhere)

        resp = await client.patch(
            f"/api/templates/{target.id}", json={"is_active": True}
        )
        assert resp.status_code == 200
        assert resp.json()["deactivated_template_name"] is None

        # And the violin's plan is untouched.
        resp = await client.get(f"/api/templates/{active_elsewhere.id}")
        assert resp.json()["is_active"] is True

    async def test_metadata_only_patch_names_nothing(
        self, client: AsyncClient, test_template
    ):
        resp = await client.patch(
            f"/api/templates/{test_template.id}", json={"name": "Renamed"}
        )
        assert resp.status_code == 200
        assert resp.json()["deactivated_template_name"] is None

    async def test_deactivate_template(self, client: AsyncClient, test_template):
        resp = await client.patch(
            f"/api/templates/{test_template.id}",
            json={"is_active": False},
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    async def test_activate_already_active_is_noop(
        self, client: AsyncClient, test_template
    ):
        resp = await client.patch(
            f"/api/templates/{test_template.id}",
            json={"is_active": True},
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True
        # A no-op deactivated nothing — don't let the editor claim it did.
        assert resp.json()["deactivated_template_name"] is None

    async def test_empty_name_returns_422(self, client: AsyncClient, test_template):
        resp = await client.patch(
            f"/api/templates/{test_template.id}",
            json={"name": ""},
        )
        assert resp.status_code == 422

    @pytest.mark.parametrize("field", ["name", "is_active"])
    async def test_explicit_null_returns_422(
        self, client: AsyncClient, test_template, field: str
    ):
        """An explicit null survives exclude_unset and would hit a NOT NULL
        column — it must be rejected at the schema layer (#280)."""
        resp = await client.patch(
            f"/api/templates/{test_template.id}",
            json={field: None},
        )
        assert resp.status_code == 422

        # ...and nothing was written
        data = (await client.get(f"/api/templates/{test_template.id}")).json()
        assert data["name"] == "Test Practice Plan"
        assert data["is_active"] is test_template.is_active

    async def test_explicit_null_alongside_valid_field_returns_422(
        self, client: AsyncClient, test_template
    ):
        resp = await client.patch(
            f"/api/templates/{test_template.id}",
            json={"description": "Kept out of the DB", "name": None},
        )
        assert resp.status_code == 422

        data = (await client.get(f"/api/templates/{test_template.id}")).json()
        assert data["name"] == "Test Practice Plan"
        assert data["description"] is None

    async def test_explicit_null_description_clears_it(
        self, client: AsyncClient, test_template
    ):
        """`description` is nullable, so an explicit null means "clear it" —
        the per-field split a blanket null rejection would break (#280)."""
        resp = await client.patch(
            f"/api/templates/{test_template.id}",
            json={"description": "Warm-ups and scales"},
        )
        assert resp.json()["description"] == "Warm-ups and scales"

        resp = await client.patch(
            f"/api/templates/{test_template.id}",
            json={"description": None},
        )
        assert resp.status_code == 200
        assert resp.json()["description"] is None

    async def test_omitted_fields_left_unchanged(
        self, client: AsyncClient, test_template
    ):
        await client.patch(
            f"/api/templates/{test_template.id}",
            json={"description": "Warm-ups and scales", "is_active": True},
        )

        resp = await client.patch(
            f"/api/templates/{test_template.id}",
            json={"name": "Renamed"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Renamed"
        assert data["description"] == "Warm-ups and scales"
        assert data["is_active"] is True

    async def test_not_found(self, client: AsyncClient):
        resp = await client.patch(
            "/api/templates/99999",
            json={"name": "Nope"},
        )
        assert resp.status_code == 404

    async def test_cannot_update_other_users_template(
        self, client: AsyncClient, db_session: AsyncSession, other_user
    ):
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

        resp = await client.patch(
            f"/api/templates/{other_template.id}",
            json={"name": "Stolen"},
        )
        assert resp.status_code == 404


class TestDeleteTemplate:
    async def test_soft_deletes_template(
        self, client: AsyncClient, db_session: AsyncSession, test_template
    ):
        resp = await client.delete(f"/api/templates/{test_template.id}")
        assert resp.status_code == 204

        # Verify soft-deleted
        await db_session.refresh(test_template)
        assert test_template.deleted_at is not None

    async def test_deleted_template_excluded_from_list(
        self, client: AsyncClient, test_template, test_instrument
    ):
        await client.delete(f"/api/templates/{test_template.id}")

        resp = await client.get(f"/api/instruments/{test_instrument.id}/templates")
        assert resp.json() == []

    async def test_not_found(self, client: AsyncClient):
        resp = await client.delete("/api/templates/99999")
        assert resp.status_code == 404

    async def test_delete_active_template_leaves_none_active(
        self, client: AsyncClient, test_template, test_instrument
    ):
        """Deleting the active template means no template is active for the instrument."""
        await client.delete(f"/api/templates/{test_template.id}")

        resp = await client.get(f"/api/instruments/{test_instrument.id}/templates")
        assert resp.json() == []

    async def test_cannot_delete_other_users_template(
        self, client: AsyncClient, db_session: AsyncSession, other_user
    ):
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

        resp = await client.delete(f"/api/templates/{other_template.id}")
        assert resp.status_code == 404
