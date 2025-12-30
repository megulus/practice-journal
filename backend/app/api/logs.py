from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import desc
from typing import List, Optional

from app.database import get_session
from app.models import PracticeLog, PracticeLogDetail, PracticeLogCreate

router = APIRouter(prefix="/logs", tags=["logs"])


@router.post("/", response_model=PracticeLog, status_code=201)
async def create_practice_log(
    log_data: PracticeLogCreate,
    session: AsyncSession = Depends(get_session)
):
    """Create a new practice log entry."""
    # Create the main log entry
    practice_log = PracticeLog(
        template_id=log_data.template_id,
        day_number=log_data.day_number,
        practice_date=log_data.practice_date,
        duration_minutes=log_data.duration_minutes,
        notes=log_data.notes
    )
    session.add(practice_log)
    await session.flush()  # Get the log ID
    
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
        .options(selectinload(PracticeLog.log_details))
    )
    result = await session.execute(statement)
    return result.scalar_one()


@router.get("/", response_model=List[PracticeLog])
async def list_practice_logs(
    template_id: Optional[int] = None,
    limit: int = 50,
    session: AsyncSession = Depends(get_session)
):
    """Get practice logs, optionally filtered by template."""
    statement = (
        select(PracticeLog)
        .order_by(desc(PracticeLog.practice_date))
        .options(selectinload(PracticeLog.log_details))
        .limit(limit)
    )
    
    if template_id:
        statement = statement.where(PracticeLog.template_id == template_id)
    
    result = await session.execute(statement)
    logs = result.scalars().all()
    return logs


@router.get("/{log_id}", response_model=PracticeLog)
async def get_practice_log(log_id: int, session: AsyncSession = Depends(get_session)):
    """Get a specific practice log."""
    statement = (
        select(PracticeLog)
        .where(PracticeLog.id == log_id)
        .options(selectinload(PracticeLog.log_details))
    )
    
    result = await session.execute(statement)
    log = result.scalar_one_or_none()
    
    if not log:
        raise HTTPException(status_code=404, detail="Practice log not found")
    
    return log
