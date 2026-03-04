from enum import Enum
from typing import Optional

from pydantic import BaseModel


class SessionSuggestionType(str, Enum):
    CONSISTENCY = "consistency"
    BALANCE = "balance"
    DURATION = "duration"
    COVERAGE = "coverage"
    WARMUP = "warmup"


class SessionSuggestion(BaseModel):
    key: str  # "session_{rule_id}_{instrument_id}"
    type: SessionSuggestionType
    message: str
    priority: int  # lower = higher priority
    instrument_id: Optional[int] = None


class PracticeStats(BaseModel):
    user_id: int
    instrument_id: Optional[int] = None
    days_since_last_practice: Optional[int] = None
    total_sessions_last_30_days: int = 0
    days_practiced_last_7_days: int = 0
    section_type_distribution: dict[str, float] = {}  # slug -> % of time
    average_duration_last_10: Optional[float] = None
    average_duration_overall: Optional[float] = None
    all_known_section_types: list[str] = []
    section_types_last_14_days: list[str] = []
    recent_sessions_with_warmup: int = 0
    recent_sessions_total: int = 0
