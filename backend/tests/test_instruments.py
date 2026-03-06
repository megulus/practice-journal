"""Tests for instruments API endpoints."""
from httpx import AsyncClient


class TestListAvailableInstruments:
    async def test_returns_system_instruments(self, client: AsyncClient, test_instrument):
        resp = await client.get("/api/instruments/available")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert any(i["name"] == "Violin" for i in data)

    async def test_excludes_already_owned_instruments(
        self, client: AsyncClient, test_user_instrument
    ):
        resp = await client.get("/api/instruments/available")
        assert resp.status_code == 200
        # The instrument is owned, so it should NOT appear in available
        data = resp.json()
        assert not any(i["name"] == "Violin" for i in data)

    async def test_requires_auth(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/instruments/available")
        assert resp.status_code == 401


class TestGetInstrument:
    async def test_get_system_instrument(self, client: AsyncClient, test_instrument):
        resp = await client.get(f"/api/instruments/{test_instrument.id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Violin"

    async def test_nonexistent_instrument(self, client: AsyncClient):
        resp = await client.get("/api/instruments/99999")
        assert resp.status_code == 404
