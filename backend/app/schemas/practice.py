"""Practice session lifecycle schemas."""
from typing import Optional, List
from datetime import datetime, date

from pydantic import BaseModel, ConfigDict, Field

from app.enums import SectionType, SessionStatus


# --- Block Logs ---

class BlockLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    block_id: Optional[int] = None
    spot_id: Optional[int] = None
    block_name: str
    rating: Optional[int] = None
    notes: Optional[str] = None
    completed: bool
    display_order: int
    last_tempo_bpm: Optional[int] = None


class BlockLogUpdate(BaseModel):
    rating: Optional[int] = Field(default=None, ge=-1, le=1)
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
    actual_duration_minutes: Optional[int] = Field(default=None, ge=0)
    completed: Optional[bool] = None
    mark_all_done: Optional[bool] = None


class SectionLogCreate(BaseModel):
    """For adding a freeform section mid-session."""
    section_name: str
    section_type: SectionType


# --- Practice Logs ---

class PracticeLogRead(BaseModel):
    """Read schema for practice logs.

    `instrument_name`, `template_name`, and `session_name` are denormalized
    for display and must be populated by the route handler — they do not
    exist on the ORM model.
    """
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
    # Denormalized names — populated by route handler from relationships
    instrument_name: str = ""
    template_name: Optional[str] = None
    session_name: Optional[str] = None
    section_logs: List[SectionLogRead] = []


class PracticeStartRequest(BaseModel):
    instrument_id: int
    template_id: Optional[int] = None
    template_session_id: Optional[int] = None


class PracticeLogUpdate(BaseModel):
    notes: Optional[str] = None
    status: Optional[str] = Field(
        default=None,
        pattern=f"^{SessionStatus.abandoned.value}$",
        description="Only 'abandoned' is allowed via PATCH. Use the finish endpoint for 'completed'.",
    )


class ReflectionUpdate(BaseModel):
    reflection_response: str


class AddSpotRequest(BaseModel):
    """Add a new spot to a repertoire block mid-session."""
    name: str = Field(min_length=1, max_length=200)
    location: Optional[str] = Field(default=None, max_length=300)
    add_to_rotation: bool = True


class CollapseToPieceRequest(BaseModel):
    """Collapse per-spot logs to a single piece-level log."""
    rating: Optional[int] = Field(default=None, ge=-1, le=1)
    notes: Optional[str] = None


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
