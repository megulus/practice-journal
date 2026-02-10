from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlalchemy import func
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.database import get_session
from app.models import (
    PracticeTemplate, PracticeDay, ExerciseBlock, Exercise, User, BlockType,
    UserInstrument, TemplateCreate, TemplateUpdate, DayUpdate,
    BlockCreate, BlockUpdate, BlockReorder,
    ExerciseCreate, ExerciseUpdate,
)
from app.auth import get_current_user

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/", response_model=List[PracticeTemplate])
async def list_templates(
    instrument_id: Optional[int] = None,
    user_instrument_id: Optional[int] = None,
    include_archived: bool = False,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all practice templates (user's own + system templates), optionally filtered by instrument."""
    statement = select(PracticeTemplate).where(
        PracticeTemplate.deleted_at == None,
        (PracticeTemplate.user_id == current_user.id) | (PracticeTemplate.is_system == True)
    )

    if not include_archived:
        statement = statement.where(PracticeTemplate.is_active == True)

    # Filter by user_instrument_id (for user templates)
    if user_instrument_id:
        statement = statement.where(PracticeTemplate.user_instrument_id == user_instrument_id)
    # Filter by instrument_id (for system templates, deprecated for user templates)
    elif instrument_id:
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
        "user_instrument_id": template.user_instrument_id,
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
                "block_type_id": block.block_type_id,
                "duration_minutes": block.duration_minutes,
                "display_order": block.display_order,
                "exercises": []
            }

            for ex in sorted(block.exercises, key=lambda x: x.display_order):
                block_data["exercises"].append({
                    "id": ex.id,
                    "block_id": ex.block_id,
                    "exercise_text": ex.exercise_text,
                    "display_order": ex.display_order,
                    "tempo_bpm": ex.tempo_bpm,
                    "key": ex.key,
                    "technique_category": ex.technique_category,
                    "difficulty_level": ex.difficulty_level,
                    "notes": ex.notes,
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
            "block_type_id": block.block_type_id,
            "duration_minutes": block.duration_minutes,
            "display_order": block.display_order,
            "exercises": []
        }

        for ex in sorted(block.exercises, key=lambda x: x.display_order):
            block_data["exercises"].append({
                "id": ex.id,
                "block_id": ex.block_id,
                "exercise_text": ex.exercise_text,
                "display_order": ex.display_order,
                "tempo_bpm": ex.tempo_bpm,
                "key": ex.key,
                "technique_category": ex.technique_category,
                "difficulty_level": ex.difficulty_level,
                "notes": ex.notes,
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
                block_type_id=block.block_type_id,
                duration_minutes=block.duration_minutes,
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
                    display_order=exercise.display_order,
                    tempo_bpm=exercise.tempo_bpm,
                    key=exercise.key,
                    technique_category=exercise.technique_category,
                    difficulty_level=exercise.difficulty_level,
                    notes=exercise.notes,
                )
                session.add(user_exercise)
    
    await session.commit()
    await session.refresh(user_template)

    return {
        "id": user_template.id,
        "message": "Template copied successfully",
        "template": user_template
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def get_user_template(
    template_id: int,
    session: AsyncSession,
    current_user: User,
) -> PracticeTemplate:
    """Get a template owned by the current user, or raise 404."""
    statement = select(PracticeTemplate).where(
        PracticeTemplate.id == template_id,
        PracticeTemplate.deleted_at == None,
        PracticeTemplate.is_system == False,
        PracticeTemplate.user_id == current_user.id,
    )
    result = await session.exec(statement)
    template = result.one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


async def _get_day(
    template: PracticeTemplate,
    day_number: int,
    session: AsyncSession,
) -> PracticeDay:
    """Get a specific day within a template, or raise 404."""
    statement = select(PracticeDay).where(
        PracticeDay.template_id == template.id,
        PracticeDay.day_number == day_number,
    )
    result = await session.exec(statement)
    day = result.one_or_none()
    if not day:
        raise HTTPException(status_code=404, detail="Practice day not found")
    return day


async def _get_block(
    day: PracticeDay,
    block_id: int,
    session: AsyncSession,
) -> ExerciseBlock:
    """Get a specific block within a day, or raise 404."""
    statement = select(ExerciseBlock).where(
        ExerciseBlock.id == block_id,
        ExerciseBlock.practice_day_id == day.id,
    )
    result = await session.exec(statement)
    block = result.one_or_none()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    return block


# ---------------------------------------------------------------------------
# Template CRUD
# ---------------------------------------------------------------------------

@router.post("/", status_code=201)
async def create_template(
    body: TemplateCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new practice template with empty days."""
    # Verify user_instrument belongs to current user
    user_instrument_result = await session.exec(
        select(UserInstrument).where(
            UserInstrument.id == body.user_instrument_id,
            UserInstrument.user_id == current_user.id
        )
    )
    user_instrument = user_instrument_result.one_or_none()
    if not user_instrument:
        raise HTTPException(status_code=404, detail="User instrument not found")

    template = PracticeTemplate(
        user_instrument_id=body.user_instrument_id,
        name=body.name,
        days_count=body.days_count,
        description=body.description,
        is_active=True,
        is_system=False,
        user_id=current_user.id,
    )
    session.add(template)
    await session.flush()
    assert template.id is not None

    for i in range(1, body.days_count + 1):
        day = PracticeDay(
            template_id=template.id,
            day_number=i,
            title=f"Day {i}",
        )
        session.add(day)

    await session.commit()

    # Return full template via the existing get_template endpoint logic
    return await get_template(template.id, session, current_user)


@router.put("/{template_id}")
async def update_template(
    template_id: int,
    body: TemplateUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update template metadata. If days_count changes, add/remove days accordingly."""
    template = await get_user_template(template_id, session, current_user)

    if body.name is not None:
        template.name = body.name
    if body.description is not None:
        template.description = body.description
    if body.is_active is not None:
        template.is_active = body.is_active

    if body.days_count is not None and body.days_count != template.days_count:
        old_count = template.days_count
        new_count = body.days_count

        if new_count > old_count:
            # Add new days
            for i in range(old_count + 1, new_count + 1):
                day = PracticeDay(
                    template_id=template.id,
                    day_number=i,
                    title=f"Day {i}",
                )
                session.add(day)
        elif new_count < old_count:
            # Remove days from the end (cascade deletes blocks/exercises)
            statement = select(PracticeDay).where(
                PracticeDay.template_id == template.id,
                PracticeDay.day_number > new_count,
            )
            result = await session.exec(statement)
            for day in result.all():
                await session.delete(day)

        template.days_count = new_count

    session.add(template)
    await session.commit()

    return await get_template(template_id, session, current_user)


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a template."""
    template = await get_user_template(template_id, session, current_user)
    template.deleted_at = datetime.utcnow()
    session.add(template)
    await session.commit()
    return None


# ---------------------------------------------------------------------------
# Day endpoints
# ---------------------------------------------------------------------------

@router.put("/{template_id}/days/{day_number}")
async def update_day(
    template_id: int,
    day_number: int,
    body: DayUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a day's title."""
    template = await get_user_template(template_id, session, current_user)
    day = await _get_day(template, day_number, session)

    if body.title is not None:
        day.title = body.title

    session.add(day)
    await session.commit()
    await session.refresh(day)

    return {
        "id": day.id,
        "template_id": day.template_id,
        "day_number": day.day_number,
        "title": day.title,
        "warmup": day.warmup,
        "scales": day.scales,
        "repertoire": day.repertoire,
    }


# ---------------------------------------------------------------------------
# Block endpoints
# ---------------------------------------------------------------------------

@router.post("/{template_id}/days/{day_number}/blocks", status_code=201)
async def create_block(
    template_id: int,
    day_number: int,
    body: BlockCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Add a block to a day."""
    template = await get_user_template(template_id, session, current_user)
    day = await _get_day(template, day_number, session)

    # Look up block type to get slug for backward compat
    block_type = await session.get(BlockType, body.block_type_id)
    if not block_type:
        raise HTTPException(status_code=400, detail="Invalid block_type_id")

    # Auto-assign display_order if not provided
    display_order = body.display_order
    if display_order is None:
        result = await session.exec(
            select(func.coalesce(func.max(ExerciseBlock.display_order), -1)).where(
                ExerciseBlock.practice_day_id == day.id
            )
        )
        display_order = result.one() + 1

    block = ExerciseBlock(
        practice_day_id=day.id,
        block_type=block_type.slug,
        block_type_id=body.block_type_id,
        duration_minutes=body.duration_minutes,
        display_order=display_order,
    )
    session.add(block)
    await session.commit()
    await session.refresh(block)

    return {
        "id": block.id,
        "practice_day_id": block.practice_day_id,
        "block_type": block.block_type,
        "block_type_id": block.block_type_id,
        "duration_minutes": block.duration_minutes,
        "display_order": block.display_order,
        "exercises": [],
    }


@router.put("/{template_id}/days/{day_number}/blocks/reorder")
async def reorder_blocks(
    template_id: int,
    day_number: int,
    body: BlockReorder,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Reorder all blocks on a day."""
    template = await get_user_template(template_id, session, current_user)
    day = await _get_day(template, day_number, session)

    # Load all blocks for this day
    result = await session.exec(
        select(ExerciseBlock).where(ExerciseBlock.practice_day_id == day.id)
    )
    blocks_by_id = {b.id: b for b in result.all()}

    # Validate that all provided IDs belong to this day
    day_block_ids = set(blocks_by_id.keys())
    provided_ids = set(body.block_ids)
    if provided_ids != day_block_ids:
        raise HTTPException(
            status_code=400,
            detail="block_ids must contain exactly the blocks belonging to this day",
        )

    # Update display_order sequentially
    for order, block_id in enumerate(body.block_ids):
        blocks_by_id[block_id].display_order = order
        session.add(blocks_by_id[block_id])

    await session.commit()
    return {"status": "ok"}


@router.put("/{template_id}/days/{day_number}/blocks/{block_id}")
async def update_block(
    template_id: int,
    day_number: int,
    block_id: int,
    body: BlockUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a block."""
    template = await get_user_template(template_id, session, current_user)
    day = await _get_day(template, day_number, session)
    block = await _get_block(day, block_id, session)

    if body.block_type_id is not None:
        block_type = await session.get(BlockType, body.block_type_id)
        if not block_type:
            raise HTTPException(status_code=400, detail="Invalid block_type_id")
        block.block_type_id = body.block_type_id
        block.block_type = block_type.slug
    if body.duration_minutes is not None:
        block.duration_minutes = body.duration_minutes
    if body.display_order is not None:
        block.display_order = body.display_order

    session.add(block)
    await session.commit()
    await session.refresh(block)

    return {
        "id": block.id,
        "practice_day_id": block.practice_day_id,
        "block_type": block.block_type,
        "block_type_id": block.block_type_id,
        "duration_minutes": block.duration_minutes,
        "display_order": block.display_order,
    }


@router.delete("/{template_id}/days/{day_number}/blocks/{block_id}", status_code=204)
async def delete_block(
    template_id: int,
    day_number: int,
    block_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete a block and its exercises."""
    template = await get_user_template(template_id, session, current_user)
    day = await _get_day(template, day_number, session)
    block = await _get_block(day, block_id, session)

    await session.delete(block)
    await session.commit()
    return None


# ---------------------------------------------------------------------------
# Exercise endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/{template_id}/days/{day_number}/blocks/{block_id}/exercises",
    status_code=201,
)
async def create_exercise(
    template_id: int,
    day_number: int,
    block_id: int,
    body: ExerciseCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Add an exercise to a block."""
    template = await get_user_template(template_id, session, current_user)
    day = await _get_day(template, day_number, session)
    block = await _get_block(day, block_id, session)

    display_order = body.display_order
    if display_order is None:
        result = await session.exec(
            select(func.coalesce(func.max(Exercise.display_order), -1)).where(
                Exercise.block_id == block.id
            )
        )
        display_order = result.one() + 1

    exercise = Exercise(
        block_id=block.id,
        exercise_text=body.exercise_text,
        display_order=display_order,
        tempo_bpm=body.tempo_bpm,
        key=body.key,
        technique_category=body.technique_category,
        difficulty_level=body.difficulty_level,
        notes=body.notes,
    )
    session.add(exercise)
    await session.commit()
    await session.refresh(exercise)

    return {
        "id": exercise.id,
        "block_id": exercise.block_id,
        "exercise_text": exercise.exercise_text,
        "display_order": exercise.display_order,
        "tempo_bpm": exercise.tempo_bpm,
        "key": exercise.key,
        "technique_category": exercise.technique_category,
        "difficulty_level": exercise.difficulty_level,
        "notes": exercise.notes,
    }


@router.put(
    "/{template_id}/days/{day_number}/blocks/{block_id}/exercises/{exercise_id}",
)
async def update_exercise(
    template_id: int,
    day_number: int,
    block_id: int,
    exercise_id: int,
    body: ExerciseUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update an exercise."""
    template = await get_user_template(template_id, session, current_user)
    day = await _get_day(template, day_number, session)
    block = await _get_block(day, block_id, session)

    statement = select(Exercise).where(
        Exercise.id == exercise_id,
        Exercise.block_id == block.id,
    )
    result = await session.exec(statement)
    exercise = result.one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    if body.exercise_text is not None:
        exercise.exercise_text = body.exercise_text
    if body.display_order is not None:
        exercise.display_order = body.display_order
    if body.tempo_bpm is not None:
        exercise.tempo_bpm = body.tempo_bpm
    if body.key is not None:
        exercise.key = body.key
    if body.technique_category is not None:
        exercise.technique_category = body.technique_category
    if body.difficulty_level is not None:
        exercise.difficulty_level = body.difficulty_level
    if body.notes is not None:
        exercise.notes = body.notes

    session.add(exercise)
    await session.commit()
    await session.refresh(exercise)

    return {
        "id": exercise.id,
        "block_id": exercise.block_id,
        "exercise_text": exercise.exercise_text,
        "display_order": exercise.display_order,
        "tempo_bpm": exercise.tempo_bpm,
        "key": exercise.key,
        "technique_category": exercise.technique_category,
        "difficulty_level": exercise.difficulty_level,
        "notes": exercise.notes,
    }


@router.delete(
    "/{template_id}/days/{day_number}/blocks/{block_id}/exercises/{exercise_id}",
    status_code=204,
)
async def delete_exercise(
    template_id: int,
    day_number: int,
    block_id: int,
    exercise_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete an exercise."""
    template = await get_user_template(template_id, session, current_user)
    day = await _get_day(template, day_number, session)
    block = await _get_block(day, block_id, session)

    statement = select(Exercise).where(
        Exercise.id == exercise_id,
        Exercise.block_id == block.id,
    )
    result = await session.exec(statement)
    exercise = result.one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    await session.delete(exercise)
    await session.commit()
    return None
