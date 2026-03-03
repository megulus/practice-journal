"""
User Settings API endpoints
"""
from fastapi import APIRouter, Depends
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import get_session
from app.models import User, UserSettings, UserSettingsRead, UserSettingsUpdate
from app.auth import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])


async def _get_or_create_settings(session: AsyncSession, user_id: int) -> UserSettings:
    """Fetch user's settings row, creating one with defaults if it doesn't exist."""
    result = await session.exec(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = result.first()
    if settings:
        return settings

    settings = UserSettings(user_id=user_id)
    session.add(settings)
    await session.commit()
    await session.refresh(settings)
    return settings


@router.get("/", response_model=UserSettingsRead)
async def get_settings(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get the current user's settings (auto-creates defaults if none exist)."""
    settings = await _get_or_create_settings(session, current_user.id)
    return settings


@router.patch("/", response_model=UserSettingsRead)
async def update_settings(
    data: UserSettingsUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Partially update the current user's settings."""
    settings = await _get_or_create_settings(session, current_user.id)

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)

    session.add(settings)
    await session.commit()
    await session.refresh(settings)
    return settings
