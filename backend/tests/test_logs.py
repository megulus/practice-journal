"""Tests for practice logs API endpoints."""
from datetime import date

from httpx import AsyncClient


class TestCreateLog:
    async def test_create_simple_log(self, client: AsyncClient):
        resp = await client.post(
            "/api/logs/",
            json={
                "practice_date": "2026-03-01",
                "duration_minutes": 45,
                "notes": "Good session",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["duration_minutes"] == 45
        assert data["notes"] == "Good session"
        assert data["practice_date"] == "2026-03-01"

    async def test_create_log_with_details(self, client: AsyncClient):
        resp = await client.post(
            "/api/logs/",
            json={
                "practice_date": "2026-03-01",
                "duration_minutes": 60,
                "log_details": [
                    {"section_type": "warmup", "content": "Long tones"},
                    {
                        "section_type": "scales",
                        "content": "G Major",
                        "duration_minutes": 15,
                    },
                ],
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert len(data["log_details"]) == 2
        assert data["log_details"][0]["section_type"] == "warmup"

    async def test_create_log_with_template(self, client: AsyncClient, test_template):
        resp = await client.post(
            "/api/logs/",
            json={
                "template_id": test_template.id,
                "day_number": 1,
                "practice_date": "2026-03-01",
                "duration_minutes": 30,
            },
        )
        assert resp.status_code == 201
        assert resp.json()["template_id"] == test_template.id

    async def test_create_log_invalid_template(self, client: AsyncClient):
        resp = await client.post(
            "/api/logs/",
            json={
                "template_id": 99999,
                "practice_date": "2026-03-01",
                "duration_minutes": 30,
            },
        )
        assert resp.status_code == 404

    async def test_requires_auth(self, unauth_client: AsyncClient):
        resp = await unauth_client.post(
            "/api/logs/",
            json={
                "practice_date": "2026-03-01",
                "duration_minutes": 30,
            },
        )
        assert resp.status_code == 401


class TestListLogs:
    async def test_empty_initially(self, client: AsyncClient):
        resp = await client.get("/api/logs/")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_returns_created_logs(self, client: AsyncClient):
        # Create a log
        await client.post(
            "/api/logs/",
            json={"practice_date": "2026-03-01", "duration_minutes": 30},
        )
        resp = await client.get("/api/logs/")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    async def test_filter_by_template(self, client: AsyncClient, test_template):
        # Create logs with and without template
        await client.post(
            "/api/logs/",
            json={
                "template_id": test_template.id,
                "practice_date": "2026-03-01",
                "duration_minutes": 30,
            },
        )
        await client.post(
            "/api/logs/",
            json={"practice_date": "2026-03-02", "duration_minutes": 20},
        )
        resp = await client.get(f"/api/logs/?template_id={test_template.id}")
        assert resp.status_code == 200
        assert len(resp.json()) == 1


class TestGetLog:
    async def test_get_log(self, client: AsyncClient):
        create_resp = await client.post(
            "/api/logs/",
            json={"practice_date": "2026-03-01", "duration_minutes": 45},
        )
        log_id = create_resp.json()["id"]

        resp = await client.get(f"/api/logs/{log_id}")
        assert resp.status_code == 200
        assert resp.json()["duration_minutes"] == 45

    async def test_nonexistent_log(self, client: AsyncClient):
        resp = await client.get("/api/logs/99999")
        assert resp.status_code == 404


class TestSectionTypes:
    async def test_empty_initially(self, client: AsyncClient):
        resp = await client.get("/api/logs/section-types")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_returns_distinct_types(self, client: AsyncClient):
        await client.post(
            "/api/logs/",
            json={
                "practice_date": "2026-03-01",
                "duration_minutes": 30,
                "log_details": [
                    {"section_type": "warmup"},
                    {"section_type": "scales"},
                    {"section_type": "warmup"},  # duplicate
                ],
            },
        )
        resp = await client.get("/api/logs/section-types")
        assert resp.status_code == 200
        types = resp.json()
        assert "warmup" in types
        assert "scales" in types
        assert len(types) == 2  # no duplicates
