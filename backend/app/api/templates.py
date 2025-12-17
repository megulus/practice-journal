from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.practice_template import (
    PracticeTemplate as PracticeTemplateModel,
    PracticeDay as PracticeDayModel
)
from app.schemas.practice import (
    PracticeTemplate,
    PracticeTemplateWithDays,
    PracticeDay
)

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/", response_model=List[PracticeTemplate])
def list_templates(
    instrument_id: int = None,
    db: Session = Depends(get_db)
):
    """Get all practice templates, optionally filtered by instrument."""
    query = db.query(PracticeTemplateModel)
    if instrument_id:
        query = query.filter(PracticeTemplateModel.instrument_id == instrument_id)
    return query.filter(PracticeTemplateModel.is_active == True).all()


@router.get("/{template_id}", response_model=PracticeTemplateWithDays)
def get_template(template_id: int, db: Session = Depends(get_db)):
    """Get a complete practice template with all days and exercises."""
    template = db.query(PracticeTemplateModel).filter(
        PracticeTemplateModel.id == template_id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return template


@router.get("/{template_id}/days/{day_number}", response_model=PracticeDay)
def get_practice_day(
    template_id: int,
    day_number: int,
    db: Session = Depends(get_db)
):
    """Get a specific day from a practice template."""
    practice_day = db.query(PracticeDayModel).filter(
        PracticeDayModel.template_id == template_id,
        PracticeDayModel.day_number == day_number
    ).first()
    
    if not practice_day:
        raise HTTPException(status_code=404, detail="Practice day not found")
    
    return practice_day


