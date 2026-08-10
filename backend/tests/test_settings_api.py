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
        assert data["theme_preference"] == "system"

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
        assert data["theme_preference"] == "system"

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

    @pytest.mark.parametrize("theme", ["system", "light", "dark"])
    async def test_update_theme_preference(self, client: AsyncClient, theme: str):
        await client.get("/api/settings")

        resp = await client.patch(
            "/api/settings",
            json={"theme_preference": theme},
        )
        assert resp.status_code == 200
        assert resp.json()["theme_preference"] == theme

    async def test_theme_preference_persists(self, client: AsyncClient):
        await client.patch("/api/settings", json={"theme_preference": "dark"})
        resp = await client.get("/api/settings")
        assert resp.json()["theme_preference"] == "dark"

    async def test_invalid_enum_returns_422(self, client: AsyncClient):
        await client.get("/api/settings")

        resp = await client.patch(
            "/api/settings",
            json={"suggestions_preference": "invalid_value"},
        )
        assert resp.status_code == 422

    async def test_invalid_theme_returns_422(self, client: AsyncClient):
        await client.get("/api/settings")

        resp = await client.patch(
            "/api/settings",
            json={"theme_preference": "sepia"},
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
        assert data["theme_preference"] == "system"

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
        index on user_id means only one insert can land; the rest have to
        no-op via ON CONFLICT DO NOTHING and read the winner's row back.
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

    async def test_upsert_sends_every_required_column(
        self, test_engine, db_session, test_user
    ):
        """
        The auto-create supplies only user_id and leans on SQLAlchemy Core to
        apply the model's column-level defaults. This pins that the INSERT it
        actually emits names every NOT NULL column the DB won't fill in itself,
        so a column added later with no default of any kind — which would fail
        at runtime with a NOT NULL violation — is caught here instead.

        It inspects the statement the production code sends rather than
        re-deriving it, so it tracks the create path rather than restating it.
        """
        from sqlalchemy import event

        from app.api.settings_api import _get_or_create_settings
        from app.models import UserSettings

        inserts: list[str] = []

        def record(conn, cursor, statement, parameters, context, executemany):
            if "INSERT INTO user_settings" in statement:
                inserts.append(statement)

        event.listen(test_engine.sync_engine, "before_cursor_execute", record)
        try:
            await _get_or_create_settings(db_session, test_user.id)
        finally:
            event.remove(test_engine.sync_engine, "before_cursor_execute", record)

        assert len(inserts) == 1, f"expected one INSERT, got {len(inserts)}"
        # The column list is everything between the table name and the VALUES.
        columns = inserts[0].split("(", 1)[1].split(")", 1)[0]
        named = {c.strip() for c in columns.split(",")}

        required = {
            c.name
            for c in UserSettings.__table__.columns
            if not c.nullable and not c.primary_key and c.server_default is None
        }
        assert required <= named, f"columns missing from the INSERT: {required - named}"

    async def test_upsert_writes_the_model_defaults(self, db_session, test_user):
        """The auto-created row carries the documented defaults."""
        from datetime import timedelta, timezone

        from sqlmodel import select

        from app.api.settings_api import _get_or_create_settings
        from app.enums import utcnow
        from app.models import UserSettings

        await _get_or_create_settings(db_session, test_user.id)

        result = await db_session.exec(
            select(UserSettings).where(UserSettings.user_id == test_user.id)
        )
        settings = result.first()

        assert settings.suggestions_preference == "all"
        assert settings.default_session_duration_minutes == 30
        assert settings.week_starts_on == "monday"
        assert settings.theme_preference == "system"
        # TIMESTAMPTZ reads back tz-aware whatever the insert path, so compare
        # instants rather than tzinfo: what matters is that created_at was
        # populated with a sane "now" and not left to chance.
        assert settings.created_at is not None
        now = utcnow().replace(tzinfo=timezone.utc)
        assert abs(now - settings.created_at) < timedelta(minutes=5)
