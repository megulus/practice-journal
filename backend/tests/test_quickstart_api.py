"""Tests for the quick-start wizard endpoint (product spec §5.6)."""
import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Instrument, Piece, Template, UserSettings


def payload(**overrides):
    """A realistic wizard result: violin, four areas, 30 minutes."""
    body = {
        "instrument_name": "Violin",
        "plan_name": "Bruch Violin Concerto",
        "piece_name": "Bruch Violin Concerto",
        "sections": [
            {
                "name": "Warm-up",
                "section_type": "warmup",
                "estimated_duration_minutes": 5,
                "block": {
                    "name": "Warm-up",
                    "description": "Easy playing to loosen up",
                },
            },
            {
                "name": "Scales and technique",
                "section_type": "scales",
                "estimated_duration_minutes": 7,
                "block": {
                    "name": "Scales and technique",
                    "description": "Scales and arpeggios, slow and even",
                },
            },
            {
                "name": "Repertoire",
                "section_type": "repertoire",
                "estimated_duration_minutes": 15,
                "block": {
                    "name": "Repertoire",
                    "description": "Slow practice on your current piece",
                },
            },
            {
                "name": "Cool-down",
                "section_type": "cooldown",
                "estimated_duration_minutes": 3,
                "block": {
                    "name": "Cool-down",
                    "description": "Easy playing, reflect on the session",
                },
            },
        ],
    }
    body.update(overrides)
    return body


class TestQuickStartCreation:
    async def test_creates_instrument_piece_and_active_plan(
        self, client: AsyncClient
    ):
        resp = await client.post("/api/quickstart", json=payload())
        assert resp.status_code == 201
        data = resp.json()

        assert data["instrument"]["name"] == "Violin"
        # Category is derived from the name, so curated blocks still resolve.
        assert data["instrument"]["instrument_category"] == "violin"
        assert data["piece"]["name"] == "Bruch Violin Concerto"

        template = data["template"]
        assert template["name"] == "Bruch Violin Concerto"
        assert template["is_active"] is True
        assert len(template["sessions"]) == 1
        assert data["template_session_id"] == template["sessions"][0]["id"]

    async def test_sections_keep_wizard_order_and_durations(
        self, client: AsyncClient
    ):
        resp = await client.post("/api/quickstart", json=payload())
        sections = resp.json()["template"]["sessions"][0]["sections"]

        assert [s["section_type"] for s in sections] == [
            "warmup",
            "scales",
            "repertoire",
            "cooldown",
        ]
        assert [s["display_order"] for s in sections] == [0, 1, 2, 3]
        assert [s["estimated_duration_minutes"] for s in sections] == [5, 7, 15, 3]

    async def test_each_section_gets_one_seed_block(self, client: AsyncClient):
        resp = await client.post("/api/quickstart", json=payload())
        sections = resp.json()["template"]["sessions"][0]["sections"]

        assert all(len(s["blocks"]) == 1 for s in sections)
        warmup_block = sections[0]["blocks"][0]
        assert warmup_block["name"] == "Warm-up"
        assert warmup_block["description"] == "Easy playing to loosen up"
        # Block time mirrors its section so the editor shows a full budget.
        assert warmup_block["estimated_duration_minutes"] == 5

    async def test_repertoire_block_points_at_the_new_piece(
        self, client: AsyncClient
    ):
        resp = await client.post("/api/quickstart", json=payload())
        data = resp.json()
        repertoire = data["template"]["sessions"][0]["sections"][2]["blocks"][0]

        assert repertoire["piece_id"] == data["piece"]["id"]
        assert repertoire["piece_name"] == "Bruch Violin Concerto"
        # Repertoire blocks take their display name from the piece.
        assert repertoire["name"] is None
        # Spec §5.6: the piece starts with no spots.
        assert repertoire["default_spots"] == []

    async def test_no_piece_leaves_the_repertoire_block_generic(
        self, client: AsyncClient
    ):
        resp = await client.post("/api/quickstart", json=payload(piece_name=None))
        data = resp.json()

        assert data["piece"] is None
        repertoire = data["template"]["sessions"][0]["sections"][2]["blocks"][0]
        assert repertoire["piece_id"] is None
        assert repertoire["name"] == "Repertoire"

    async def test_blank_piece_name_is_treated_as_skipped(
        self, client: AsyncClient
    ):
        resp = await client.post("/api/quickstart", json=payload(piece_name="   "))
        assert resp.status_code == 201
        assert resp.json()["piece"] is None

    async def test_time_budget_becomes_the_default_session_duration(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        await client.post("/api/quickstart", json=payload())

        result = await db_session.exec(
            select(UserSettings).where(UserSettings.user_id == test_user.id)
        )
        settings = result.one()
        assert settings.default_session_duration_minutes == 30

    async def test_existing_settings_are_updated_not_duplicated(
        self, client: AsyncClient, db_session: AsyncSession, test_user
    ):
        db_session.add(
            UserSettings(user_id=test_user.id, default_session_duration_minutes=45)
        )
        await db_session.commit()

        await client.post("/api/quickstart", json=payload())

        result = await db_session.exec(
            select(UserSettings).where(UserSettings.user_id == test_user.id)
        )
        assert len(result.all()) == 1


class TestQuickStartExistingInstrument:
    async def test_reuses_an_instrument_by_id(
        self, client: AsyncClient, db_session: AsyncSession, test_instrument
    ):
        resp = await client.post(
            "/api/quickstart",
            json=payload(instrument_name=None, instrument_id=test_instrument.id),
        )
        assert resp.status_code == 201
        assert resp.json()["instrument"]["id"] == test_instrument.id

        result = await db_session.exec(select(Instrument))
        assert len(result.all()) == 1

    async def test_piece_lands_in_the_existing_instruments_library(
        self, client: AsyncClient, db_session: AsyncSession, test_instrument
    ):
        resp = await client.post(
            "/api/quickstart",
            json=payload(instrument_name=None, instrument_id=test_instrument.id),
        )
        assert resp.status_code == 201

        result = await db_session.exec(select(Piece))
        pieces = result.all()
        assert len(pieces) == 1
        assert pieces[0].instrument_id == test_instrument.id

    async def test_deactivates_the_previous_active_plan(
        self, client: AsyncClient, db_session: AsyncSession, test_template, test_instrument
    ):
        resp = await client.post(
            "/api/quickstart",
            json=payload(instrument_name=None, instrument_id=test_instrument.id),
        )
        assert resp.status_code == 201
        new_id = resp.json()["template"]["id"]

        # The fixture session still holds the pre-request Template; drop it so
        # the assertion reads what the endpoint actually committed.
        db_session.expire_all()
        result = await db_session.exec(select(Template))
        actives = {t.id: t.is_active for t in result.all()}
        assert actives[test_template.id] is False
        assert actives[new_id] is True

    async def test_other_users_instrument_is_not_found(
        self, other_user_client: AsyncClient, test_instrument
    ):
        resp = await other_user_client.post(
            "/api/quickstart",
            json=payload(instrument_name=None, instrument_id=test_instrument.id),
        )
        assert resp.status_code == 404

    async def test_unknown_instrument_is_not_found(self, client: AsyncClient):
        resp = await client.post(
            "/api/quickstart", json=payload(instrument_name=None, instrument_id=99999)
        )
        assert resp.status_code == 404


class TestQuickStartValidation:
    async def test_requires_an_instrument(self, client: AsyncClient):
        resp = await client.post("/api/quickstart", json=payload(instrument_name=None))
        assert resp.status_code == 422

    async def test_rejects_both_instrument_id_and_name(
        self, client: AsyncClient, test_instrument
    ):
        resp = await client.post(
            "/api/quickstart", json=payload(instrument_id=test_instrument.id)
        )
        assert resp.status_code == 422

    async def test_rejects_a_blank_instrument_name(self, client: AsyncClient):
        resp = await client.post("/api/quickstart", json=payload(instrument_name="  "))
        assert resp.status_code == 422

    async def test_rejects_a_blank_plan_name(self, client: AsyncClient):
        resp = await client.post("/api/quickstart", json=payload(plan_name="   "))
        assert resp.status_code == 422

    async def test_rejects_an_empty_section_list(self, client: AsyncClient):
        resp = await client.post("/api/quickstart", json=payload(sections=[]))
        assert resp.status_code == 422

    async def test_rejects_a_zero_minute_section(self, client: AsyncClient):
        body = payload()
        body["sections"][0]["estimated_duration_minutes"] = 0
        resp = await client.post("/api/quickstart", json=body)
        assert resp.status_code == 422

    async def test_rejects_an_unknown_section_type(self, client: AsyncClient):
        body = payload()
        body["sections"][0]["section_type"] = "noodling"
        resp = await client.post("/api/quickstart", json=body)
        assert resp.status_code == 422

    async def test_a_rejected_request_creates_nothing(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        body = payload()
        body["sections"][0]["section_type"] = "noodling"
        await client.post("/api/quickstart", json=body)

        result = await db_session.exec(select(Instrument))
        assert result.all() == []

    async def test_requires_authentication(self, unauth_client: AsyncClient):
        resp = await unauth_client.post("/api/quickstart", json=payload())
        assert resp.status_code == 401
