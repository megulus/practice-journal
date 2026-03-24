"""
User API — GET /api/user/me
"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import get_session
from app.models import User
from app.auth import get_current_user_optional
from app.schemas.user import UserRead

router = APIRouter(prefix="/user", tags=["user"])


@router.get("/me", response_model=UserRead)
async def get_me(
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Return current user profile, or 401 if not authenticated."""
    if current_user is None:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return current_user
