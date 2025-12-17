from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List

from app.database import get_db
from app.models.practice_log import (
    PracticeLog as PracticeLogModel,
    PracticeLogDetail as PracticeLogDetailModel
)
from app.schemas.log import PracticeLog, PracticeLogCreate

router = APIRouter(prefix="/logs", tags=["logs"])


@router.post("/", response_model=PracticeLog, status_code=201)
def create_practice_log(
    log_data: PracticeLogCreate,
    db: Session = Depends(get_db)
):
    """Create a new practice log entry."""
    # Create the main log entry
    practice_log = PracticeLogModel(
        template_id=log_data.template_id,
        day_number=log_data.day_number,
        practice_date=log_data.practice_date,
        duration_minutes=log_data.duration_minutes,
        notes=log_data.notes
    )
    db.add(practice_log)
    db.flush()
    
    # Create log details
    for detail in log_data.log_details:
        log_detail = PracticeLogDetailModel(
            log_id=practice_log.id,
            section_type=detail.section_type,
            content=detail.content
        )
        db.add(log_detail)
    
    db.commit()
    db.refresh(practice_log)
    return practice_log


@router.get("/", response_model=List[PracticeLog])
def list_practice_logs(
    template_id: int = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get practice logs, optionally filtered by template."""
    query = db.query(PracticeLogModel).order_by(desc(PracticeLogModel.practice_date))
    
    if template_id:
        query = query.filter(PracticeLogModel.template_id == template_id)
    
    return query.limit(limit).all()


@router.get("/{log_id}", response_model=PracticeLog)
def get_practice_log(log_id: int, db: Session = Depends(get_db)):
    """Get a specific practice log."""
    log = db.query(PracticeLogModel).filter(PracticeLogModel.id == log_id).first()
    
    if not log:
        raise HTTPException(status_code=404, detail="Practice log not found")
    
    return log


