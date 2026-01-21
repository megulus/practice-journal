from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.database import get_session
from app.models import PracticeTemplate, PracticeDay, ExerciseBlock, Exercise, User
from app.auth import get_current_user

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/", response_model=List[PracticeTemplate])
async def list_templates(
    instrument_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all practice templates (user's own + system templates), optionally filtered by instrument."""
    statement = select(PracticeTemplate).where(
        PracticeTemplate.is_active == True,
        PracticeTemplate.deleted_at == None,
        (PracticeTemplate.user_id == current_user.id) | (PracticeTemplate.is_system == True)
    )
    
    if instrument_id:
        statement = statement.where(PracticeTemplate.instrument_id == instrument_id)
    
    result = await session.exec(statement)
    templates = result.all()
    return templates


@router.get("/{template_id}")
async def get_template(
    template_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a complete practice template with all days and exercises."""
    # Load template with all nested relationships
    # Only allow access to user's own templates or system templates
    statement = (
        select(PracticeTemplate)
        .where(
            PracticeTemplate.id == template_id,
            PracticeTemplate.deleted_at == None,
            (PracticeTemplate.user_id == current_user.id) | (PracticeTemplate.is_system == True)
        )
        .options(
            selectinload(PracticeTemplate.practice_days)  # type: ignore[arg-type]
            .selectinload(PracticeDay.exercise_blocks)  # type: ignore[arg-type]
            .selectinload(ExerciseBlock.exercises)  # type: ignore[arg-type]
        )
    )
    
    result = await session.exec(statement)
    template = result.one_or_none()
    
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
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific day from a practice template."""
    # First verify user has access to the template
    template_statement = select(PracticeTemplate).where(
        PracticeTemplate.id == template_id,
        PracticeTemplate.deleted_at == None,
        (PracticeTemplate.user_id == current_user.id) | (PracticeTemplate.is_system == True)
    )
    template_result = await session.exec(template_statement)
    template = template_result.one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    statement = (
        select(PracticeDay)
        .where(
            PracticeDay.template_id == template_id,
            PracticeDay.day_number == day_number
        )
        .options(
            selectinload(PracticeDay.exercise_blocks)  # type: ignore[arg-type]
            .selectinload(ExerciseBlock.exercises)  # type: ignore[arg-type]
        )
    )
    
    result = await session.exec(statement)
    practice_day = result.one_or_none()
    
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


@router.post("/{template_id}/copy", status_code=201)
async def copy_template(
    template_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Copy a system template to user's account with all days and exercises."""
    # Get the system template with all nested data
    statement = (
        select(PracticeTemplate)
        .where(
            PracticeTemplate.id == template_id,
            PracticeTemplate.is_system == True
        )
        .options(
            selectinload(PracticeTemplate.practice_days)  # type: ignore[arg-type]
            .selectinload(PracticeDay.exercise_blocks)  # type: ignore[arg-type]
            .selectinload(ExerciseBlock.exercises)  # type: ignore[arg-type]
        )
    )
    
    result = await session.exec(statement)
    system_template = result.one_or_none()
    
    if not system_template:
        raise HTTPException(status_code=404, detail="System template not found")
    
    # Create a copy for the user
    user_template = PracticeTemplate(
        instrument_id=system_template.instrument_id,
        name=system_template.name,
        days_count=system_template.days_count,
        description=system_template.description,
        is_active=True,
        is_system=False,
        user_id=current_user.id
    )
    session.add(user_template)
    await session.flush()  # Get the template ID
    assert user_template.id is not None  # Type narrowing for type checker
    
    # Copy all practice days and exercises
    for day in system_template.practice_days:
        user_day = PracticeDay(
            template_id=user_template.id,
            day_number=day.day_number,
            title=day.title,
            warmup=day.warmup,
            scales=day.scales,
            repertoire=day.repertoire
        )
        session.add(user_day)
        await session.flush()  # Get the day ID
        assert user_day.id is not None  # Type narrowing for type checker
        
        # Copy exercise blocks
        for block in day.exercise_blocks:
            user_block = ExerciseBlock(
                practice_day_id=user_day.id,
                block_type=block.block_type,
                display_order=block.display_order
            )
            session.add(user_block)
            await session.flush()  # Get the block ID
            assert user_block.id is not None  # Type narrowing for type checker
            
            # Copy exercises
            for exercise in block.exercises:
                user_exercise = Exercise(
                    block_id=user_block.id,
                    exercise_text=exercise.exercise_text,
                    display_order=exercise.display_order
                )
                session.add(user_exercise)
    
    await session.commit()
    await session.refresh(user_template)
    
    return {
        "id": user_template.id,
        "message": "Template copied successfully",
        "template": user_template
    }
