"""
User and UserSettings models.
"""
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime

from sqlmodel import Field, SQLModel, Relationship

from app.enums import utcnow

if TYPE_CHECKING:
    from app.models.instrument import Instrument
    from app.models.template import Template
    from app.models.practice import PracticeLog
    from app.models.suggestion import SuggestionDismissal, SuggestionInteraction


class User(SQLModel, table=True):
    """User account (authenticated via Clerk)."""
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    clerk_user_id: str = Field(unique=True, index=True, max_length=255)
    email: str = Field(max_length=255)
    first_name: Optional[str] = Field(default=None, max_length=255)
    last_name: Optional[str] = Field(default=None, max_length=255)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: Optional[datetime] = Field(
        default=None, sa_column_kwargs={"onupdate": utcnow}
    )
    deleted_at: Optional[datetime] = Field(default=None)

    # Relationships
    settings: Optional["UserSettings"] = Relationship(back_populates="user")
    instruments: List["Instrument"] = Relationship(back_populates="user")
    templates: List["Template"] = Relationship(back_populates="user")
    practice_logs: List["PracticeLog"] = Relationship(back_populates="user")
    suggestion_dismissals: List["SuggestionDismissal"] = Relationship(
        back_populates="user"
    )
    suggestion_interactions: List["SuggestionInteraction"] = Relationship(
        back_populates="user"
    )


class UserSettings(SQLModel, table=True):
    """Per-user settings (auto-created on first access)."""
    __tablename__ = "user_settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", unique=True, index=True)
    suggestions_preference: str = Field(default="all", max_length=20)
    default_session_duration_minutes: int = Field(default=30)
    week_starts_on: str = Field(default="monday", max_length=10)
    theme_preference: str = Field(default="system", max_length=10)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: Optional[datetime] = Field(
        default=None, sa_column_kwargs={"onupdate": utcnow}
    )

    # Relationships
    user: Optional[User] = Relationship(back_populates="settings")
