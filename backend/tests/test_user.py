"""Tests for user API endpoints."""
from httpx import AsyncClient


class TestGetCurrentUser:
    async def test_authenticated_user(self, client: AsyncClient, test_user):
        resp = await client.get("/api/user/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["authenticated"] is True
        assert data["user"]["email"] == "test@example.com"
        assert data["user"]["first_name"] == "Test"

    async def test_unauthenticated_user(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/user/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["authenticated"] is False
