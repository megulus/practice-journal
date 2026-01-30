"""
SQLModel models for Practice Journal
These models serve as both database tables AND API schemas
"""
from enum import Enum
from typing import Optional, List
from datetime import datetime, date
from sqlmodel import Field, SQLModel, Relationship


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TechniqueCategory(str, Enum):
    """Categories for exercise techniques"""
    SCALES = "scales"
    ARPEGGIOS = "arpeggios"
    ETUDE = "etude"
    LONG_TONES = "long_tones"
    SHIFTING = "shifting"
    BOWING = "bowing"
    ARTICULATION = "articulation"
    REPERTOIRE = "repertoire"
    SIGHT_READING = "sight_reading"
    OTHER = "other"


class PracticeOutcome(str, Enum):
    """How well a practice session went for an exercise"""
    STRUGGLED = "struggled"
    OKAY = "okay"
    NAILED_IT = "nailed_it"


class User(SQLModel, table=True):
    """User account (authenticated via Clerk)"""
    __tablename__ = "users"  # type: ignore[assignment]

    id: Optional[int] = Field(default=None, primary_key=True)
    clerk_user_id: str = Field(unique=True, index=True, max_length=255)
    email: str = Field(max_length=255)
    first_name: Optional[str] = Field(default=None, max_length=255)
    last_name: Optional[str] = Field(default=None, max_length=255)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None, sa_column_kwargs={"onupdate": datetime.utcnow})
    deleted_at: Optional[datetime] = Field(default=None)

    # Relationships
    instruments: List["Instrument"] = Relationship(back_populates="user")
    practice_templates: List["PracticeTemplate"] = Relationship(back_populates="user")


class Instrument(SQLModel, table=True):
    """Musical instrument"""
    __tablename__ = "instruments"  # type: ignore[assignment]
    
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, index=True)
    description: Optional[str] = None
    is_system: bool = Field(default=False)  # True for system-provided instruments
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")  # Nullable for backward compatibility
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    user: Optional["User"] = Relationship(back_populates="instruments")
    practice_templates: List["PracticeTemplate"] = Relationship(back_populates="instrument")


class PracticeTemplate(SQLModel, table=True):
    """Practice rotation template"""
    __tablename__ = "practice_templates"  # type: ignore[assignment]
    
    id: Optional[int] = Field(default=None, primary_key=True)
    instrument_id: int = Field(foreign_key="instruments.id")
    name: str = Field(max_length=200)
    days_count: int
    description: Optional[str] = None
    is_active: bool = True
    is_system: bool = Field(default=False)  # True for system-provided templates
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")  # Nullable for backward compatibility
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None, sa_column_kwargs={"onupdate": datetime.utcnow})
    deleted_at: Optional[datetime] = Field(default=None)
    
    # Relationships
    user: Optional["User"] = Relationship(back_populates="practice_templates")
    instrument: Optional[Instrument] = Relationship(back_populates="practice_templates")
    practice_days: List["PracticeDay"] = Relationship(back_populates="template", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    practice_logs: List["PracticeLog"] = Relationship(back_populates="template")


class BlockType(SQLModel, table=True):
    """Catalog of practice block categories (warm-up, scales, technique, etc.)"""
    __tablename__ = "block_types"  # type: ignore[assignment]

    id: Optional[int] = Field(default=None, primary_key=True)
    slug: str = Field(max_length=50, unique=True, index=True)
    label: str = Field(max_length=100)
    description: Optional[str] = None
    default_duration_minutes: int = Field(default=10)
    icon_key: Optional[str] = Field(default=None, max_length=50)
    display_order: int = Field(default=0)
    is_system: bool = Field(default=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    exercise_blocks: List["ExerciseBlock"] = Relationship(back_populates="block_type_rel")


class PracticeDay(SQLModel, table=True):
    """Individual day in a practice template"""
    __tablename__ = "practice_days"  # type: ignore[assignment]
    
    id: Optional[int] = Field(default=None, primary_key=True)
    template_id: int = Field(foreign_key="practice_templates.id")
    day_number: int
    title: str = Field(max_length=200)
    warmup: Optional[str] = None
    scales: Optional[str] = None
    repertoire: Optional[str] = None
    updated_at: Optional[datetime] = Field(default=None, sa_column_kwargs={"onupdate": datetime.utcnow})
    
    # Relationships
    template: Optional[PracticeTemplate] = Relationship(back_populates="practice_days")
    exercise_blocks: List["ExerciseBlock"] = Relationship(back_populates="practice_day", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class ExerciseBlock(SQLModel, table=True):
    """Block of exercises (e.g., Block A, Block B)"""
    __tablename__ = "exercise_blocks"  # type: ignore[assignment]
    
    id: Optional[int] = Field(default=None, primary_key=True)
    practice_day_id: int = Field(foreign_key="practice_days.id")
    block_type: str = Field(max_length=50)  # e.g., "blockA", "blockB" — kept for backward compat
    block_type_id: Optional[int] = Field(default=None, foreign_key="block_types.id")
    duration_minutes: Optional[int] = Field(default=None)
    display_order: int
    updated_at: Optional[datetime] = Field(default=None, sa_column_kwargs={"onupdate": datetime.utcnow})

    # Relationships
    practice_day: Optional[PracticeDay] = Relationship(back_populates="exercise_blocks")
    block_type_rel: Optional["BlockType"] = Relationship(back_populates="exercise_blocks")
    exercises: List["Exercise"] = Relationship(back_populates="block", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class Exercise(SQLModel, table=True):
    """Individual exercise within a block"""
    __tablename__ = "exercises"  # type: ignore[assignment]

    id: Optional[int] = Field(default=None, primary_key=True)
    block_id: int = Field(foreign_key="exercise_blocks.id")
    exercise_text: str
    display_order: int
    updated_at: Optional[datetime] = Field(default=None, sa_column_kwargs={"onupdate": datetime.utcnow})

    # Structured metadata fields (all optional)
    tempo_bpm: Optional[int] = Field(default=None)
    key: Optional[str] = Field(default=None, max_length=50)
    technique_category: Optional[str] = Field(default=None, max_length=50)  # Stores TechniqueCategory value
    difficulty_level: Optional[int] = Field(default=None)
    notes: Optional[str] = Field(default=None)

    # Relationships
    block: Optional[ExerciseBlock] = Relationship(back_populates="exercises")


class ExerciseProgress(SQLModel, table=True):
    """Tracks user progress on a specific exercise over time"""
    __tablename__ = "exercise_progress"  # type: ignore[assignment]

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    exercise_id: int = Field(foreign_key="exercises.id", index=True)

    # Aggregated stats
    times_practiced: int = Field(default=0)
    last_practiced_at: Optional[datetime] = Field(default=None)
    current_tempo: Optional[int] = Field(default=None)
    current_difficulty: Optional[int] = Field(default=None)

    # Outcome tracking
    struggled_count: int = Field(default=0)
    okay_count: int = Field(default=0)
    nailed_it_count: int = Field(default=0)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None, sa_column_kwargs={"onupdate": datetime.utcnow})

    # Relationships
    user: Optional["User"] = Relationship()
    exercise: Optional[Exercise] = Relationship()


class PracticeLog(SQLModel, table=True):
    """Log entry for a practice session"""
    __tablename__ = "practice_logs"  # type: ignore[assignment]
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    template_id: Optional[int] = Field(default=None, foreign_key="practice_templates.id")
    day_number: Optional[int] = Field(default=None)
    practice_date: date
    duration_minutes: int
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None, sa_column_kwargs={"onupdate": datetime.utcnow})
    deleted_at: Optional[datetime] = Field(default=None)

    # Relationships
    user: Optional["User"] = Relationship()
    template: Optional[PracticeTemplate] = Relationship(back_populates="practice_logs")
    log_details: List["PracticeLogDetail"] = Relationship(back_populates="log", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class PracticeLogDetail(SQLModel, table=True):
    """Detailed notes for sections of a practice log"""
    __tablename__ = "practice_log_details"  # type: ignore[assignment]

    id: Optional[int] = Field(default=None, primary_key=True)
    log_id: int = Field(foreign_key="practice_logs.id")
    section_type: str = Field(max_length=50)  # e.g., "warmup", "scales", "techA"
    content: Optional[str] = None
    updated_at: Optional[datetime] = Field(default=None, sa_column_kwargs={"onupdate": datetime.utcnow})

    # Enhanced fields for progress tracking
    exercise_id: Optional[int] = Field(default=None, foreign_key="exercises.id")
    tempo_practiced: Optional[int] = Field(default=None)
    outcome: Optional[str] = Field(default=None, max_length=20)  # Stores PracticeOutcome value
    notes: Optional[str] = Field(default=None)

    # Relationships
    log: Optional[PracticeLog] = Relationship(back_populates="log_details")
    exercise: Optional[Exercise] = Relationship()


# API-specific models (for requests/responses that differ from DB models)

class PracticeLogDetailCreate(SQLModel):
    """Schema for creating log details"""
    section_type: str
    content: Optional[str] = None
    exercise_id: Optional[int] = None
    tempo_practiced: Optional[int] = None
    outcome: Optional[str] = None  # One of PracticeOutcome values
    notes: Optional[str] = None


class PracticeLogCreate(SQLModel):
    """Schema for creating a practice log"""
    template_id: Optional[int] = None
    day_number: Optional[int] = None
    practice_date: date
    duration_minutes: int
    notes: Optional[str] = None
    log_details: List[PracticeLogDetailCreate] = []


class TemplateCreate(SQLModel):
    """Schema for creating a practice template"""
    instrument_id: int
    name: str
    days_count: int
    description: Optional[str] = None


class TemplateUpdate(SQLModel):
    """Schema for updating a practice template"""
    name: Optional[str] = None
    description: Optional[str] = None
    days_count: Optional[int] = None


class DayUpdate(SQLModel):
    """Schema for updating a practice day"""
    title: Optional[str] = None


class BlockCreate(SQLModel):
    """Schema for creating an exercise block"""
    block_type_id: int
    duration_minutes: Optional[int] = None
    display_order: Optional[int] = None


class BlockUpdate(SQLModel):
    """Schema for updating an exercise block"""
    block_type_id: Optional[int] = None
    duration_minutes: Optional[int] = None
    display_order: Optional[int] = None


class BlockReorder(SQLModel):
    """Schema for reordering blocks on a day"""
    block_ids: List[int]


class ExerciseCreate(SQLModel):
    """Schema for creating an exercise"""
    exercise_text: str
    display_order: Optional[int] = None
    tempo_bpm: Optional[int] = None
    key: Optional[str] = None
    technique_category: Optional[str] = None  # One of TechniqueCategory values
    difficulty_level: Optional[int] = None
    notes: Optional[str] = None


class ExerciseUpdate(SQLModel):
    """Schema for updating an exercise"""
    exercise_text: Optional[str] = None
    display_order: Optional[int] = None
    tempo_bpm: Optional[int] = None
    key: Optional[str] = None
    technique_category: Optional[str] = None  # One of TechniqueCategory values
    difficulty_level: Optional[int] = None
    notes: Optional[str] = None


class AnalyticsSummary(SQLModel):
    """Analytics summary response"""
    total_sessions: int
    total_minutes: int
    average_duration: float
    sessions_by_day: dict = {}

