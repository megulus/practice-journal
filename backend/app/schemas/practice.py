"""Practice session lifecycle schemas."""
from typing import Optional, List
from datetime import datetime, date

from pydantic import BaseModel, ConfigDict


# --- Block Logs ---

class BlockLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    block_id: Optional[int] = None
    block_name: str
    rating: Optional[int] = None
    notes: Optional[str] = None
    completed: bool
    display_order: int


class BlockLogUpdate(BaseModel):
    rating: Optional[int] = None
    notes: Optional[str] = None
    completed: Optional[bool] = None


class BlockLogCreate(BaseModel):
    """For adding a freeform block to a section mid-session."""
    block_name: str


# --- Section Logs ---

class SectionLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    section_id: Optional[int] = None
    section_type: str
    section_name: str
    planned_duration_minutes: Optional[int] = None
    actual_duration_minutes: int
    display_order: int
    completed: bool
    block_logs: List[BlockLogRead] = []


class SectionLogUpdate(BaseModel):
    actual_duration_minutes: Optional[int] = None
    completed: Optional[bool] = None


class SectionLogCreate(BaseModel):
    """For adding a freeform section mid-session."""
    section_name: str
    section_type: str


# --- Practice Logs ---

class PracticeLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    instrument_id: int
    template_id: Optional[int] = None
    template_session_id: Optional[int] = None
    status: str
    practice_date: date
    total_duration_minutes: int
    notes: Optional[str] = None
    reflection_prompt: Optional[str] = None
    reflection_response: Optional[str] = None
    created_at: datetime
    section_logs: List[SectionLogRead] = []


class PracticeStartRequest(BaseModel):
    instrument_id: int
    template_id: Optional[int] = None
    template_session_id: Optional[int] = None


class PracticeLogUpdate(BaseModel):
    notes: Optional[str] = None
    status: Optional[str] = None  # For abandoning: "abandoned"


class ReflectionUpdate(BaseModel):
    reflection_response: str


# --- Finish response ---

class RatingsSummary(BaseModel):
    step_forward: int = 0
    steady: int = 0
    step_back: int = 0
    skipped: int = 0


class SessionSummary(BaseModel):
    total_duration_minutes: int
    exercises_completed: int
    exercises_total: int
    day_streak: int
    ratings: RatingsSummary


class CoachingSuggestion(BaseModel):
    text: str
    rule_id: str


class FinishResponse(BaseModel):
    practice_log: PracticeLogRead
    summary: SessionSummary
    coaching_suggestion: Optional[CoachingSuggestion] = None
    reflection_prompt: Optional[str] = None
