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


async def _run_migrations():
    """Run Alembic migrations against the test database.

    Uses the real migration rather than SQLModel.metadata.create_all so that
    column types (e.g. TIMESTAMPTZ), partial indexes, and SET NULL FKs match
    what runs in production.
    """
    from alembic.config import Config
    from alembic import command
    from alembic.runtime.environment import EnvironmentContext
    from alembic.script import ScriptDirectory
    from sqlalchemy import pool

    alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    alembic_cfg.set_main_option("sqlalchemy.url", _TEST_DB_URL)

    engine = create_async_engine(_TEST_DB_URL, poolclass=pool.NullPool)
    script = ScriptDirectory.from_config(alembic_cfg)

    def do_upgrade(rev, context):
        return script._upgrade_revs("head", rev)

    async with engine.connect() as connection:
        context = EnvironmentContext(alembic_cfg, script, fn=do_upgrade)
        await connection.run_sync(
            lambda sync_conn: context.configure(
                connection=sync_conn, target_metadata=SQLModel.metadata
            )
        )
        await connection.run_sync(lambda sync_conn: context.run_migrations())
        await connection.commit()

    await engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Create test DB at session start, conditionally drop at end."""
    global _session_failed

    asyncio.run(_setup_test_db())
    asyncio.run(_run_migrations())

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
async def other_user_client(test_engine, other_user: User):
    """Async HTTP client authenticated as other_user.

    WARNING: Do not use in the same test as `client` — both share the same
    app.dependency_overrides dict and will interfere with each other.
    """
    from app.main import app
    from app.database import get_session
    from app.auth import get_current_user, get_current_user_optional

    async def _override_current_user():
        return other_user

    async def _override_current_user_optional():
        return other_user

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
# Factory fixtures for common data (Kantelo schema)
# ---------------------------------------------------------------------------

from app.models import Instrument, Template, TemplateSession, Section


@pytest_asyncio.fixture
async def test_instrument(db_session: AsyncSession, test_user: User) -> Instrument:
    """A user-owned instrument."""
    instrument = Instrument(user_id=test_user.id, name="Violin")
    db_session.add(instrument)
    await db_session.commit()
    await db_session.refresh(instrument)
    return instrument


@pytest_asyncio.fixture
async def test_template(
    db_session: AsyncSession, test_user: User, test_instrument: Instrument
) -> Template:
    """A practice template with one session and one section."""
    template = Template(
        user_id=test_user.id,
        instrument_id=test_instrument.id,
        name="Test Practice Plan",
    )
    db_session.add(template)
    await db_session.commit()
    await db_session.refresh(template)

    session = TemplateSession(
        template_id=template.id,
        name="Session 1",
        display_order=0,
    )
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)

    section = Section(
        template_session_id=session.id,
        name="Warm-up",
        section_type="warmup",
        estimated_duration_minutes=5,
        display_order=0,
    )
    db_session.add(section)
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
