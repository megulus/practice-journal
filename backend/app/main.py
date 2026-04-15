from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.config import get_settings
from app.database import engine

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
    title="Kantelo API",
    description="A practice coach for musicians. Practice smarter, not just more.",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS middleware for frontend.
# CORS_ORIGINS env var is a comma-separated list of allowed origins.
# Falls back to localhost for local development.
import os
_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Kantelo API routers
from app.api import user_api, settings_api, instruments_api, templates_api, sessions_sections_blocks_api, practice_api, today_api, progress_api, pieces_api, library_api, suggestions_api

app.include_router(user_api.router, prefix="/api")
app.include_router(settings_api.router, prefix="/api")
app.include_router(instruments_api.router, prefix="/api")
app.include_router(pieces_api.router, prefix="/api")
app.include_router(library_api.router, prefix="/api")
app.include_router(templates_api.router, prefix="/api")
app.include_router(sessions_sections_blocks_api.router, prefix="/api")
app.include_router(practice_api.router, prefix="/api")
app.include_router(suggestions_api.router, prefix="/api")
app.include_router(today_api.router, prefix="/api")
app.include_router(progress_api.router, prefix="/api")


@app.get("/")
def root():
    return {"message": "Kantelo API", "version": "0.2.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}

