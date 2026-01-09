from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://practice_user:practice_pass@localhost:5432/practice_journal"
    environment: str = "development"
    api_prefix: str = "/api"
    
    # Clerk authentication settings
    clerk_secret_key: str = ""
    clerk_publishable_key: str = ""
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # Allow extra fields in .env file (like frontend-specific vars)


@lru_cache()
def get_settings() -> Settings:
    return Settings()


