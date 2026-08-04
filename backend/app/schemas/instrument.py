"""Instrument schemas."""
from typing import Optional
from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.enums import PracticeFrequency


def _require_non_blank_name(value: Optional[str]) -> Optional[str]:
    """Reject whitespace-only names — `min_length=1` lets "   " through, and a
    blank name derives a blank instrument_category."""
    if value is not None and not value.strip():
        raise ValueError("name cannot be blank")
    return value


def _normalize_category(value: Optional[str]) -> Optional[str]:
    """Lowercase an explicit category; blank means "derive it from the name"."""
    if value is None:
        return None
    normalized = value.strip().lower()
    return normalized or None


class InstrumentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    practice_frequency: PracticeFrequency = PracticeFrequency.few_times_a_week
    # Optional escape hatch: normally derived from `name`. Lets a client set
    # the canonical category directly (e.g. "violin" for "Stage Strad").
    instrument_category: Optional[str] = Field(default=None, max_length=100)

    _check_name = field_validator("name")(_require_non_blank_name)
    _clean_category = field_validator("instrument_category")(_normalize_category)


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
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    practice_frequency: Optional[PracticeFrequency] = None
    display_order: Optional[int] = None
    # Explicit override; omit it and the category follows the name (see
    # update_instrument for the rename rules).
    instrument_category: Optional[str] = Field(default=None, max_length=100)

    _check_name = field_validator("name")(_require_non_blank_name)
    _clean_category = field_validator("instrument_category")(_normalize_category)
