"""
Settings API — GET/PATCH /api/settings
"""
from fastapi import APIRouter, Depends
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import get_session
from app.models import User, UserSettings
from app.auth import get_current_user
from app.schemas.user import UserSettingsRead, UserSettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


async def _get_or_create_settings(
    session: AsyncSession, user_id: int
) -> UserSettings:
    """
    Get user settings, auto-creating with defaults if missing.

    The insert can lose a race: several endpoints call this, and a client that
    fires them concurrently (the Progress → Insights panel loads three at once)
    can have two requests both find no row and both try to create one. The
    unique index on user_id means the loser gets an IntegrityError, so treat
    that as "someone else just made it" and re-read.
    """
    result = await session.exec(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = result.first()
    if settings:
        return settings

    settings = UserSettings(user_id=user_id)
    session.add(settings)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        result = await session.exec(
            select(UserSettings).where(UserSettings.user_id == user_id)
        )
        existing = result.first()
        if existing is None:
            raise
        return existing
    await session.refresh(settings)
    return settings


@router.get("", response_model=UserSettingsRead)
async def get_settings(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get current user's settings. Auto-creates defaults if none exist."""
    return await _get_or_create_settings(session, current_user.id)


@router.patch("", response_model=UserSettingsRead)
async def update_settings(
    body: UserSettingsUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Partially update user's settings."""
    settings = await _get_or_create_settings(session, current_user.id)

    update_data = body.model_dump(exclude_unset=True, mode="json")
    for field, value in update_data.items():
        setattr(settings, field, value)

    session.add(settings)
    await session.commit()
    await session.refresh(settings)
    return settings
