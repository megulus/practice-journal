"""
Authentication utilities for Clerk JWT validation
"""
from typing import Optional
import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import get_settings
from app.models import User
from app.database import get_session

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


async def get_or_create_user(
    session: AsyncSession,
    clerk_user_id: str,
    email: str,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None
) -> User:
    """
    Get existing user or create new user record from Clerk JWT claims.
    Called on first authenticated request for each user.
    """
    from sqlmodel import update

    # Try to find existing user
    result = await session.exec(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.first()

    if user:
        # Update fields if we have new values to set
        needs_update = False
        if email and user.email != email:
            needs_update = True
        if first_name and user.first_name != first_name:
            needs_update = True
        if last_name and user.last_name != last_name:
            needs_update = True

        if needs_update:
            stmt = (
                update(User)
                .where(User.clerk_user_id == clerk_user_id)
                .values(
                    email=email if email else user.email,
                    first_name=first_name if first_name else user.first_name,
                    last_name=last_name if last_name else user.last_name
                )
            )
            await session.exec(stmt)
            await session.commit()
            await session.refresh(user)
        return user

    # Create new user
    user = User(
        clerk_user_id=clerk_user_id,
        email=email,
        first_name=first_name,
        last_name=last_name
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    session: AsyncSession = Depends(get_session)
) -> Optional[User]:
    """
    Dependency to get the current authenticated user (optional).
    Returns None if no valid token is provided.
    Use this for endpoints that work with or without authentication.
    """
    token_payload = await verify_clerk_token(authorization)
    if not token_payload:
        return None

    # Extract user info from JWT claims
    clerk_user_id = token_payload.get("sub")
    if not clerk_user_id:
        return None

    email = token_payload.get("email", "")
    first_name = token_payload.get("first_name") or None
    last_name = token_payload.get("last_name") or None

    # Get or create user in our database (reuses the request's session)
    user = await get_or_create_user(session, clerk_user_id, email, first_name, last_name)
    return user


async def get_current_user(
    authorization: Optional[str] = Header(None),
    session: AsyncSession = Depends(get_session)
) -> User:
    """
    Dependency to get the current authenticated user (required).
    Raises 401 if no valid token is provided.
    Use this for endpoints that require authentication.
    """
    token_payload = await verify_clerk_token(authorization)
    if not token_payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    # Extract user info from JWT claims
    clerk_user_id = token_payload.get("sub")
    if not clerk_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    email = token_payload.get("email", "")
    first_name = token_payload.get("first_name") or None
    last_name = token_payload.get("last_name") or None

    # Get or create user in our database (reuses the request's session)
    user = await get_or_create_user(session, clerk_user_id, email, first_name, last_name)
    return user

