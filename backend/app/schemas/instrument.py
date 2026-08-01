"""Instrument schemas."""
from typing import Optional
from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.enums import PracticeFrequency


class InstrumentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    practice_frequency: PracticeFrequency = PracticeFrequency.few_times_a_week
    # Optional escape hatch: normally derived from `name`. Lets a client set
    # the canonical category directly (e.g. "violin" for "Stage Strad").
    instrument_category: Optional[str] = Field(default=None, max_length=100)


class InstrumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    # Canonical category for curated-block lookups — see
    # app/services/instrument_category.py.
    instrument_category: str
    practice_frequency: str
    display_order: int
    # Computed fields — populated by the API layer
    active_template_count: int = 0
    last_practiced_at: Optional[date] = None


class InstrumentUpdate(BaseModel):
    name: Optional[str] = None
    practice_frequency: Optional[PracticeFrequency] = None
    display_order: Optional[int] = None
