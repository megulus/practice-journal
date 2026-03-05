"""
Smoke tests proving the full integration stack works:
client -> FastAPI endpoint -> test database -> response.
"""
import pytest
from httpx import AsyncClient


class TestHealthEndpoints:
    """Basic connectivity tests."""

    async def test_root(self, client: AsyncClient):
        resp = await client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "Practice Journal API"

    async def test_health(self, client: AsyncClient):
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"


class TestAuthEnforcement:
    """Verify that protected endpoints reject unauthenticated requests."""

    async def test_available_instruments_requires_auth(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/instruments/available")
        assert resp.status_code == 401

    async def test_templates_requires_auth(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/templates/")
        assert resp.status_code == 401


class TestFullStack:
    """End-to-end: authenticated request -> DB write -> DB read -> response."""

    async def test_list_user_instruments_empty(self, client: AsyncClient):
        resp = await client.get("/api/user/instruments/")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_create_template(
        self, client: AsyncClient, test_user_instrument
    ):
        resp = await client.post(
            "/api/templates/",
            json={
                "user_instrument_id": test_user_instrument.id,
                "name": "Smoke Test Template",
                "days_count": 3,
            },
        )
        assert resp.status_code in (200, 201), resp.text
        data = resp.json()
        assert data["name"] == "Smoke Test Template"
        assert data["days_count"] == 3
