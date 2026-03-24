"""Tests for GET /api/user/me"""
import pytest
from httpx import AsyncClient


class TestGetMe:
    async def test_returns_current_user(self, client: AsyncClient, test_user):
        resp = await client.get("/api/user/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == test_user.id
        assert data["email"] == "test@example.com"
        assert data["first_name"] == "Test"
        assert data["last_name"] == "User"
        assert "created_at" in data

    async def test_unauthenticated_returns_401(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/user/me")
        assert resp.status_code == 401
