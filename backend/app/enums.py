"""
Kantelo enums and shared utilities — used across models, schemas, and business logic.
"""
from enum import Enum
from datetime import datetime, timezone


def utcnow() -> datetime:
    """Return current UTC time as a naive datetime.

    Naive (tzinfo=None) because asyncpg requires naive datetimes for
    TIMESTAMP columns, and PostgreSQL TIMESTAMPTZ interprets naive values
    as UTC. Avoids the deprecated datetime.utcnow().
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


class PracticeFrequency(str, Enum):
    daily = "daily"
    few_times_a_week = "few_times_a_week"
    weekly = "weekly"
    occasionally = "occasionally"


class SuggestionsPreference(str, Enum):
    all = "all"
    fewer = "fewer"
    off = "off"


class SectionType(str, Enum):
    warmup = "warmup"
    scales = "scales"
    repertoire = "repertoire"
    sight_reading = "sight_reading"
    ear_training = "ear_training"
    cooldown = "cooldown"
    other = "other"


class WeekStart(str, Enum):
    monday = "monday"
    sunday = "sunday"


class SuggestionTier(str, Enum):
    pre_session = "pre_session"
    in_the_moment = "in_the_moment"
    post_session = "post_session"
    pattern_level = "pattern_level"


class InteractionType(str, Enum):
    shown = "shown"
    dismissed = "dismissed"
    acted_on = "acted_on"


class SessionStatus(str, Enum):
    in_progress = "in_progress"
    completed = "completed"
    abandoned = "abandoned"
