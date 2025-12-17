from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional, List


class PracticeLogDetailBase(BaseModel):
    section_type: str
    content: Optional[str] = None


class PracticeLogDetailCreate(PracticeLogDetailBase):
    pass


class PracticeLogDetail(PracticeLogDetailBase):
    id: int
    log_id: int

    class Config:
        from_attributes = True


class PracticeLogBase(BaseModel):
    template_id: int
    day_number: int
    practice_date: date
    duration_minutes: int
    notes: Optional[str] = None


class PracticeLogCreate(PracticeLogBase):
    log_details: List[PracticeLogDetailCreate] = []


class PracticeLog(PracticeLogBase):
    id: int
    created_at: datetime
    log_details: List[PracticeLogDetail] = []

    class Config:
        from_attributes = True


class AnalyticsSummary(BaseModel):
    total_sessions: int
    total_minutes: int
    average_duration: float
    sessions_by_day: dict = {}


