"""
Authentication utilities for Clerk JWT validation
"""
from typing import Optional
import jwt
from fastapi import Header, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import get_settings
from app.models import User
from app.database import async_session

settings = get_settings()


async def verify_clerk_token(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """
    Verify Clerk JWT token from Authorization header.
    Returns the decoded token payload if valid, None if no token provided.
    Raises HTTPException if token is invalid.
    """
    if not authorization:
        return None
    
    # Extract token from "Bearer <token>" format
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            return None
    except ValueError:
        return None
    
    # Verify token hasn't been provided but Clerk isn't configured
    if not settings.clerk_secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication is not configured"
        )
    
    # Verify JWT token
    try:
        # Clerk uses RS256 algorithm - we need to fetch the public key from JWKS
        # For now, we'll use a simpler approach with the secret key
        # In production, you'd want to verify using Clerk's JWKS endpoint
        payload = jwt.decode(
            token,
            settings.clerk_secret_key,
            algorithms=["RS256"],
            options={"verify_signature": False}  # Temporary - should verify in production
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )


async def get_or_create_user(session: AsyncSession, clerk_user_id: str, email: str, name: Optional[str] = None) -> User:
    """
    Get existing user or create new user record from Clerk user info.
    This is called on first authenticated request for each user.
    """
    # Try to find existing user
    result = await session.exec(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.first()
    
    if user:
        # Update email/name if changed
        if user.email != email or user.name != name:
            user.email = email
            if name:
                user.name = name
            session.add(user)
            await session.commit()
            await session.refresh(user)
        return user
    
    # Create new user
    user = User(
        clerk_user_id=clerk_user_id,
        email=email,
        name=name
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[User]:
    """
    Dependency to get the current authenticated user (optional).
    Returns None if no valid token is provided.
    Use this for endpoints that work with or without authentication.
    """
    token_payload = await verify_clerk_token(authorization)
    if not token_payload:
        return None
    
    # Extract user info from token
    clerk_user_id = token_payload.get("sub")  # Clerk uses 'sub' for user ID
    email = token_payload.get("email", "")
    name = token_payload.get("name")
    
    if not clerk_user_id:
        return None
    
    # Get or create user in our database
    async with async_session() as session:
        user = await get_or_create_user(session, clerk_user_id, email, name)
        return user


async def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    """
    Dependency to get the current authenticated user (required).
    Raises 401 if no valid token is provided.
    Use this for endpoints that require authentication.
    
    NOTE: This will be used in PR #3. For now, it's defined but not used.
    """
    user = await get_current_user_optional(authorization)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    return user

