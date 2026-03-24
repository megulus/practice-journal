"""
User API — GET /api/user/me
"""
from fastapi import APIRouter, Depends

from app.models import User
from app.auth import get_current_user
from app.schemas.user import UserRead

router = APIRouter(prefix="/user", tags=["user"])


@router.get("/me", response_model=UserRead)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """Return current user profile."""
    return current_user
