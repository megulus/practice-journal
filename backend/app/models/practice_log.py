from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class PracticeLog(Base):
    __tablename__ = "practice_logs"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("practice_templates.id"), nullable=False)
    day_number = Column(Integer, nullable=False)
    practice_date = Column(Date, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    template = relationship("PracticeTemplate", back_populates="practice_logs")
    log_details = relationship("PracticeLogDetail", back_populates="log", cascade="all, delete-orphan")


class PracticeLogDetail(Base):
    __tablename__ = "practice_log_details"

    id = Column(Integer, primary_key=True, index=True)
    log_id = Column(Integer, ForeignKey("practice_logs.id"), nullable=False)
    section_type = Column(String(50), nullable=False)  # e.g., "warmup", "scales", "techA", "techB", "repertoire"
    content = Column(Text, nullable=True)

    # Relationships
    log = relationship("PracticeLog", back_populates="log_details")


