"""
Suggestions API

Provides exercise progress data for the frontend rules engine to compute suggestions.
Also handles suggestion dismissals/acceptances for persistence.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select, and_
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models import (
    ExerciseProgress, Exercise, ExerciseBlock, PracticeDay,
    PracticeTemplate, Instrument, User
)
from app.auth import get_current_user

router = APIRouter(prefix="/suggestions", tags=["suggestions"])


@router.get("/progress")
async def get_exercise_progress(
    instrument_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Get exercise progress for the current user's exercises.

    Optionally filter by instrument. Returns progress data that the frontend
    rules engine can use to compute suggestions.
    """
    # Build query to get all exercises for the user's templates
    # We need to traverse: Instrument -> Template -> Day -> Block -> Exercise

    # First, get the user's templates (optionally filtered by instrument)
    template_query = select(PracticeTemplate).where(
        PracticeTemplate.user_id == current_user.id,
        PracticeTemplate.deleted_at == None,
    )
    if instrument_id is not None:
        template_query = template_query.where(PracticeTemplate.instrument_id == instrument_id)

    template_result = await session.exec(template_query)
    templates = template_result.all()
    template_ids = [t.id for t in templates]

    if not template_ids:
        return {"exercises": [], "progress": []}

    # Get all exercises in these templates
    exercise_query = (
        select(Exercise)
        .join(ExerciseBlock, Exercise.block_id == ExerciseBlock.id)
        .join(PracticeDay, ExerciseBlock.practice_day_id == PracticeDay.id)
        .where(PracticeDay.template_id.in_(template_ids))  # type: ignore[union-attr]
    )
    exercise_result = await session.exec(exercise_query)
    exercises = exercise_result.all()
    exercise_ids = [e.id for e in exercises]

    if not exercise_ids:
        return {"exercises": [], "progress": []}

    # Get progress records for these exercises
    progress_query = select(ExerciseProgress).where(
        ExerciseProgress.user_id == current_user.id,
        ExerciseProgress.exercise_id.in_(exercise_ids),  # type: ignore[union-attr]
    )
    progress_result = await session.exec(progress_query)
    progress_records = progress_result.all()

    # Build response
    exercises_data = [
        {
            "id": ex.id,
            "exercise_text": ex.exercise_text,
            "tempo_bpm": ex.tempo_bpm,
            "key": ex.key,
            "technique_category": ex.technique_category,
            "difficulty_level": ex.difficulty_level,
        }
        for ex in exercises
    ]

    progress_data = [
        {
            "id": p.id,
            "exercise_id": p.exercise_id,
            "times_practiced": p.times_practiced,
            "last_practiced_at": p.last_practiced_at.isoformat() if p.last_practiced_at else None,
            "current_tempo": p.current_tempo,
            "current_difficulty": p.current_difficulty,
            "struggled_count": p.struggled_count,
            "okay_count": p.okay_count,
            "nailed_it_count": p.nailed_it_count,
        }
        for p in progress_records
    ]

    return {
        "exercises": exercises_data,
        "progress": progress_data,
    }


@router.post("/dismiss/{suggestion_key}")
async def dismiss_suggestion(
    suggestion_key: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Dismiss a suggestion so it doesn't appear again.

    suggestion_key format: "exercise_{exercise_id}_{rule_id}"
    e.g., "exercise_123_tempo_increase"

    For MVP, we'll store this in a simple table. Future: could use Redis or similar.
    """
    # For MVP, return success - dismissals will be stored in frontend/localStorage
    # TODO: Add SuggestionDismissal table for server-side persistence
    return {"status": "dismissed", "suggestion_key": suggestion_key}


@router.post("/accept/{suggestion_key}")
async def accept_suggestion(
    suggestion_key: str,
    action: dict,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Accept a suggestion and apply its action.

    The action dict contains:
    - exercise_id: int
    - field: str (e.g., "tempo_bpm")
    - value: any

    This updates the exercise with the new value.
    """
    exercise_id = action.get("exercise_id")
    field = action.get("field")
    value = action.get("value")

    if not all([exercise_id, field, value is not None]):
        raise HTTPException(status_code=400, detail="Missing exercise_id, field, or value")

    # Verify user owns this exercise (via template ownership)
    exercise_query = (
        select(Exercise)
        .join(ExerciseBlock, Exercise.block_id == ExerciseBlock.id)
        .join(PracticeDay, ExerciseBlock.practice_day_id == PracticeDay.id)
        .join(PracticeTemplate, PracticeDay.template_id == PracticeTemplate.id)
        .where(
            Exercise.id == exercise_id,
            PracticeTemplate.user_id == current_user.id,
            PracticeTemplate.deleted_at == None,
        )
    )
    result = await session.exec(exercise_query)
    exercise = result.one_or_none()

    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    # Update the exercise field
    allowed_fields = ["tempo_bpm", "key", "technique_category", "difficulty_level", "notes"]
    if field not in allowed_fields:
        raise HTTPException(status_code=400, detail=f"Cannot update field: {field}")

    setattr(exercise, field, value)
    session.add(exercise)
    await session.commit()
    await session.refresh(exercise)

    return {
        "status": "accepted",
        "suggestion_key": suggestion_key,
        "exercise": {
            "id": exercise.id,
            "exercise_text": exercise.exercise_text,
            field: getattr(exercise, field),
        }
    }
