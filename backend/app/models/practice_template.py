from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class PracticeTemplate(Base):
    __tablename__ = "practice_templates"

    id = Column(Integer, primary_key=True, index=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False)
    name = Column(String(200), nullable=False)
    days_count = Column(Integer, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    # Relationships
    instrument = relationship("Instrument", back_populates="practice_templates")
    practice_days = relationship("PracticeDay", back_populates="template", cascade="all, delete-orphan")
    practice_logs = relationship("PracticeLog", back_populates="template")


class PracticeDay(Base):
    __tablename__ = "practice_days"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("practice_templates.id"), nullable=False)
    day_number = Column(Integer, nullable=False)
    title = Column(String(200), nullable=False)
    warmup = Column(Text, nullable=True)
    scales = Column(Text, nullable=True)
    repertoire = Column(Text, nullable=True)

    # Relationships
    template = relationship("PracticeTemplate", back_populates="practice_days")
    exercise_blocks = relationship("ExerciseBlock", back_populates="practice_day", cascade="all, delete-orphan")


class ExerciseBlock(Base):
    __tablename__ = "exercise_blocks"

    id = Column(Integer, primary_key=True, index=True)
    practice_day_id = Column(Integer, ForeignKey("practice_days.id"), nullable=False)
    block_type = Column(String(50), nullable=False)  # e.g., "blockA", "blockB"
    display_order = Column(Integer, nullable=False)

    # Relationships
    practice_day = relationship("PracticeDay", back_populates="exercise_blocks")
    exercises = relationship("Exercise", back_populates="block", cascade="all, delete-orphan")


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    block_id = Column(Integer, ForeignKey("exercise_blocks.id"), nullable=False)
    exercise_text = Column(Text, nullable=False)
    display_order = Column(Integer, nullable=False)

    # Relationships
    block = relationship("ExerciseBlock", back_populates="exercises")


