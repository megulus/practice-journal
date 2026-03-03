from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.config import get_settings
from app.database import engine
from app.api import instruments, templates, logs, analytics, user, block_types, suggestions, user_instruments
from app.api import settings as settings_api

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm up the connection pool on startup."""
    import time
    import asyncio
    t0 = time.time()

    # Pre-create multiple connections in the pool
    async def warm_connection():
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))

    # Warm up 5 connections in parallel
    await asyncio.gather(*[warm_connection() for _ in range(5)])

    t1 = time.time()
    print(f"[STARTUP] Connection pool warmed up (5 connections) in {(t1-t0)*1000:.1f}ms")
    yield
    # Cleanup on shutdown
    await engine.dispose()


app = FastAPI(
    title="Practice Journal API",
    description="API for tracking music practice sessions across multiple instruments",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(instruments.router, prefix="/api")
app.include_router(templates.router, prefix="/api")
app.include_router(logs.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(user.router, prefix="/api")
app.include_router(block_types.router, prefix="/api")
app.include_router(suggestions.router, prefix="/api")
app.include_router(user_instruments.router, prefix="/api")
app.include_router(settings_api.router, prefix="/api")


@app.get("/")
def root():
    return {"message": "Practice Journal API", "version": "0.1.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}

