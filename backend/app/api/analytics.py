from fastapi import APIRouter, Depends
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import Optional

from app.database import get_session
from app.models import PracticeLog, AnalyticsSummary

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/", response_model=AnalyticsSummary)
async def get_analytics(
    template_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session)
):
    """Get practice statistics and analytics."""
    # Base query
    statement = select(PracticeLog)
    if template_id:
        statement = statement.where(PracticeLog.template_id == template_id)
    
    # Get total sessions
    count_statement = select(func.count(PracticeLog.id))
    if template_id:
        count_statement = count_statement.where(PracticeLog.template_id == template_id)
    
    result = await session.execute(count_statement)
    total_sessions = result.scalar() or 0
    
    # Get total minutes
    sum_statement = select(func.sum(PracticeLog.duration_minutes))
    if template_id:
        sum_statement = sum_statement.where(PracticeLog.template_id == template_id)
    
    result = await session.execute(sum_statement)
    total_minutes = result.scalar() or 0
    
    # Calculate average duration
    average_duration = total_minutes / total_sessions if total_sessions > 0 else 0
    
    # Get sessions by day number
    sessions_by_day = {}
    day_statement = (
        select(PracticeLog.day_number, func.count(PracticeLog.id).label('count'))
        .group_by(PracticeLog.day_number)
    )
    if template_id:
        day_statement = day_statement.where(PracticeLog.template_id == template_id)
    
    result = await session.execute(day_statement)
    for row in result:
        sessions_by_day[str(row.day_number)] = row.count
    
    return AnalyticsSummary(
        total_sessions=total_sessions,
        total_minutes=int(total_minutes),
        average_duration=round(average_duration, 1),
        sessions_by_day=sessions_by_day
    )
