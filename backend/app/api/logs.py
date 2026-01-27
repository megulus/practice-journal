from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import desc
from typing import List, Optional

from app.database import get_session
from app.models import PracticeLog, PracticeLogDetail, PracticeLogCreate, PracticeTemplate, User
from app.auth import get_current_user

router = APIRouter(prefix="/logs", tags=["logs"])


@router.post("/", response_model=PracticeLog, status_code=201)
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
    
    # Create log details
    for detail in log_data.log_details:
        log_detail = PracticeLogDetail(
            log_id=practice_log.id,
            section_type=detail.section_type,
            content=detail.content
        )
        session.add(log_detail)
    
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


@router.get("/", response_model=List[PracticeLog])
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
    return logs


@router.get("/{log_id}", response_model=PracticeLog)
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
