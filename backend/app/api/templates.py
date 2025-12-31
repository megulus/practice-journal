from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.database import get_session
from app.models import PracticeTemplate, PracticeDay, ExerciseBlock, Exercise

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/", response_model=List[PracticeTemplate])
async def list_templates(
    instrument_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session)
):
    """Get all practice templates, optionally filtered by instrument."""
    statement = select(PracticeTemplate).where(PracticeTemplate.is_active == True)
    
    if instrument_id:
        statement = statement.where(PracticeTemplate.instrument_id == instrument_id)
    
    result = await session.execute(statement)
    templates = result.scalars().all()
    return templates


@router.get("/{template_id}")
async def get_template(template_id: int, session: AsyncSession = Depends(get_session)):
    """Get a complete practice template with all days and exercises."""
    # Load template with all nested relationships
    statement = (
        select(PracticeTemplate)
        .where(PracticeTemplate.id == template_id)
        .options(
            selectinload(PracticeTemplate.practice_days)
            .selectinload(PracticeDay.exercise_blocks)
            .selectinload(ExerciseBlock.exercises)
        )
    )
    
    result = await session.execute(statement)
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Access relationships to ensure they're loaded
    _ = template.practice_days
    
    # Manually build response with relationships
    response = {
        "id": template.id,
        "instrument_id": template.instrument_id,
        "name": template.name,
        "days_count": template.days_count,
        "description": template.description,
        "is_active": template.is_active,
        "practice_days": []
    }
    
    # Build practice_days manually to avoid lazy loading issues
    for day in sorted(template.practice_days, key=lambda x: x.day_number):
        day_data = {
            "id": day.id,
            "template_id": day.template_id,
            "day_number": day.day_number,
            "title": day.title,
            "warmup": day.warmup,
            "scales": day.scales,
            "repertoire": day.repertoire,
            "exercise_blocks": []
        }
        
        for block in sorted(day.exercise_blocks, key=lambda x: x.display_order):
            block_data = {
                "id": block.id,
                "practice_day_id": block.practice_day_id,
                "block_type": block.block_type,
                "display_order": block.display_order,
                "exercises": []
            }
            
            for ex in sorted(block.exercises, key=lambda x: x.display_order):
                block_data["exercises"].append({
                    "id": ex.id,
                    "block_id": ex.block_id,
                    "exercise_text": ex.exercise_text,
                    "display_order": ex.display_order
                })
            
            day_data["exercise_blocks"].append(block_data)
        
        response["practice_days"].append(day_data)
    
    return response


@router.get("/{template_id}/days/{day_number}")
async def get_practice_day(
    template_id: int,
    day_number: int,
    session: AsyncSession = Depends(get_session)
):
    """Get a specific day from a practice template."""
    statement = (
        select(PracticeDay)
        .where(
            PracticeDay.template_id == template_id,
            PracticeDay.day_number == day_number
        )
        .options(
            selectinload(PracticeDay.exercise_blocks)
            .selectinload(ExerciseBlock.exercises)
        )
    )
    
    result = await session.execute(statement)
    practice_day = result.scalar_one_or_none()
    
    if not practice_day:
        raise HTTPException(status_code=404, detail="Practice day not found")
    
    # Access relationships to ensure they're loaded
    _ = practice_day.exercise_blocks
    
    # Manually build response with relationships
    response = {
        "id": practice_day.id,
        "template_id": practice_day.template_id,
        "day_number": practice_day.day_number,
        "title": practice_day.title,
        "warmup": practice_day.warmup,
        "scales": practice_day.scales,
        "repertoire": practice_day.repertoire,
        "exercise_blocks": []
    }
    
    for block in sorted(practice_day.exercise_blocks, key=lambda x: x.display_order):
        block_data = {
            "id": block.id,
            "practice_day_id": block.practice_day_id,
            "block_type": block.block_type,
            "display_order": block.display_order,
            "exercises": []
        }
        
        for ex in sorted(block.exercises, key=lambda x: x.display_order):
            block_data["exercises"].append({
                "id": ex.id,
                "block_id": ex.block_id,
                "exercise_text": ex.exercise_text,
                "display_order": ex.display_order
            })
        
        response["exercise_blocks"].append(block_data)
    
    return response
