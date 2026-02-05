from typing import AsyncGenerator
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.config import get_settings

settings = get_settings()

# Create async engine with connection pooling
engine = create_async_engine(
    settings.database_url,
    echo=True if settings.environment == "development" else False,
    future=True,
    pool_size=10,          # Keep 10 connections in the pool
    max_overflow=20,       # Allow up to 20 additional connections
    pool_pre_ping=True,    # Verify connections before using them
    pool_recycle=300,      # Recycle connections after 5 minutes
)

# Create async session factory
async_session = async_sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get async database session."""
    async with async_session() as session:
        yield session
