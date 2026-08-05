"""User and Settings schemas."""
from typing import Optional, TypeVar
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.enums import SuggestionsPreference, ThemePreference, WeekStart

T = TypeVar("T")


def _reject_explicit_null(value: T) -> T:
    """Reject an explicit `null` on a non-nullable settings column.

    Every field on `UserSettingsUpdate` is `Optional[...] = None` so that
    omitting it means "leave unchanged", but the underlying columns are NOT
    NULL. Validators don't run for fields left at their default, so this only
    fires when the client actually sent `null` — which would otherwise reach
    the DB as a not-null violation (500) instead of a 422.
    """
    if value is None:
        raise ValueError("cannot be null; omit the field to leave it unchanged")
    return value


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
    suggestions_preference: Optional[SuggestionsPreference] = None
    default_session_duration_minutes: Optional[int] = Field(default=None, ge=1)
    week_starts_on: Optional[WeekStart] = None
    theme_preference: Optional[ThemePreference] = None

    _no_null = field_validator(
        "suggestions_preference",
        "default_session_duration_minutes",
        "week_starts_on",
        "theme_preference",
    )(_reject_explicit_null)
