"""
Settings API — GET/PATCH /api/settings
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.dialects.postgresql import insert as pg_insert
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

    Creation is an atomic upsert for the same reason `get_or_create_user` is
    (app/auth.py): several endpoints call this, and a client that fires them
    concurrently — Progress → Insights loads three at once, two of which
    resolve week_starts_on — can have every request find no row and all of them
    try to create one. A plain INSERT lets one win and the rest hit the unique
    user_id index, 500-ing a page load that should have just worked.
    INSERT ... ON CONFLICT DO NOTHING resolves the collision in a single
    statement (the losers no-op), then we read the row back to return a
    session-managed instance.

    Only user_id is supplied. SQLModel's `Field(default=...)` becomes a
    column-level default on the mapped Column, which SQLAlchemy Core applies to
    this insert on its own — the emitted SQL names every column either way, so
    restating the defaults here would be noise that can drift from the model.
    That covers created_at too: its default_factory is utcnow, so the row lands
    on the app's naive-UTC clock rather than the column's now() server_default.
    """
    result = await session.exec(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = result.first()
    if settings:
        return settings

    await session.exec(
        pg_insert(UserSettings)
        .values(user_id=user_id)
        .on_conflict_do_nothing(index_elements=["user_id"])
    )
    await session.commit()

    result = await session.exec(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = result.first()
    if settings is None:
        # The row we just upserted must exist; a miss means something is deeply
        # wrong (not the benign race). Fail loudly rather than hand back None
        # into a non-optional contract every caller dereferences.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load settings after creation",
        )
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
