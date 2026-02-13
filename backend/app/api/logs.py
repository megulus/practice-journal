from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import desc
from typing import List, Optional

from app.database import get_session
from app.models import (
    PracticeLog, PracticeLogDetail, PracticeLogCreate, PracticeLogRead,
    PracticeTemplate, User, ExerciseProgress, PracticeOutcome
)
from app.auth import get_current_user
from sqlalchemy import func

router = APIRouter(prefix="/logs", tags=["logs"])


@router.post("/", response_model=PracticeLogRead, status_code=201)
async def create_practice_log(
    log_data: PracticeLogCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new practice log entry."""
    # Verify user has access to the template (if provided)
    if log_data.template_id is not None:
        template_statement = select(PracticeTemplate).where(
            PracticeTemplate.id == log_data.template_id,
            PracticeTemplate.deleted_at == None,
            (PracticeTemplate.user_id == current_user.id) | (PracticeTemplate.is_system == True)
        )
        template_result = await session.exec(template_statement)
        template = template_result.one_or_none()

        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

    # Create the main log entry
    practice_log = PracticeLog(
        user_id=current_user.id,
        template_id=log_data.template_id,
        day_number=log_data.day_number,
        practice_date=log_data.practice_date,
        duration_minutes=log_data.duration_minutes,
        notes=log_data.notes
    )
    session.add(practice_log)
    await session.flush()  # Get the log ID
    assert practice_log.id is not None  # Type narrowing for type checker
    
    # Create log details and track progress
    for detail in log_data.log_details:
        log_detail = PracticeLogDetail(
            log_id=practice_log.id,
            section_type=detail.section_type,
            content=detail.content,
            exercise_id=detail.exercise_id,
            tempo_practiced=detail.tempo_practiced,
            outcome=detail.outcome,
            notes=detail.notes,
            key_practiced=detail.key_practiced,
            time_signature=detail.time_signature,
            duration_minutes=detail.duration_minutes,
        )
        session.add(log_detail)

        # Update exercise progress if exercise_id is provided
        if detail.exercise_id is not None:
            await _update_exercise_progress(
                session=session,
                user_id=current_user.id,
                exercise_id=detail.exercise_id,
                tempo_practiced=detail.tempo_practiced,
                outcome=detail.outcome,
            )

    await session.commit()
    await session.refresh(practice_log)
    
    # Load the log with details
    statement = (
        select(PracticeLog)
        .where(PracticeLog.id == practice_log.id)
        .options(selectinload(PracticeLog.log_details))  # type: ignore[arg-type]
    )
    result = await session.execute(statement)
    return result.scalar_one()


@router.get("/", response_model=List[PracticeLogRead])
async def list_practice_logs(
    template_id: Optional[int] = None,
    limit: int = 50,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get practice logs for the current user, optionally filtered by template."""
    # All logs belong to the user who created them
    statement = (
        select(PracticeLog)
        .where(
            PracticeLog.user_id == current_user.id,
            PracticeLog.deleted_at == None
        )
        .order_by(desc(PracticeLog.practice_date))  # type: ignore[arg-type]
        .options(selectinload(PracticeLog.log_details))  # type: ignore[arg-type]
        .limit(limit)
    )

    if template_id:
        # Verify user has access to this template
        template_statement = select(PracticeTemplate).where(
            PracticeTemplate.id == template_id,
            PracticeTemplate.deleted_at == None,
            (PracticeTemplate.user_id == current_user.id) | (PracticeTemplate.is_system == True)
        )
        template_result = await session.exec(template_statement)
        if not template_result.one_or_none():
            raise HTTPException(status_code=404, detail="Template not found")
        statement = statement.where(PracticeLog.template_id == template_id)
    
    result = await session.exec(statement)
    logs = result.all()
    # Access relationship to ensure it's included in serialization
    for log in logs:
        _ = log.log_details
    return logs


@router.get("/section-types", response_model=List[str])
async def get_section_types(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get distinct section type names from the user's past logs."""
    statement = (
        select(PracticeLogDetail.section_type)
        .join(PracticeLog, PracticeLogDetail.log_id == PracticeLog.id)
        .where(
            PracticeLog.user_id == current_user.id,
            PracticeLog.deleted_at == None,
        )
        .distinct()
        .order_by(PracticeLogDetail.section_type)
    )
    result = await session.exec(statement)
    return list(result.all())


@router.get("/{log_id}", response_model=PracticeLogRead)
async def get_practice_log(
    log_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific practice log."""
    statement = (
        select(PracticeLog)
        .where(
            PracticeLog.id == log_id,
            PracticeLog.deleted_at == None
        )
        .options(selectinload(PracticeLog.log_details))  # type: ignore[arg-type]
    )
    
    result = await session.exec(statement)
    log = result.one_or_none()
    
    if not log:
        raise HTTPException(status_code=404, detail="Practice log not found")
    
    # Logs belong to the user who created them
    if log.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Practice log not found")

    return log


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

async def _update_exercise_progress(
    session: AsyncSession,
    user_id: int,
    exercise_id: int,
    tempo_practiced: Optional[int],
    outcome: Optional[str],
) -> None:
    """Update or create exercise progress record for a user's exercise."""
    # Find existing progress record
    statement = select(ExerciseProgress).where(
        ExerciseProgress.user_id == user_id,
        ExerciseProgress.exercise_id == exercise_id,
    )
    result = await session.exec(statement)
    progress = result.one_or_none()

    if progress is None:
        # Create new progress record
        progress = ExerciseProgress(
            user_id=user_id,
            exercise_id=exercise_id,
            times_practiced=0,
            struggled_count=0,
            okay_count=0,
            nailed_it_count=0,
            created_at=datetime.utcnow(),
        )
        session.add(progress)

    # Update stats
    progress.times_practiced += 1
    progress.last_practiced_at = datetime.utcnow()

    if tempo_practiced is not None:
        progress.current_tempo = tempo_practiced

    # Update outcome counters
    if outcome == PracticeOutcome.STRUGGLED.value:
        progress.struggled_count += 1
    elif outcome == PracticeOutcome.OKAY.value:
        progress.okay_count += 1
    elif outcome == PracticeOutcome.NAILED_IT.value:
        progress.nailed_it_count += 1

    session.add(progress)
