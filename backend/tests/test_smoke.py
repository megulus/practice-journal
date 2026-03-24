"""
Smoke tests proving the full integration stack works:
client -> FastAPI endpoint -> test database -> response.

During the Kantelo rebuild, only health endpoints are active.
Route-specific tests will be added as new API modules land.
"""
import pytest
from httpx import AsyncClient


class TestHealthEndpoints:
    """Basic connectivity tests."""

    async def test_root(self, client: AsyncClient):
        resp = await client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "Kantelo API"

    async def test_health(self, client: AsyncClient):
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"


class TestDatabaseConnection:
    """Verify the test database is set up and models work."""

    async def test_user_fixture_persists(self, client, test_user):
        """The test_user fixture should create a real DB row."""
        assert test_user.id is not None
        assert test_user.clerk_user_id == "test_clerk_user_1"

    async def test_instrument_fixture_persists(self, client, test_instrument):
        """The test_instrument fixture should create a real DB row."""
        assert test_instrument.id is not None
        assert test_instrument.name == "Violin"
        assert test_instrument.user_id is not None
