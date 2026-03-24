"""
Template, TemplateSession, Section, and Block models.
"""
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime

from sqlalchemy import Index
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.instrument import Instrument
    from app.models.practice import PracticeLog
    from app.models.curated import CuratedBlock


class Template(SQLModel, table=True):
    """Practice plan belonging to an instrument."""
    __tablename__ = "templates"
    __table_args__ = (
        Index(
            "ix_templates_one_active_per_instrument",
            "instrument_id",
            unique=True,
            postgresql_where="is_active = true AND deleted_at IS NULL",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    instrument_id: int = Field(foreign_key="instruments.id", index=True)
    name: str = Field(max_length=200)
    description: Optional[str] = Field(default=None)
    is_active: bool = Field(default=True)
    current_rotation_index: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(
        default=None, sa_column_kwargs={"onupdate": datetime.utcnow}
    )
    deleted_at: Optional[datetime] = Field(default=None)

    # Relationships
    user: Optional["User"] = Relationship(back_populates="templates")
    instrument: Optional["Instrument"] = Relationship(back_populates="templates")
    sessions: List["TemplateSession"] = Relationship(
        back_populates="template",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    practice_logs: List["PracticeLog"] = Relationship(back_populates="template")


class TemplateSession(SQLModel, table=True):
    """Named rotation unit within a template."""
    __tablename__ = "template_sessions"
    __table_args__ = (
        # Each session has a unique position within its template
        Index(
            "uq_template_sessions_template_order",
            "template_id",
            "display_order",
            unique=True,
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    template_id: int = Field(foreign_key="templates.id", index=True)
    name: str = Field(max_length=200)
    focus_description: Optional[str] = Field(default=None)
    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(
        default=None, sa_column_kwargs={"onupdate": datetime.utcnow}
    )

    # Relationships
    template: Optional[Template] = Relationship(back_populates="sessions")
    sections: List["Section"] = Relationship(
        back_populates="template_session",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    practice_logs: List["PracticeLog"] = Relationship(
        back_populates="template_session"
    )


class Section(SQLModel, table=True):
    """Group of blocks within a template session (warm-up, scales, etc.)."""
    __tablename__ = "sections"

    id: Optional[int] = Field(default=None, primary_key=True)
    template_session_id: int = Field(
        foreign_key="template_sessions.id", index=True
    )
    name: str = Field(max_length=100)
    section_type: str = Field(max_length=30)
    estimated_duration_minutes: int = Field(default=5)
    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(
        default=None, sa_column_kwargs={"onupdate": datetime.utcnow}
    )

    # Relationships
    template_session: Optional[TemplateSession] = Relationship(
        back_populates="sections"
    )
    blocks: List["Block"] = Relationship(
        back_populates="section",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class Block(SQLModel, table=True):
    """Individual exercise within a section — the atomic rated unit."""
    __tablename__ = "blocks"

    id: Optional[int] = Field(default=None, primary_key=True)
    section_id: int = Field(foreign_key="sections.id", index=True)
    curated_block_id: Optional[int] = Field(
        default=None, foreign_key="curated_blocks.id"
    )
    name: str = Field(max_length=200)
    description: Optional[str] = Field(default=None)
    estimated_duration_minutes: Optional[int] = Field(default=None)
    tempo_bpm: Optional[int] = Field(default=None)
    key: Optional[str] = Field(default=None, max_length=50)
    difficulty_level: Optional[int] = Field(default=None)
    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(
        default=None, sa_column_kwargs={"onupdate": datetime.utcnow}
    )

    # Relationships
    section: Optional[Section] = Relationship(back_populates="blocks")
    curated_block: Optional["CuratedBlock"] = Relationship(
        back_populates="blocks"
    )
