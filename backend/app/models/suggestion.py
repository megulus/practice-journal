"""
SuggestionDismissal and SuggestionInteraction models.
"""
from typing import Optional, TYPE_CHECKING
from datetime import datetime

from sqlalchemy import UniqueConstraint
from app.enums import utcnow
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.instrument import Instrument


class SuggestionDismissal(SQLModel, table=True):
    """Tracks which suggestion rules a user has dismissed."""
    __tablename__ = "suggestion_dismissals"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "instrument_id",
            "suggestion_rule_id",
            name="uq_suggestion_dismissals_user_instrument_rule",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id")
    instrument_id: Optional[int] = Field(
        default=None, foreign_key="instruments.id"
    )
    suggestion_rule_id: str = Field(max_length=100)
    suggestion_tier: str = Field(max_length=30)
    dismissed_at: datetime = Field(default_factory=utcnow)

    # Relationships
    user: Optional["User"] = Relationship(
        back_populates="suggestion_dismissals"
    )
    instrument: Optional["Instrument"] = Relationship(
        back_populates="suggestion_dismissals"
    )


class SuggestionInteraction(SQLModel, table=True):
    """Analytics/audit log of all suggestion events."""
    __tablename__ = "suggestion_interactions"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    instrument_id: Optional[int] = Field(
        default=None, foreign_key="instruments.id"
    )
    suggestion_rule_id: str = Field(max_length=100)
    suggestion_tier: str = Field(max_length=30)
    suggestion_text: str
    interaction_type: str = Field(max_length=20)
    created_at: datetime = Field(
        default_factory=utcnow, index=True
    )

    # Relationships
    user: Optional["User"] = Relationship(
        back_populates="suggestion_interactions"
    )
    instrument: Optional["Instrument"] = Relationship(
        back_populates="suggestion_interactions"
    )
