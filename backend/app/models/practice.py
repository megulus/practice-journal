"""
PracticeLog, SectionLog, and BlockLog models.
"""
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime, date

import sqlalchemy as sa
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.instrument import Instrument
    from app.models.template import Template, TemplateSession, Section, Block


class PracticeLog(SQLModel, table=True):
    """A logged practice session."""
    __tablename__ = "practice_logs"
    __table_args__ = (
        sa.Index(
            "ix_practice_logs_user_instrument_date",
            "user_id",
            "instrument_id",
            "practice_date",
        ),
        sa.Index(
            "ix_practice_logs_user_date",
            "user_id",
            "practice_date",
        ),
        sa.Index(
            "ix_practice_logs_user_status",
            "user_id",
            "status",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    instrument_id: int = Field(foreign_key="instruments.id", index=True)
    template_id: Optional[int] = Field(
        default=None, foreign_key="templates.id"
    )
    template_session_id: Optional[int] = Field(
        default=None, foreign_key="template_sessions.id"
    )
    status: str = Field(default="in_progress", max_length=20)
    practice_date: date
    total_duration_minutes: int = Field(default=0)
    notes: Optional[str] = Field(default=None)
    reflection_prompt: Optional[str] = Field(default=None)
    reflection_response: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(
        default=None, sa_column_kwargs={"onupdate": datetime.utcnow}
    )
    deleted_at: Optional[datetime] = Field(default=None)

    # Relationships
    user: Optional["User"] = Relationship(back_populates="practice_logs")
    instrument: Optional["Instrument"] = Relationship(
        back_populates="practice_logs"
    )
    template: Optional["Template"] = Relationship(
        back_populates="practice_logs"
    )
    template_session: Optional["TemplateSession"] = Relationship(
        back_populates="practice_logs"
    )
    section_logs: List["SectionLog"] = Relationship(
        back_populates="practice_log",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class SectionLog(SQLModel, table=True):
    """Logged section within a practice session."""
    __tablename__ = "section_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    practice_log_id: int = Field(
        foreign_key="practice_logs.id", index=True
    )
    section_id: Optional[int] = Field(
        default=None,
        sa_column=sa.Column(
            sa.Integer,
            sa.ForeignKey("sections.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    section_type: str = Field(max_length=30)
    section_name: str = Field(max_length=100)
    planned_duration_minutes: Optional[int] = Field(default=None)
    actual_duration_minutes: int = Field(default=0)
    display_order: int = Field(default=0)
    completed: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    practice_log: Optional[PracticeLog] = Relationship(
        back_populates="section_logs"
    )
    block_logs: List["BlockLog"] = Relationship(
        back_populates="section_log",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class BlockLog(SQLModel, table=True):
    """Logged block within a section — the atomic rated unit."""
    __tablename__ = "block_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    section_log_id: int = Field(
        foreign_key="section_logs.id", index=True
    )
    block_id: Optional[int] = Field(
        default=None,
        sa_column=sa.Column(
            sa.Integer,
            sa.ForeignKey("blocks.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    block_name: str = Field(max_length=200)
    rating: Optional[int] = Field(default=None)
    notes: Optional[str] = Field(default=None)
    completed: bool = Field(default=True)
    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    section_log: Optional[SectionLog] = Relationship(
        back_populates="block_logs"
    )
