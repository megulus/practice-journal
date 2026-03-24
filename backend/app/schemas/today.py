"""Today tab schemas."""
from typing import Optional, List
from datetime import datetime, date

from pydantic import BaseModel


class ActiveSessionInfo(BaseModel):
    practice_log_id: int
    instrument_id: int
    instrument_name: str
    session_name: Optional[str] = None
    started_at: datetime


class InstrumentBrief(BaseModel):
    id: int
    name: str
    practice_frequency: str


class CurrentSessionInfo(BaseModel):
    template_id: int
    template_name: str
    session_id: int
    session_name: str
    focus_description: Optional[str] = None
    rotation_position: str  # e.g. "session 3 of 7"
    estimated_duration_minutes: int
    section_types: List[str]


class InstrumentDue(BaseModel):
    instrument: InstrumentBrief
    last_practiced_at: Optional[date] = None
    days_since_last: Optional[int] = None
    current_session: Optional[CurrentSessionInfo] = None


class InstrumentNotDue(BaseModel):
    instrument: InstrumentBrief
    last_practiced_at: Optional[date] = None
    days_since_last: Optional[int] = None
    next_due_description: Optional[str] = None


class TodayResponse(BaseModel):
    active_session: Optional[ActiveSessionInfo] = None
    instruments_due: List[InstrumentDue] = []
    instruments_not_due: List[InstrumentNotDue] = []
