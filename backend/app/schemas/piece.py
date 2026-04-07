"""Piece and Spot schemas."""
from typing import Optional, List
from datetime import datetime, date

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Spots
# ---------------------------------------------------------------------------

class SpotCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    location: Optional[str] = Field(default=None, max_length=300)


class SpotUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    location: Optional[str] = None
    display_order: Optional[int] = None


class SpotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    location: Optional[str]
    display_order: int
    retired_at: Optional[datetime]
    # Computed fields — populated by the API layer
    session_count: int = 0
    last_practiced_at: Optional[date] = None


class SpotHistoryEntry(BaseModel):
    block_log_id: int
    practice_date: date
    rating: Optional[int]
    notes: Optional[str]
    session_id: int


class SpotHistoryRead(BaseModel):
    spot: SpotRead
    logs: List[SpotHistoryEntry]
    rating_trend: dict  # {step_back, steady, step_forward, skipped}


class SpotReorder(BaseModel):
    spot_ids: List[int]


# ---------------------------------------------------------------------------
# Pieces
# ---------------------------------------------------------------------------

class PieceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    composer_or_source: Optional[str] = Field(default=None, max_length=200)


class PieceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=300)
    composer_or_source: Optional[str] = None


class PieceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    instrument_id: int
    name: str
    composer_or_source: Optional[str]
    # Computed fields — populated by the API layer
    session_count: int = 0
    last_practiced_at: Optional[date] = None


class PieceDetailRead(PieceRead):
    """Full piece with spots."""
    spots: List[SpotRead] = []
