from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.practice_log import PracticeLog as PracticeLogModel
from app.schemas.log import AnalyticsSummary

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/", response_model=AnalyticsSummary)
def get_analytics(
    template_id: int = None,
    db: Session = Depends(get_db)
):
    """Get practice statistics and analytics."""
    query = db.query(PracticeLogModel)
    
    if template_id:
        query = query.filter(PracticeLogModel.template_id == template_id)
    
    # Get total sessions
    total_sessions = query.count()
    
    # Get total minutes
    total_minutes = db.query(
        func.sum(PracticeLogModel.duration_minutes)
    ).filter(
        PracticeLogModel.template_id == template_id if template_id else True
    ).scalar() or 0
    
    # Calculate average duration
    average_duration = total_minutes / total_sessions if total_sessions > 0 else 0
    
    # Get sessions by day number
    sessions_by_day = {}
    day_stats = db.query(
        PracticeLogModel.day_number,
        func.count(PracticeLogModel.id).label('count')
    ).filter(
        PracticeLogModel.template_id == template_id if template_id else True
    ).group_by(PracticeLogModel.day_number).all()
    
    for day_num, count in day_stats:
        sessions_by_day[str(day_num)] = count
    
    return AnalyticsSummary(
        total_sessions=total_sessions,
        total_minutes=int(total_minutes),
        average_duration=round(average_duration, 1),
        sessions_by_day=sessions_by_day
    )


