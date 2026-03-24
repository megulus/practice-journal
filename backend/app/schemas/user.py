"""User and Settings schemas."""
from typing import Optional
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.enums import SuggestionsPreference, WeekStart


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


class UserSettingsUpdate(BaseModel):
    suggestions_preference: Optional[SuggestionsPreference] = None
    default_session_duration_minutes: Optional[int] = None
    week_starts_on: Optional[WeekStart] = None
