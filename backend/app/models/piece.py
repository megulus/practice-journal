"""
Piece, Spot, and TemplateBlockSpot models — the repertoire system.
"""
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime

import sqlalchemy as sa
from app.enums import utcnow
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.instrument import Instrument
    from app.models.template import Block
    from app.models.practice import BlockLog


class Piece(SQLModel, table=True):
    """A repertoire entry belonging to an instrument."""
    __tablename__ = "pieces"
    __table_args__ = (
        sa.Index("ix_pieces_instrument_deleted", "instrument_id", "deleted_at"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    instrument_id: int = Field(foreign_key="instruments.id", index=True)
    name: str = Field(max_length=300)
    composer_or_source: Optional[str] = Field(default=None, max_length=200)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: Optional[datetime] = Field(
        default=None, sa_column_kwargs={"onupdate": utcnow}
    )
    deleted_at: Optional[datetime] = Field(default=None)

    # Relationships
    instrument: Optional["Instrument"] = Relationship(back_populates="pieces")
    spots: List["Spot"] = Relationship(
        back_populates="piece",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    blocks: List["Block"] = Relationship(back_populates="piece")


class Spot(SQLModel, table=True):
    """A sub-unit of a piece that the user actually practices."""
    __tablename__ = "spots"
    __table_args__ = (
        sa.Index(
            "ix_spots_piece_deleted_retired",
            "piece_id",
            "deleted_at",
            "retired_at",
        ),
        sa.Index("ix_spots_piece_retired", "piece_id", "retired_at"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    piece_id: int = Field(foreign_key="pieces.id", index=True)
    name: str = Field(max_length=200)
    location: Optional[str] = Field(default=None, max_length=300)
    display_order: int = Field(default=0)
    retired_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: Optional[datetime] = Field(
        default=None, sa_column_kwargs={"onupdate": utcnow}
    )
    deleted_at: Optional[datetime] = Field(default=None)

    # Relationships
    piece: Optional[Piece] = Relationship(back_populates="spots")
    template_block_spots: List["TemplateBlockSpot"] = Relationship(
        back_populates="spot"
    )


class TemplateBlockSpot(SQLModel, table=True):
    """Join table: repertoire block -> its default spots."""
    __tablename__ = "template_block_spots"
    __table_args__ = (
        sa.UniqueConstraint("block_id", "spot_id", name="uq_block_spot"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    block_id: int = Field(foreign_key="blocks.id", index=True)
    spot_id: int = Field(foreign_key="spots.id", index=True)
    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=utcnow)

    # Relationships
    block: Optional["Block"] = Relationship(back_populates="template_block_spots")
    spot: Optional[Spot] = Relationship(back_populates="template_block_spots")
