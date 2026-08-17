"""User and Settings schemas."""
from typing import Optional
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.enums import SuggestionsPreference, ThemePreference, WeekStart
from app.schemas.common import reject_explicit_null


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    created_at: datetime


class UserSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    suggestions_preference: str
    default_session_duration_minutes: int
    week_starts_on: str
    theme_preference: str


class UserSettingsUpdate(BaseModel):
    # These stay `Optional[...]` even though it publishes a schema saying null
    # is acceptable when it isn't. Annotating them non-optional instead
    # (`week_starts_on: WeekStart = None`) would publish an accurate schema and
    # reject null with no validator at all — but the annotation would then lie,
    # since the field holds `None` until set, and the 422 degrades to "Input
    # should be a valid string" (the enums are `str, Enum`, so null fails
    # string coercion before membership is checked) instead of naming the
    # actual remedy. An over-permissive schema is the cheaper inaccuracy.
    suggestions_preference: Optional[SuggestionsPreference] = None
    default_session_duration_minutes: Optional[int] = Field(default=None, ge=1)
    week_starts_on: Optional[WeekStart] = None
    theme_preference: Optional[ThemePreference] = None

    _no_null = field_validator(
        "suggestions_preference",
        "default_session_duration_minutes",
        "week_starts_on",
        "theme_preference",
    )(reject_explicit_null)
