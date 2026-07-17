from pydantic import field_validator
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://practice_user:practice_pass@localhost:5432/practice_journal"
    environment: str = "development"
    api_prefix: str = "/api"
    cors_origins: str = "http://localhost:3000"

    # Clerk authentication settings
    clerk_secret_key: str = ""
    clerk_publishable_key: str = ""
    # JWT verification. Both are optional: when unset they're derived from the
    # publishable key (which encodes the Clerk Frontend API host). Set either to
    # override — e.g. behind a proxy or for a non-standard issuer.
    clerk_jwks_url: str = ""
    clerk_issuer: str = ""

    @field_validator("database_url")
    @classmethod
    def ensure_asyncpg_driver(cls, v: str) -> str:
        """Normalize DATABASE_URL to use the asyncpg driver.

        Cloud platforms (Railway, Render) provide postgresql:// URLs.
        SQLAlchemy needs postgresql+asyncpg:// for the async engine.
        """
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        return v

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # Allow extra fields in .env file (like frontend-specific vars)


@lru_cache()
def get_settings() -> Settings:
    return Settings()


