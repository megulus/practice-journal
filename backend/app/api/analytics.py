from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import Optional

from app.database import get_session
from app.models import PracticeLog, AnalyticsSummary, PracticeTemplate, User
from app.auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/", response_model=AnalyticsSummary)
async def get_analytics(
    template_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get practice statistics and analytics for user's templates."""
    # Get user's template IDs (excluding soft-deleted templates)
    template_statement = select(PracticeTemplate.id).where(
        PracticeTemplate.deleted_at == None,
        (PracticeTemplate.user_id == current_user.id) | (PracticeTemplate.is_system == True)
    )
    template_result = await session.exec(template_statement)
    user_template_ids = list(template_result.all())
    
    if not user_template_ids:
        # No templates, return empty analytics
        return AnalyticsSummary(
            total_sessions=0,
            total_minutes=0,
            average_duration=0.0,
            sessions_by_day={}
        )
    
    # Filter by specific template if provided
    if template_id:
        # Verify user has access to this template
        if template_id not in user_template_ids:
            raise HTTPException(status_code=404, detail="Template not found")
        filter_template_ids = [template_id]
    else:
        filter_template_ids = user_template_ids
    
    # Get total sessions (excluding soft-deleted logs)
    count_statement = select(func.count(PracticeLog.id)).where(  # type: ignore[arg-type]
        PracticeLog.template_id.in_(filter_template_ids),  # type: ignore[attr-defined]
        PracticeLog.deleted_at == None
    )
    
    result = await session.exec(count_statement)
    total_sessions = result.one() or 0
    
    # Get total minutes (excluding soft-deleted logs)
    sum_statement = select(func.sum(PracticeLog.duration_minutes)).where(  # type: ignore[arg-type]
        PracticeLog.template_id.in_(filter_template_ids),  # type: ignore[attr-defined]
        PracticeLog.deleted_at == None
    )
    
    result = await session.exec(sum_statement)
    total_minutes = result.one() or 0
    
    # Calculate average duration
    average_duration = total_minutes / total_sessions if total_sessions > 0 else 0
    
    # Get sessions by day number (excluding soft-deleted logs)
    sessions_by_day = {}
    day_statement = (
        select(PracticeLog.day_number, func.count(PracticeLog.id).label('count'))  # type: ignore[arg-type]
        .where(
            PracticeLog.template_id.in_(filter_template_ids),  # type: ignore[attr-defined]
            PracticeLog.deleted_at == None
        )
        .group_by(PracticeLog.day_number)  # type: ignore[arg-type]
    )
    
    result = await session.exec(day_statement)
    for row in result:
        sessions_by_day[str(row[0])] = row[1]  # row is tuple: (day_number, count)
    
    return AnalyticsSummary(
        total_sessions=total_sessions,
        total_minutes=int(total_minutes),
        average_duration=round(average_duration, 1),
        sessions_by_day=sessions_by_day
    )
