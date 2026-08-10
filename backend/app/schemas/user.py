"""User and Settings schemas."""
from typing import Optional, TypeVar
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.enums import SuggestionsPreference, ThemePreference, WeekStart

T = TypeVar("T")


def _reject_explicit_null(value: Optional[T]) -> T:
    """Reject an explicit `null` on a non-nullable settings column.

    Every field on `UserSettingsUpdate` is `Optional[...] = None` so that
    omitting it means "leave unchanged", but the underlying columns are NOT
    NULL. Validators don't run for fields left at their default, so this only
    fires when the client actually sent `null` — which would otherwise reach
    the DB as a not-null violation (500) instead of a 422.

    The alternative — annotating the fields `WeekStart = None` and dropping
    this validator — gets the 422 for free from enum validation and keeps
    `"type": "null"` out of the generated OpenAPI schema. We don't, on
    purpose: it makes the annotation lie (the field is typed non-optional but
    holds `None` until set), it swaps this actionable message for a generic
    "input should be 'monday' or 'sunday'", and the schema still misreports
    `"default": null`. JSON Schema treats "may be absent" and "may be null" as
    separate axes; Python's `Optional[X] = None` conflates them, so some
    inaccuracy is unavoidable here. An over-permissive schema is the cheapest
    of the three.
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
