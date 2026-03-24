"""Curated block library schemas."""
from typing import Optional

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
