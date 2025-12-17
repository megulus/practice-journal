from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.api import instruments, templates, logs, analytics

settings = get_settings()

app = FastAPI(
    title="Practice Journal API",
    description="API for tracking music practice sessions across multiple instruments",
    version="0.1.0",
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


@app.get("/")
def root():
    return {"message": "Practice Journal API", "version": "0.1.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}

