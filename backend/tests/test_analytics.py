"""Tests for analytics API endpoints."""
from datetime import date

from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import PracticeLog, User


class TestGetAnalytics:
    async def test_empty_initially(self, client: AsyncClient):
        resp = await client.get("/api/analytics/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_sessions"] == 0
        assert data["total_minutes"] == 0
        assert data["average_duration"] == 0

    async def test_reflects_logged_sessions(self, client: AsyncClient):
        await client.post(
            "/api/logs/",
            json={"practice_date": "2026-03-01", "duration_minutes": 30},
        )
        await client.post(
            "/api/logs/",
            json={"practice_date": "2026-03-02", "duration_minutes": 60},
        )
        resp = await client.get("/api/analytics/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_sessions"] == 2
        assert data["total_minutes"] == 90
        assert data["average_duration"] == 45.0

    async def test_filter_by_template(self, client: AsyncClient, test_template):
        # Create log with template
        await client.post(
            "/api/logs/",
            json={
                "template_id": test_template.id,
                "practice_date": "2026-03-01",
                "duration_minutes": 30,
            },
        )
        # Create log without template
        await client.post(
            "/api/logs/",
            json={"practice_date": "2026-03-02", "duration_minutes": 60},
        )
        resp = await client.get(f"/api/analytics/?template_id={test_template.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_sessions"] == 1
        assert data["total_minutes"] == 30

    async def test_user_isolation(
        self, client: AsyncClient, db_session: AsyncSession, other_user: User
    ):
        """Analytics only reflect the requesting user's data."""
        # User 1 logs 30 minutes via API
        await client.post(
            "/api/logs/",
            json={"practice_date": "2026-03-01", "duration_minutes": 30},
        )
        # Insert a log for other_user directly in DB
        other_log = PracticeLog(
            user_id=other_user.id,
            practice_date=date(2026, 3, 2),
            duration_minutes=60,
        )
        db_session.add(other_log)
        await db_session.commit()

        # User 1 analytics should only show their 30-minute session
        resp = await client.get("/api/analytics/")
        data = resp.json()
        assert data["total_sessions"] == 1
        assert data["total_minutes"] == 30

    async def test_requires_auth(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/analytics/")
        assert resp.status_code == 401
