"""
Settings API — GET/PATCH /api/settings
"""
from fastapi import APIRouter, Depends
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
    """Get user settings, auto-creating with defaults if missing."""
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

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        # Convert enum values to strings for storage
        setattr(settings, field, value.value if hasattr(value, "value") else value)

    session.add(settings)
    await session.commit()
    await session.refresh(settings)
    return settings
