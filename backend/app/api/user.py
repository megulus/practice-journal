"""
User API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_current_user_optional
from app.models import User

router = APIRouter(prefix="/user", tags=["user"])


@router.get("/me")
async def get_current_user_info(
    current_user: User | None = Depends(get_current_user_optional)
) -> dict:
    """
    Get information about the currently authenticated user.
    Returns user info if authenticated, otherwise returns a message.
    
    This endpoint demonstrates optional authentication - it works
    with or without a valid JWT token.
    """
    if not current_user:
        return {
            "authenticated": False,
            "message": "No authentication provided"
        }
    
    # Check if user account is soft-deleted
    if current_user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been deactivated"
        )
    
    return {
        "authenticated": True,
        "user": {
            "id": current_user.id,
            "clerk_user_id": current_user.clerk_user_id,
            "email": current_user.email,
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "created_at": current_user.created_at.isoformat()
        }
    }

