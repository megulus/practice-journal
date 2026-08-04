"""Tests for /api/instruments endpoints."""
import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Instrument, Template, PracticeLog
from app.enums import utcnow
from datetime import date


class TestListInstruments:
    async def test_empty_list(self, client: AsyncClient):
        resp = await client.get("/api/instruments")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_returns_user_instruments(self, client: AsyncClient, test_instrument):
        resp = await client.get("/api/instruments")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Violin"
        assert data[0]["practice_frequency"] == "few_times_a_week"
        assert data[0]["active_template_count"] == 0
        assert data[0]["last_practiced_at"] is None

    async def test_excludes_deleted_instruments(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        deleted = Instrument(
            user_id=test_user.id, name="Deleted", deleted_at=utcnow()
        )
        db_session.add(deleted)
        await db_session.commit()

        resp = await client.get("/api/instruments")
        assert resp.status_code == 200
        assert len(resp.json()) == 0

    async def test_ordered_by_display_order(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        i1 = Instrument(user_id=test_user.id, name="Piano", display_order=2)
        i2 = Instrument(user_id=test_user.id, name="Violin", display_order=0)
        i3 = Instrument(user_id=test_user.id, name="Cello", display_order=1)
        db_session.add_all([i1, i2, i3])
        await db_session.commit()

        resp = await client.get("/api/instruments")
        names = [i["name"] for i in resp.json()]
        assert names == ["Violin", "Cello", "Piano"]

    async def test_excludes_other_users(
        self, client: AsyncClient, db_session: AsyncSession, other_user
    ):
        other_instrument = Instrument(
            user_id=other_user.id, name="Other Guitar"
        )
        db_session.add(other_instrument)
        await db_session.commit()

        resp = await client.get("/api/instruments")
        assert resp.status_code == 200
        assert len(resp.json()) == 0

    async def test_computed_fields(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        instrument = Instrument(user_id=test_user.id, name="Violin")
        db_session.add(instrument)
        await db_session.commit()
        await db_session.refresh(instrument)

        # Add an active template
        template = Template(
            user_id=test_user.id,
            instrument_id=instrument.id,
            name="Plan",
            is_active=True,
        )
        db_session.add(template)
        await db_session.commit()

        # Add a completed practice log
        log = PracticeLog(
            user_id=test_user.id,
            instrument_id=instrument.id,
            status="completed",
            practice_date=date(2026, 3, 20),
            total_duration_minutes=30,
        )
        db_session.add(log)
        await db_session.commit()

        resp = await client.get("/api/instruments")
        data = resp.json()
        assert data[0]["active_template_count"] == 1
        assert data[0]["last_practiced_at"] == "2026-03-20"

    async def test_unauthenticated_returns_401(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/instruments")
        assert resp.status_code == 401


class TestCreateInstrument:
    async def test_create_with_defaults(self, client: AsyncClient):
        resp = await client.post(
            "/api/instruments",
            json={"name": "Violin"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Violin"
        assert data["practice_frequency"] == "few_times_a_week"
        assert data["display_order"] == 0
        assert data["active_template_count"] == 0
        assert data["id"] is not None

    async def test_create_with_custom_frequency(self, client: AsyncClient):
        resp = await client.post(
            "/api/instruments",
            json={"name": "Guitar", "practice_frequency": "daily"},
        )
        assert resp.status_code == 201
        assert resp.json()["practice_frequency"] == "daily"

    async def test_invalid_frequency_returns_422(self, client: AsyncClient):
        resp = await client.post(
            "/api/instruments",
            json={"name": "Violin", "practice_frequency": "never"},
        )
        assert resp.status_code == 422


class TestInstrumentCategory:
    async def test_category_derived_from_name(self, client: AsyncClient):
        resp = await client.post("/api/instruments", json={"name": "Violin"})
        assert resp.status_code == 201
        assert resp.json()["instrument_category"] == "violin"

    async def test_category_derived_from_decorated_name(self, client: AsyncClient):
        resp = await client.post("/api/instruments", json={"name": "Mom's Violin"})
        assert resp.status_code == 201
        assert resp.json()["instrument_category"] == "violin"

    async def test_category_falls_back_to_normalized_name(self, client: AsyncClient):
        resp = await client.post("/api/instruments", json={"name": "Stage Strad"})
        assert resp.status_code == 201
        assert resp.json()["instrument_category"] == "stage strad"

    async def test_explicit_category_wins(self, client: AsyncClient):
        resp = await client.post(
            "/api/instruments",
            json={"name": "Stage Strad", "instrument_category": "Violin"},
        )
        assert resp.status_code == 201
        assert resp.json()["instrument_category"] == "violin"

    async def test_category_round_trips_through_list(self, client: AsyncClient):
        await client.post("/api/instruments", json={"name": "Backup viola"})
        resp = await client.get("/api/instruments")
        assert resp.status_code == 200
        assert resp.json()[0]["instrument_category"] == "viola"

    async def test_rename_to_decorated_name_keeps_canonical_category(
        self, client: AsyncClient
    ):
        created = await client.post("/api/instruments", json={"name": "Violin"})
        instrument_id = created.json()["id"]

        resp = await client.patch(
            f"/api/instruments/{instrument_id}",
            json={"name": "Mom's fiddle"},
        )
        assert resp.status_code == 200
        # The whole point of the column: renaming must not break curated search.
        assert resp.json()["instrument_category"] == "violin"

    async def test_rename_between_canonical_instruments(self, client: AsyncClient):
        """A name that resolves to a different canonical category wins — the
        old one is not sticky when the new name is unambiguous."""
        created = await client.post("/api/instruments", json={"name": "Violin"})
        instrument_id = created.json()["id"]

        resp = await client.patch(
            f"/api/instruments/{instrument_id}",
            json={"name": "Cello"},
        )
        assert resp.status_code == 200
        assert resp.json()["instrument_category"] == "cello"

    async def test_explicit_category_on_update(self, client: AsyncClient):
        """Recovery path for a category the derivation got wrong."""
        created = await client.post("/api/instruments", json={"name": "Stage Strad"})
        instrument_id = created.json()["id"]

        resp = await client.patch(
            f"/api/instruments/{instrument_id}",
            json={"instrument_category": "Violin"},
        )
        assert resp.status_code == 200
        assert resp.json()["instrument_category"] == "violin"

    async def test_explicit_category_wins_over_rename_derivation(
        self, client: AsyncClient
    ):
        created = await client.post("/api/instruments", json={"name": "Violin"})
        instrument_id = created.json()["id"]

        resp = await client.patch(
            f"/api/instruments/{instrument_id}",
            json={"name": "Cello", "instrument_category": "viola"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Cello"
        assert resp.json()["instrument_category"] == "viola"

    async def test_blank_name_rejected(self, client: AsyncClient):
        """A whitespace-only name passes min_length=1 but would derive a blank
        category."""
        resp = await client.post("/api/instruments", json={"name": "   "})
        assert resp.status_code == 422

    async def test_blank_name_rejected_on_update(
        self, client: AsyncClient, test_instrument
    ):
        resp = await client.patch(
            f"/api/instruments/{test_instrument.id}",
            json={"name": "   "},
        )
        assert resp.status_code == 422

    async def test_blank_explicit_category_falls_back_to_derivation(
        self, client: AsyncClient
    ):
        resp = await client.post(
            "/api/instruments",
            json={"name": "Backup viola", "instrument_category": "  "},
        )
        assert resp.status_code == 201
        assert resp.json()["instrument_category"] == "viola"

    async def test_null_fields_in_patch_are_ignored(
        self, client: AsyncClient, test_instrument
    ):
        """Every updatable column is NOT NULL — an explicit null must not
        attempt a write."""
        resp = await client.patch(
            f"/api/instruments/{test_instrument.id}",
            json={"name": None, "instrument_category": None},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Violin"
        assert resp.json()["instrument_category"] == "violin"

    async def test_rename_re_derives_a_fallback_category(self, client: AsyncClient):
        created = await client.post("/api/instruments", json={"name": "Violn"})
        instrument_id = created.json()["id"]
        assert created.json()["instrument_category"] == "violn"

        resp = await client.patch(
            f"/api/instruments/{instrument_id}",
            json={"name": "Violin"},
        )
        assert resp.status_code == 200
        assert resp.json()["instrument_category"] == "violin"

    async def test_non_name_update_leaves_category_alone(
        self, client: AsyncClient
    ):
        created = await client.post("/api/instruments", json={"name": "Stage Strad"})
        instrument_id = created.json()["id"]

        resp = await client.patch(
            f"/api/instruments/{instrument_id}",
            json={"practice_frequency": "daily"},
        )
        assert resp.status_code == 200
        assert resp.json()["instrument_category"] == "stage strad"


class TestUpdateInstrument:
    async def test_update_name(self, client: AsyncClient, test_instrument):
        resp = await client.patch(
            f"/api/instruments/{test_instrument.id}",
            json={"name": "Viola"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Viola"

    async def test_update_frequency(self, client: AsyncClient, test_instrument):
        resp = await client.patch(
            f"/api/instruments/{test_instrument.id}",
            json={"practice_frequency": "daily"},
        )
        assert resp.status_code == 200
        assert resp.json()["practice_frequency"] == "daily"

    async def test_empty_body_no_change(self, client: AsyncClient, test_instrument):
        resp = await client.patch(
            f"/api/instruments/{test_instrument.id}",
            json={},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Violin"

    async def test_not_found_returns_404(self, client: AsyncClient):
        resp = await client.patch(
            "/api/instruments/99999",
            json={"name": "Nope"},
        )
        assert resp.status_code == 404

    async def test_cannot_update_other_users_instrument(
        self, client: AsyncClient, db_session: AsyncSession, other_user
    ):
        other_instrument = Instrument(
            user_id=other_user.id, name="Guitar"
        )
        db_session.add(other_instrument)
        await db_session.commit()
        await db_session.refresh(other_instrument)

        resp = await client.patch(
            f"/api/instruments/{other_instrument.id}",
            json={"name": "Stolen Guitar"},
        )
        assert resp.status_code == 404


class TestDeleteInstrument:
    async def test_soft_deletes_instrument(
        self, client: AsyncClient, db_session: AsyncSession, test_instrument
    ):
        resp = await client.delete(f"/api/instruments/{test_instrument.id}")
        assert resp.status_code == 204

        # Verify soft-deleted
        await db_session.refresh(test_instrument)
        assert test_instrument.deleted_at is not None

        # Should no longer appear in list
        resp = await client.get("/api/instruments")
        assert resp.json() == []

    async def test_cascades_to_templates(
        self, client: AsyncClient, db_session: AsyncSession, test_instrument, test_user
    ):
        template = Template(
            user_id=test_user.id,
            instrument_id=test_instrument.id,
            name="Plan",
        )
        db_session.add(template)
        await db_session.commit()
        await db_session.refresh(template)

        await client.delete(f"/api/instruments/{test_instrument.id}")

        await db_session.refresh(template)
        assert template.deleted_at is not None

    async def test_abandons_in_progress_sessions(
        self, client: AsyncClient, db_session: AsyncSession, test_instrument, test_user
    ):
        log = PracticeLog(
            user_id=test_user.id,
            instrument_id=test_instrument.id,
            status="in_progress",
            practice_date=date(2026, 3, 25),
        )
        db_session.add(log)
        await db_session.commit()
        await db_session.refresh(log)

        await client.delete(f"/api/instruments/{test_instrument.id}")

        await db_session.refresh(log)
        assert log.status == "abandoned"

    async def test_preserves_completed_logs(
        self, client: AsyncClient, db_session: AsyncSession, test_instrument, test_user
    ):
        log = PracticeLog(
            user_id=test_user.id,
            instrument_id=test_instrument.id,
            status="completed",
            practice_date=date(2026, 3, 20),
            total_duration_minutes=30,
        )
        db_session.add(log)
        await db_session.commit()
        await db_session.refresh(log)

        await client.delete(f"/api/instruments/{test_instrument.id}")

        await db_session.refresh(log)
        assert log.status == "completed"
        assert log.deleted_at is None

    async def test_not_found_returns_404(self, client: AsyncClient):
        resp = await client.delete("/api/instruments/99999")
        assert resp.status_code == 404

    async def test_cannot_delete_other_users_instrument(
        self, client: AsyncClient, db_session: AsyncSession, other_user
    ):
        other_instrument = Instrument(
            user_id=other_user.id, name="Guitar"
        )
        db_session.add(other_instrument)
        await db_session.commit()
        await db_session.refresh(other_instrument)

        resp = await client.delete(f"/api/instruments/{other_instrument.id}")
        assert resp.status_code == 404
