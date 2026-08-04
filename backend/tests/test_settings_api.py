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

    async def test_empty_body_returns_unchanged(self, client: AsyncClient):
        await client.get("/api/settings")
        resp = await client.patch("/api/settings", json={})
        assert resp.status_code == 200
        data = resp.json()
        assert data["suggestions_preference"] == "all"
        assert data["default_session_duration_minutes"] == 30
        assert data["week_starts_on"] == "monday"

    async def test_invalid_duration_returns_422(self, client: AsyncClient):
        resp = await client.patch(
            "/api/settings",
            json={"default_session_duration_minutes": 0},
        )
        assert resp.status_code == 422

    async def test_unauthenticated_returns_401(self, unauth_client: AsyncClient):
        resp = await unauth_client.patch(
            "/api/settings",
            json={"suggestions_preference": "off"},
        )
        assert resp.status_code == 401


class TestSettingsCrossUserIsolation:
    async def test_users_have_separate_settings(
        self, db_session, test_user, other_user
    ):
        """Verify settings are scoped per-user at the DB level."""
        from app.models import UserSettings

        # Create settings for both users
        s1 = UserSettings(user_id=test_user.id, suggestions_preference="off")
        s2 = UserSettings(user_id=other_user.id)  # defaults
        db_session.add(s1)
        db_session.add(s2)
        await db_session.commit()

        from sqlmodel import select

        # Verify each user sees their own settings
        result = await db_session.exec(
            select(UserSettings).where(UserSettings.user_id == test_user.id)
        )
        assert result.first().suggestions_preference == "off"

        result = await db_session.exec(
            select(UserSettings).where(UserSettings.user_id == other_user.id)
        )
        assert result.first().suggestions_preference == "all"


class TestConcurrentAutoCreate:
    async def test_racing_creates_do_not_error(self, test_engine, test_user):
        """
        Two requests that both find no settings row must not 500.

        Progress → Insights loads three endpoints at once and two of them
        (`comparison`, `ratings`) resolve the user's week_starts_on, so a
        user's first visit runs the auto-create twice in parallel. The unique
        index on user_id means one insert loses; it has to re-read instead of
        raising.
        """
        import asyncio

        from sqlalchemy.ext.asyncio import async_sessionmaker
        from sqlmodel.ext.asyncio.session import AsyncSession

        from app.api.settings_api import _get_or_create_settings

        factory = async_sessionmaker(
            test_engine, class_=AsyncSession, expire_on_commit=False
        )
        sessions = [factory() for _ in range(4)]
        try:
            results = await asyncio.gather(
                *(_get_or_create_settings(s, test_user.id) for s in sessions)
            )
        finally:
            for s in sessions:
                await s.close()

        assert {r.user_id for r in results} == {test_user.id}
        assert len({r.id for r in results}) == 1

    async def test_insights_endpoints_load_together_for_a_new_user(
        self, client: AsyncClient, test_instrument
    ):
        """The three Insights requests the frontend fires in parallel."""
        import asyncio

        responses = await asyncio.gather(
            client.get(
                f"/api/progress/insights/heatmap?instrument_id={test_instrument.id}"
            ),
            client.get(
                f"/api/progress/insights/comparison?instrument_id={test_instrument.id}"
            ),
            client.get(
                f"/api/progress/insights/ratings?instrument_id={test_instrument.id}&weeks=4"
            ),
        )

        assert [r.status_code for r in responses] == [200, 200, 200]
