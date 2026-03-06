"""Tests for user instruments API endpoints."""
from httpx import AsyncClient


class TestListUserInstruments:
    async def test_empty_initially(self, client: AsyncClient):
        resp = await client.get("/api/user/instruments/")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_returns_added_instruments(self, client: AsyncClient, test_user_instrument):
        resp = await client.get("/api/user/instruments/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["instrument"]["name"] == "Violin"
        assert data[0]["template_count"] == 0

    async def test_requires_auth(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/user/instruments/")
        assert resp.status_code == 401


class TestAddUserInstrument:
    async def test_add_instrument(self, client: AsyncClient, test_instrument):
        resp = await client.post(
            "/api/user/instruments/",
            json={"instrument_id": test_instrument.id},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["instrument"]["name"] == "Violin"
        assert data["template_count"] == 0

    async def test_duplicate_instrument_rejected(
        self, client: AsyncClient, test_user_instrument, test_instrument
    ):
        resp = await client.post(
            "/api/user/instruments/",
            json={"instrument_id": test_instrument.id},
        )
        assert resp.status_code == 400
        assert "already have" in resp.json()["detail"]

    async def test_nonexistent_instrument_rejected(self, client: AsyncClient):
        resp = await client.post(
            "/api/user/instruments/",
            json={"instrument_id": 99999},
        )
        assert resp.status_code == 404


class TestWithAvailable:
    async def test_returns_both_lists(self, client: AsyncClient, test_instrument):
        resp = await client.get("/api/user/instruments/with-available")
        assert resp.status_code == 200
        data = resp.json()
        assert "user_instruments" in data
        assert "available_instruments" in data
        # Instrument is available (not yet added)
        assert len(data["available_instruments"]) >= 1

    async def test_owned_instrument_not_in_available(
        self, client: AsyncClient, test_user_instrument
    ):
        resp = await client.get("/api/user/instruments/with-available")
        data = resp.json()
        assert len(data["user_instruments"]) == 1
        available_names = [i["name"] for i in data["available_instruments"]]
        assert "Violin" not in available_names


class TestRemoveUserInstrument:
    async def test_remove_instrument_no_templates(
        self, client: AsyncClient, test_user_instrument
    ):
        resp = await client.delete(f"/api/user/instruments/{test_user_instrument.id}")
        assert resp.status_code == 200
        assert resp.json()["deleted_templates"] == 0

    async def test_remove_instrument_with_templates_requires_confirm(
        self, client: AsyncClient, test_template, test_user_instrument
    ):
        resp = await client.delete(f"/api/user/instruments/{test_user_instrument.id}")
        assert resp.status_code == 400
        assert resp.json()["detail"]["confirm_required"] is True

    async def test_remove_instrument_with_templates_confirmed(
        self, client: AsyncClient, test_template, test_user_instrument
    ):
        resp = await client.delete(
            f"/api/user/instruments/{test_user_instrument.id}?confirm=true"
        )
        assert resp.status_code == 200
        assert resp.json()["deleted_templates"] == 1

    async def test_remove_nonexistent(self, client: AsyncClient):
        resp = await client.delete("/api/user/instruments/99999")
        assert resp.status_code == 404


class TestUpdateUserInstrument:
    async def test_update_display_order(self, client: AsyncClient, test_user_instrument):
        resp = await client.patch(
            f"/api/user/instruments/{test_user_instrument.id}",
            json={"display_order": 5},
        )
        assert resp.status_code == 200
        assert resp.json()["display_order"] == 5

    async def test_update_nonexistent(self, client: AsyncClient):
        resp = await client.patch(
            "/api/user/instruments/99999",
            json={"display_order": 1},
        )
        assert resp.status_code == 404
