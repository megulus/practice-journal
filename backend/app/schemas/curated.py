"""Curated block library schemas."""
from typing import List, Optional
from datetime import date

from pydantic import BaseModel, ConfigDict


class CuratedBlockRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    section_type: str
    default_duration_minutes: int
    usage_count: int
    usage_percentage: int = 0  # Computed by API layer


class RecentBlockRead(BaseModel):
    """A recently-used block from the user's session history.

    block_id may be None for freeform/quick-add blocks; curated_block_id
    points back to the curated library when the block came from there.
    """
    name: str
    block_id: Optional[int] = None
    curated_block_id: Optional[int] = None
    last_used_at: date


class LibrarySpotRead(BaseModel):
    id: int
    name: str
    location: Optional[str] = None


class LibraryPieceRead(BaseModel):
    id: int
    name: str
    composer_or_source: Optional[str] = None
    active_spot_count: int
    last_practiced_at: Optional[date] = None
    spots: List[LibrarySpotRead] = []


class LibraryRepertoireResponse(BaseModel):
    pieces: List[LibraryPieceRead] = []
