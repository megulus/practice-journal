"""Tests for GET/PATCH /api/settings"""
import pytest
from httpx import AsyncClient


class TestGetSettings:
    async def test_auto_creates_defaults(self, client: AsyncClient):
        resp = await client.get("/api/settings")
        assert resp.status_code == 200
        data = resp.json()
        assert data["suggestions_preference"] == "all"
        assert data["default_session_duration_minutes"] == 30
        assert data["week_starts_on"] == "monday"

    async def test_returns_existing_settings(self, client: AsyncClient):
        # First call creates, second returns the same
        resp1 = await client.get("/api/settings")
        resp2 = await client.get("/api/settings")
        assert resp1.json() == resp2.json()

    async def test_unauthenticated_returns_401(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/settings")
        assert resp.status_code == 401


class TestUpdateSettings:
    async def test_partial_update(self, client: AsyncClient):
        # Ensure settings exist
        await client.get("/api/settings")

        resp = await client.patch(
            "/api/settings",
            json={"suggestions_preference": "fewer"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["suggestions_preference"] == "fewer"
        # Unchanged fields keep defaults
        assert data["default_session_duration_minutes"] == 30
        assert data["week_starts_on"] == "monday"

    async def test_update_multiple_fields(self, client: AsyncClient):
        await client.get("/api/settings")

        resp = await client.patch(
            "/api/settings",
            json={
                "default_session_duration_minutes": 45,
                "week_starts_on": "sunday",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["default_session_duration_minutes"] == 45
        assert data["week_starts_on"] == "sunday"

    async def test_invalid_enum_returns_422(self, client: AsyncClient):
        await client.get("/api/settings")

        resp = await client.patch(
            "/api/settings",
            json={"suggestions_preference": "invalid_value"},
        )
        assert resp.status_code == 422

    async def test_update_creates_settings_if_missing(self, client: AsyncClient):
        resp = await client.patch(
            "/api/settings",
            json={"suggestions_preference": "off"},
        )
        assert resp.status_code == 200
        assert resp.json()["suggestions_preference"] == "off"

    async def test_unauthenticated_returns_401(self, unauth_client: AsyncClient):
        resp = await unauth_client.patch(
            "/api/settings",
            json={"suggestions_preference": "off"},
        )
        assert resp.status_code == 401
