"""
SQLModel models for Practice Journal
These models serve as both database tables AND API schemas
"""
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime, date
from sqlmodel import Field, SQLModel, Relationship


class Instrument(SQLModel, table=True):
    """Musical instrument"""
    __tablename__ = "instruments"  # type: ignore[assignment]
    
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, unique=True, index=True)
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
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
    
    # Relationships
    instrument: Optional[Instrument] = Relationship(back_populates="practice_templates")
    practice_days: List["PracticeDay"] = Relationship(back_populates="template", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    practice_logs: List["PracticeLog"] = Relationship(back_populates="template")


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
    
    # Relationships
    template: Optional[PracticeTemplate] = Relationship(back_populates="practice_days")
    exercise_blocks: List["ExerciseBlock"] = Relationship(back_populates="practice_day", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class ExerciseBlock(SQLModel, table=True):
    """Block of exercises (e.g., Block A, Block B)"""
    __tablename__ = "exercise_blocks"  # type: ignore[assignment]
    
    id: Optional[int] = Field(default=None, primary_key=True)
    practice_day_id: int = Field(foreign_key="practice_days.id")
    block_type: str = Field(max_length=50)  # e.g., "blockA", "blockB"
    display_order: int
    
    # Relationships
    practice_day: Optional[PracticeDay] = Relationship(back_populates="exercise_blocks")
    exercises: List["Exercise"] = Relationship(back_populates="block", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class Exercise(SQLModel, table=True):
    """Individual exercise within a block"""
    __tablename__ = "exercises"  # type: ignore[assignment]
    
    id: Optional[int] = Field(default=None, primary_key=True)
    block_id: int = Field(foreign_key="exercise_blocks.id")
    exercise_text: str
    display_order: int
    
    # Relationships
    block: Optional[ExerciseBlock] = Relationship(back_populates="exercises")


class PracticeLog(SQLModel, table=True):
    """Log entry for a practice session"""
    __tablename__ = "practice_logs"  # type: ignore[assignment]
    
    id: Optional[int] = Field(default=None, primary_key=True)
    template_id: int = Field(foreign_key="practice_templates.id")
    day_number: int
    practice_date: date
    duration_minutes: int
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    template: Optional[PracticeTemplate] = Relationship(back_populates="practice_logs")
    log_details: List["PracticeLogDetail"] = Relationship(back_populates="log", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class PracticeLogDetail(SQLModel, table=True):
    """Detailed notes for sections of a practice log"""
    __tablename__ = "practice_log_details"  # type: ignore[assignment]
    
    id: Optional[int] = Field(default=None, primary_key=True)
    log_id: int = Field(foreign_key="practice_logs.id")
    section_type: str = Field(max_length=50)  # e.g., "warmup", "scales", "techA"
    content: Optional[str] = None
    
    # Relationships
    log: Optional[PracticeLog] = Relationship(back_populates="log_details")


# API-specific models (for requests/responses that differ from DB models)

class PracticeLogDetailCreate(SQLModel):
    """Schema for creating log details"""
    section_type: str
    content: Optional[str] = None


class PracticeLogCreate(SQLModel):
    """Schema for creating a practice log"""
    template_id: int
    day_number: int
    practice_date: date
    duration_minutes: int
    notes: Optional[str] = None
    log_details: List[PracticeLogDetailCreate] = []


class AnalyticsSummary(SQLModel):
    """Analytics summary response"""
    total_sessions: int
    total_minutes: int
    average_duration: float
    sessions_by_day: dict = {}

