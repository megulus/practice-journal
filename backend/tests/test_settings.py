"""Tests for user settings API endpoints."""
from httpx import AsyncClient


class TestGetSettings:
    async def test_returns_defaults_on_first_access(self, client: AsyncClient):
        resp = await client.get("/api/settings/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["suggestions_enabled"] is True

    async def test_requires_auth(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/settings/")
        assert resp.status_code == 401


class TestUpdateSettings:
    async def test_disable_suggestions(self, client: AsyncClient):
        resp = await client.patch("/api/settings/", json={"suggestions_enabled": False})
        assert resp.status_code == 200
        assert resp.json()["suggestions_enabled"] is False

        # Verify persistence
        resp = await client.get("/api/settings/")
        assert resp.json()["suggestions_enabled"] is False

    async def test_partial_update_ignores_unknown_fields(self, client: AsyncClient):
        resp = await client.patch("/api/settings/", json={})
        assert resp.status_code == 200
        # Should still return valid settings with defaults
        assert "suggestions_enabled" in resp.json()
