"""Tests for /api/progress/insights endpoints (heatmap, comparison, ratings)."""
import pytest
from datetime import date, datetime, timedelta, timezone
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import (
    Instrument, PracticeLog, SectionLog, BlockLog, UserSettings,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _today() -> date:
    return datetime.now(timezone.utc).date()


def _days_ago(n: int) -> date:
    return _today() - timedelta(days=n)


async def _make_instrument(db, user, *, name="Violin"):
    inst = Instrument(user_id=user.id, name=name, practice_frequency="daily")
    db.add(inst)
    await db.commit()
    await db.refresh(inst)
    return inst


async def _make_log(db, user, instrument, *, days_ago=0, duration=30):
    log = PracticeLog(
        user_id=user.id, instrument_id=instrument.id,
        status="completed", practice_date=_days_ago(days_ago),
        total_duration_minutes=duration,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


async def _make_log_with_ratings(
    db, user, instrument, *, days_ago=0, ratings=None,
):
    """Create a completed log with block logs that have specific ratings."""
    log = await _make_log(db, user, instrument, days_ago=days_ago, duration=30)
    sl = SectionLog(
        practice_log_id=log.id, section_type="warmup",
        section_name="Warm-up", actual_duration_minutes=10, display_order=0,
    )
    db.add(sl)
    await db.commit()
    await db.refresh(sl)

    for i, rating in enumerate(ratings or []):
        bl = BlockLog(
            section_log_id=sl.id, block_name=f"Ex {i + 1}",
            rating=rating, completed=True, display_order=i,
        )
        db.add(bl)
    await db.commit()
    return log


async def _set_week_starts_on(db, user, value):
    from sqlmodel import select
    result = await db.exec(
        select(UserSettings).where(UserSettings.user_id == user.id)
    )
    settings = result.first()
    if settings:
        settings.week_starts_on = value
        db.add(settings)
    else:
        settings = UserSettings(user_id=user.id, week_starts_on=value)
        db.add(settings)
    await db.commit()


# ===========================================================================
# Heatmap tests
# ===========================================================================

class TestHeatmap:
    async def test_basic(self, client: AsyncClient, db_session, test_user):
        inst = await _make_instrument(db_session, test_user)
        await _make_log(db_session, test_user, inst, days_ago=1, duration=25)
        await _make_log(db_session, test_user, inst, days_ago=3, duration=35)

        resp = await client.get(
            f"/api/progress/insights/heatmap?instrument_id={inst.id}"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["year"] == _today().year
        assert len(data["days"]) == 2
        dates = {d["date"] for d in data["days"]}
        assert _days_ago(1).isoformat() in dates
        assert _days_ago(3).isoformat() in dates

    async def test_year_filter(self, client: AsyncClient, db_session, test_user):
        inst = await _make_instrument(db_session, test_user)
        await _make_log(db_session, test_user, inst, days_ago=1, duration=25)

        resp = await client.get(
            f"/api/progress/insights/heatmap?instrument_id={inst.id}&year=2020"
        )
        data = resp.json()
        assert data["year"] == 2020
        assert len(data["days"]) == 0

    async def test_multiple_logs_same_date_summed(
        self, client: AsyncClient, db_session, test_user
    ):
        inst = await _make_instrument(db_session, test_user)
        await _make_log(db_session, test_user, inst, days_ago=1, duration=20)
        await _make_log(db_session, test_user, inst, days_ago=1, duration=15)

        resp = await client.get(
            f"/api/progress/insights/heatmap?instrument_id={inst.id}"
        )
        data = resp.json()
        assert len(data["days"]) == 1
        assert data["days"][0]["duration_minutes"] == 35

    async def test_instrument_filter(
        self, client: AsyncClient, db_session, test_user
    ):
        violin = await _make_instrument(db_session, test_user, name="Violin")
        piano = await _make_instrument(db_session, test_user, name="Piano")
        await _make_log(db_session, test_user, violin, days_ago=1, duration=20)
        await _make_log(db_session, test_user, piano, days_ago=1, duration=30)

        resp = await client.get(
            f"/api/progress/insights/heatmap?instrument_id={violin.id}"
        )
        data = resp.json()
        assert len(data["days"]) == 1
        assert data["days"][0]["duration_minutes"] == 20

    async def test_all_instruments(
        self, client: AsyncClient, db_session, test_user
    ):
        violin = await _make_instrument(db_session, test_user, name="Violin")
        piano = await _make_instrument(db_session, test_user, name="Piano")
        await _make_log(db_session, test_user, violin, days_ago=1, duration=20)
        await _make_log(db_session, test_user, piano, days_ago=1, duration=30)

        resp = await client.get("/api/progress/insights/heatmap")
        data = resp.json()
        assert len(data["days"]) == 1
        # Combined duration
        assert data["days"][0]["duration_minutes"] == 50


# ===========================================================================
# Comparison tests
# ===========================================================================

class TestComparison:
    async def test_basic(self, client: AsyncClient, db_session, test_user):
        inst = await _make_instrument(db_session, test_user)
        # Log today (this week)
        await _make_log(db_session, test_user, inst, days_ago=0, duration=30)

        resp = await client.get(
            f"/api/progress/insights/comparison?instrument_id={inst.id}"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["this_week"]["days_practiced"] >= 1
        assert data["this_week"]["total_minutes"] >= 30
        assert len(data["this_week"]["daily"]) == 7
        # All day names present
        day_names = [d["day"] for d in data["this_week"]["daily"]]
        assert "monday" in day_names
        assert "sunday" in day_names

    async def test_week_starts_on_sunday(
        self, client: AsyncClient, db_session, test_user
    ):
        await _set_week_starts_on(db_session, test_user, "sunday")
        inst = await _make_instrument(db_session, test_user)
        await _make_log(db_session, test_user, inst, days_ago=0, duration=25)

        resp = await client.get(
            f"/api/progress/insights/comparison?instrument_id={inst.id}"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["this_week"]["total_minutes"] >= 25

    async def test_no_practice(self, client: AsyncClient, db_session, test_user):
        inst = await _make_instrument(db_session, test_user)

        resp = await client.get(
            f"/api/progress/insights/comparison?instrument_id={inst.id}"
        )
        data = resp.json()
        assert data["this_week"]["days_practiced"] == 0
        assert data["this_week"]["total_minutes"] == 0
        assert data["last_week"]["days_practiced"] == 0
        assert data["delta_days"] == 0
        assert data["delta_minutes"] == 0

    async def test_all_instruments(
        self, client: AsyncClient, db_session, test_user
    ):
        violin = await _make_instrument(db_session, test_user, name="Violin")
        piano = await _make_instrument(db_session, test_user, name="Piano")
        await _make_log(db_session, test_user, violin, days_ago=0, duration=20)
        await _make_log(db_session, test_user, piano, days_ago=0, duration=30)

        resp = await client.get("/api/progress/insights/comparison")
        data = resp.json()
        assert data["this_week"]["total_minutes"] >= 50


# ===========================================================================
# Ratings tests
# ===========================================================================

class TestRatings:
    async def test_basic(self, client: AsyncClient, db_session, test_user):
        inst = await _make_instrument(db_session, test_user)
        await _make_log_with_ratings(
            db_session, test_user, inst, days_ago=0,
            ratings=[-1, 0, 0, 1, 1, 1],
        )

        resp = await client.get(
            f"/api/progress/insights/ratings?instrument_id={inst.id}"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["weeks"]) == 4  # default
        # Find the week with data
        current_week = data["weeks"][0]
        assert current_week["step_back"] == 1
        assert current_week["steady"] == 2
        assert current_week["step_forward"] == 3
        assert current_week["total"] == 6

    async def test_excludes_null_ratings(
        self, client: AsyncClient, db_session, test_user
    ):
        inst = await _make_instrument(db_session, test_user)
        await _make_log_with_ratings(
            db_session, test_user, inst, days_ago=0,
            ratings=[1, None, 0, None],
        )

        resp = await client.get(
            f"/api/progress/insights/ratings?instrument_id={inst.id}"
        )
        data = resp.json()
        current_week = data["weeks"][0]
        assert current_week["total"] == 2
        assert current_week["step_forward"] == 1
        assert current_week["steady"] == 1

    async def test_week_starts_on_respected(
        self, client: AsyncClient, db_session, test_user
    ):
        await _set_week_starts_on(db_session, test_user, "sunday")
        inst = await _make_instrument(db_session, test_user)
        await _make_log_with_ratings(
            db_session, test_user, inst, days_ago=0, ratings=[1],
        )

        resp = await client.get(
            f"/api/progress/insights/ratings?instrument_id={inst.id}"
        )
        data = resp.json()
        # Week start should be a Sunday
        week_start = date.fromisoformat(data["weeks"][0]["week_start"])
        assert week_start.weekday() == 6  # Sunday

    async def test_weeks_param(
        self, client: AsyncClient, db_session, test_user
    ):
        inst = await _make_instrument(db_session, test_user)
        await _make_log_with_ratings(
            db_session, test_user, inst, days_ago=0, ratings=[1],
        )

        resp = await client.get(
            f"/api/progress/insights/ratings?instrument_id={inst.id}&weeks=2"
        )
        data = resp.json()
        assert len(data["weeks"]) == 2

    async def test_missing_instrument_id_returns_422(
        self, client: AsyncClient,
    ):
        resp = await client.get("/api/progress/insights/ratings")
        assert resp.status_code == 422


# ===========================================================================
# Auth
# ===========================================================================

class TestAuth:
    async def test_unauthenticated_heatmap(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/progress/insights/heatmap")
        assert resp.status_code == 401

    async def test_unauthenticated_comparison(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/progress/insights/comparison")
        assert resp.status_code == 401

    async def test_unauthenticated_ratings(self, unauth_client: AsyncClient):
        resp = await unauth_client.get(
            "/api/progress/insights/ratings?instrument_id=1"
        )
        assert resp.status_code == 401
