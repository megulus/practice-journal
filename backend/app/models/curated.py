"""
CuratedBlock model — global library of common practice blocks.
"""
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime

from sqlalchemy import Index
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.template import Block


class CuratedBlock(SQLModel, table=True):
    """Global library entry for a common practice block."""
    __tablename__ = "curated_blocks"
    __table_args__ = (
        Index(
            "ix_curated_blocks_category_section",
            "instrument_category",
            "section_type",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    instrument_category: str = Field(max_length=100, index=True)
    name: str = Field(max_length=200)
    description: Optional[str] = Field(default=None)
    section_type: str = Field(max_length=30)
    default_duration_minutes: int = Field(default=5)
    usage_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    blocks: List["Block"] = Relationship(back_populates="curated_block")
