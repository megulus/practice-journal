"""Tests for block types API endpoints."""
from httpx import AsyncClient


class TestListBlockTypes:
    async def test_returns_system_block_types(self, client: AsyncClient, test_block_type):
        resp = await client.get("/api/block-types/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert any(bt["slug"] == "warm-up" for bt in data)

    async def test_empty_when_no_block_types(self, client: AsyncClient):
        resp = await client.get("/api/block-types/")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_requires_auth(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/block-types/")
        assert resp.status_code == 401
