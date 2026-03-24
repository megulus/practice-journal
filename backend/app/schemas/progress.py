"""Progress tab schemas — History and Insights."""
from typing import Optional, List
from datetime import date

from pydantic import BaseModel


# --- History ---

class HistoryItem(BaseModel):
    id: int
    practice_date: date
    instrument_name: str
    session_name: Optional[str] = None
    template_name: Optional[str] = None
    rotation_label: Optional[str] = None  # e.g. "session 3 of 7"
    total_duration_minutes: int
    exercise_count: int
    is_freeform: bool


class HistoryResponse(BaseModel):
    items: List[HistoryItem]
    next_cursor: Optional[str] = None


# --- Insights: Heatmap ---

class HeatmapDay(BaseModel):
    date: date
    duration_minutes: int


class HeatmapResponse(BaseModel):
    year: int
    days: List[HeatmapDay]


# --- Insights: Comparison ---

class DailyBreakdown(BaseModel):
    day: str  # e.g. "monday"
    minutes: int


class WeekSummary(BaseModel):
    days_practiced: int
    total_minutes: int
    daily: List[DailyBreakdown]


class ComparisonResponse(BaseModel):
    this_week: WeekSummary
    last_week: WeekSummary
    delta_days: int
    delta_minutes: int


# --- Insights: Ratings ---

class WeekRatings(BaseModel):
    week_start: date
    step_back: int
    steady: int
    step_forward: int
    total: int


class RatingsResponse(BaseModel):
    weeks: List[WeekRatings]
