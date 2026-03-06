"""
Shared test fixtures for backend integration tests.

Provides:
- Isolated test database (created per session, cleaned up on success)
- Async DB session fixture
- FastAPI test client with auth and session overrides
- Factory fixtures for common data
"""
import asyncio
import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_DB_HOST = os.getenv("DB_HOST", "db" if os.path.exists("/.dockerenv") else "localhost")

_BASE_DB_URL = os.getenv(
    "TEST_BASE_DB_URL",
    f"postgresql+asyncpg://practice_user:practice_pass@{_DB_HOST}:5432/postgres",
)

TEST_DB_NAME = "practice_journal_test"
assert "test" in TEST_DB_NAME, "Refusing to run tests against a non-test database"

_TEST_DB_URL = os.getenv(
    "TEST_DATABASE_URL",
    f"postgresql+asyncpg://practice_user:practice_pass@{_DB_HOST}:5432/{TEST_DB_NAME}",
)

# Point the app's database config at the test DB so the lifespan handler
# (connection pool warmup) doesn't touch the dev database.
os.environ["DATABASE_URL"] = _TEST_DB_URL

# Clear the cached settings so the app picks up the test DATABASE_URL.
from app.config import get_settings
get_settings.cache_clear()

_session_failed = False


# ---------------------------------------------------------------------------
# Test database lifecycle (session-scoped, sync wrapper)
# ---------------------------------------------------------------------------

async def _setup_test_db():
    """Create the test database."""
    engine = create_async_engine(_BASE_DB_URL, isolation_level="AUTOCOMMIT")
    async with engine.connect() as conn:
        await conn.execute(text(f'DROP DATABASE IF EXISTS "{TEST_DB_NAME}"'))
        await conn.execute(text(f'CREATE DATABASE "{TEST_DB_NAME}"'))
    await engine.dispose()


async def _teardown_test_db():
    """Drop the test database."""
    engine = create_async_engine(_BASE_DB_URL, isolation_level="AUTOCOMMIT")
    async with engine.connect() as conn:
        await conn.execute(text(f'DROP DATABASE IF EXISTS "{TEST_DB_NAME}"'))
    await engine.dispose()


async def _create_tables():
    """Create all SQLModel tables in the test database."""
    engine = create_async_engine(_TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    await engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Create test DB at session start, conditionally drop at end."""
    global _session_failed

    asyncio.run(_setup_test_db())
    asyncio.run(_create_tables())

    yield

    if _session_failed:
        print(f"\n⚠ Tests FAILED — preserving test database '{TEST_DB_NAME}' for debugging.")
        print(f"  Drop manually: DROP DATABASE {TEST_DB_NAME};")
    else:
        asyncio.run(_teardown_test_db())


# ---------------------------------------------------------------------------
# Per-test engine and session
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def test_engine():
    """Per-test async engine."""
    engine = create_async_engine(_TEST_DB_URL, echo=False, pool_size=5)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine):
    """Per-test async session. Truncates all tables after each test for isolation.

    NOTE: Fixture data must be committed (not just flushed) to be visible
    to the HTTP client, which uses a separate session.
    """
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    session = factory()
    try:
        yield session
    finally:
        await session.close()
        # Truncate all tables after each test for clean isolation
        async with test_engine.begin() as conn:
            for table in reversed(SQLModel.metadata.sorted_tables):
                await conn.execute(text(f'TRUNCATE TABLE "{table.name}" CASCADE'))
            await conn.commit()


# ---------------------------------------------------------------------------
# FastAPI test client
# ---------------------------------------------------------------------------

from app.models import User


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """A persisted test user."""
    user = User(
        clerk_user_id="test_clerk_user_1",
        email="test@example.com",
        first_name="Test",
        last_name="User",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def other_user(db_session: AsyncSession) -> User:
    """A second test user for cross-user isolation tests."""
    user = User(
        clerk_user_id="test_clerk_user_2",
        email="other@example.com",
        first_name="Other",
        last_name="User",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


def _make_session_override(test_engine):
    """Shared session override factory for test clients."""
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    async def override():
        session = factory()
        try:
            yield session
        finally:
            await session.close()

    return override


@pytest_asyncio.fixture
async def client(test_engine, test_user: User):
    """
    Async HTTP client wired to the FastAPI app with:
    - get_session overridden to use a fresh test DB session per request
    - get_current_user overridden to return the test user
    """
    from app.main import app
    from app.database import get_session
    from app.auth import get_current_user, get_current_user_optional

    async def _override_current_user():
        return test_user

    async def _override_current_user_optional():
        return test_user

    app.dependency_overrides[get_session] = _make_session_override(test_engine)
    app.dependency_overrides[get_current_user] = _override_current_user
    app.dependency_overrides[get_current_user_optional] = _override_current_user_optional

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    del app.dependency_overrides[get_session]
    del app.dependency_overrides[get_current_user]
    del app.dependency_overrides[get_current_user_optional]


@pytest_asyncio.fixture
async def unauth_client(test_engine):
    """
    Async HTTP client with NO auth — for testing unauthenticated access.
    """
    from app.main import app
    from app.database import get_session
    from app.auth import get_current_user, get_current_user_optional

    async def _override_current_user():
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    async def _override_current_user_optional():
        return None

    app.dependency_overrides[get_session] = _make_session_override(test_engine)
    app.dependency_overrides[get_current_user] = _override_current_user
    app.dependency_overrides[get_current_user_optional] = _override_current_user_optional

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    del app.dependency_overrides[get_session]
    del app.dependency_overrides[get_current_user]
    del app.dependency_overrides[get_current_user_optional]


# ---------------------------------------------------------------------------
# Factory fixtures for common data
# ---------------------------------------------------------------------------

from app.models import Instrument, UserInstrument, PracticeTemplate, PracticeDay, BlockType


@pytest_asyncio.fixture
async def test_instrument(db_session: AsyncSession) -> Instrument:
    """A system instrument."""
    instrument = Instrument(name="Violin", is_system=True)
    db_session.add(instrument)
    await db_session.commit()
    await db_session.refresh(instrument)
    return instrument


@pytest_asyncio.fixture
async def test_user_instrument(
    db_session: AsyncSession, test_user: User, test_instrument: Instrument
) -> UserInstrument:
    """Link the test user to the test instrument."""
    ui = UserInstrument(user_id=test_user.id, instrument_id=test_instrument.id)
    db_session.add(ui)
    await db_session.commit()
    await db_session.refresh(ui)
    return ui


@pytest_asyncio.fixture
async def test_block_type(db_session: AsyncSession) -> BlockType:
    """A system block type."""
    bt = BlockType(slug="warm-up", label="Warm-Up", default_duration_minutes=10, is_system=True)
    db_session.add(bt)
    await db_session.commit()
    await db_session.refresh(bt)
    return bt


@pytest_asyncio.fixture
async def test_template(
    db_session: AsyncSession, test_user: User, test_user_instrument: UserInstrument
) -> PracticeTemplate:
    """A practice template with one day."""
    template = PracticeTemplate(
        user_id=test_user.id,
        user_instrument_id=test_user_instrument.id,
        name="Test Practice Rotation",
        days_count=1,
    )
    db_session.add(template)
    await db_session.commit()
    await db_session.refresh(template)

    day = PracticeDay(template_id=template.id, day_number=1, title="Day 1")
    db_session.add(day)
    await db_session.commit()

    return template


# ---------------------------------------------------------------------------
# Hook: track test failures for conditional DB cleanup
# ---------------------------------------------------------------------------

def pytest_runtest_makereport(item, call):
    """Pytest hook to detect test failures."""
    global _session_failed
    if call.when == "call" and call.excinfo is not None:
        _session_failed = True
