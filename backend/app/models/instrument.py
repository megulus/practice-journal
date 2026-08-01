"""
Instrument model — user-owned instruments with practice frequency.
"""
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime

from app.enums import utcnow
from app.services.instrument_category import derive_instrument_category
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.template import Template
    from app.models.practice import PracticeLog
    from app.models.piece import Piece
    from app.models.suggestion import SuggestionDismissal, SuggestionInteraction


class Instrument(SQLModel, table=True):
    """Musical instrument belonging to a user."""
    __tablename__ = "instruments"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    name: str = Field(max_length=100)
    # Canonical category the curated block library is keyed by ("violin").
    # Derived from `name` on creation (see __init__) because users rename
    # instruments freely; renaming must not break curated-block search.
    instrument_category: str = Field(default="", max_length=100, index=True)
    practice_frequency: str = Field(
        default="few_times_a_week", max_length=30
    )
    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: Optional[datetime] = Field(
        default=None, sa_column_kwargs={"onupdate": utcnow}
    )
    deleted_at: Optional[datetime] = Field(default=None)

    # Relationships
    user: Optional["User"] = Relationship(back_populates="instruments")
    templates: List["Template"] = Relationship(back_populates="instrument")
    pieces: List["Piece"] = Relationship(back_populates="instrument")
    practice_logs: List["PracticeLog"] = Relationship(back_populates="instrument")
    suggestion_dismissals: List["SuggestionDismissal"] = Relationship(
        back_populates="instrument"
    )
    suggestion_interactions: List["SuggestionInteraction"] = Relationship(
        back_populates="instrument"
    )

    def __init__(self, **data):
        """Derive `instrument_category` from `name` unless one was passed.

        Done here rather than in the API layer so every creation path (API,
        scripts, tests) gets a category and the column stays non-null.
        """
        if not data.get("instrument_category") and data.get("name"):
            data["instrument_category"] = derive_instrument_category(data["name"])
        super().__init__(**data)
