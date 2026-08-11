"""
Authentication utilities for Clerk JWT validation
"""
import base64
import binascii
import logging
from functools import lru_cache
from typing import Optional

import jwt
from jwt import PyJWKClient, PyJWKClientError
from fastapi import Depends, Header, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import get_settings
from app.enums import utcnow
from app.models import User
from app.database import get_session

logger = logging.getLogger(__name__)

settings = get_settings()


@lru_cache(maxsize=1)
def _warn_issuer_verification_disabled() -> None:
    """Warn once: signatures are still verified, but the extra issuer check is
    off because a JWKS URL is configured without a resolvable issuer."""
    logger.warning(
        "Clerk JWT issuer verification is DISABLED — a JWKS URL is set but no "
        "issuer could be resolved. Signatures are still verified. Set "
        "CLERK_ISSUER (or CLERK_PUBLISHABLE_KEY) to re-enable the issuer check."
    )


def _frontend_api_from_publishable_key(pk: str) -> Optional[str]:
    """Clerk publishable keys encode the Frontend API host: the part after the
    ``pk_test_`` / ``pk_live_`` prefix is base64 of ``<host>$``. Return the host
    (e.g. ``clerk.example.com``) or None if the key isn't in that shape.
    """
    for prefix in ("pk_test_", "pk_live_"):
        if pk.startswith(prefix):
            encoded = pk[len(prefix):]
            # Clerk keys are base64 WITHOUT padding; restore it so b64decode
            # (which requires a length that's a multiple of 4) accepts them.
            encoded += "=" * (-len(encoded) % 4)
            try:
                decoded = base64.b64decode(encoded).decode("utf-8")
            except (binascii.Error, UnicodeDecodeError, ValueError):
                return None
            host = decoded.rstrip("$")
            return host or None
    return None


def _resolve_verification() -> tuple[Optional[str], Optional[str]]:
    """Resolve (jwks_url, issuer) for verification, preferring explicit config
    and falling back to derivation from the publishable key. Both come from
    server configuration — never from the token itself.
    """
    host = _frontend_api_from_publishable_key(settings.clerk_publishable_key)
    jwks_url = settings.clerk_jwks_url or (
        f"https://{host}/.well-known/jwks.json" if host else None
    )
    issuer = settings.clerk_issuer or (f"https://{host}" if host else None)
    return jwks_url, issuer


@lru_cache(maxsize=4)
def _get_jwks_client(jwks_url: str) -> PyJWKClient:
    """Cache one PyJWKClient per JWKS URL. The client caches the fetched key set
    (default lifespan 300s), so signature checks don't hit the network per call.
    """
    return PyJWKClient(jwks_url)


async def verify_clerk_token(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """
    Verify a Clerk JWT from the Authorization header.

    Validates the RS256 signature against Clerk's JWKS (public keys), plus
    expiry and issuer. Returns the decoded payload, or None if no token was
    provided. Raises 401 for any invalid/forged/expired token.
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

    jwks_url, issuer = _resolve_verification()
    if not jwks_url:
        # Can't verify anything without a key source — fail closed.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication is not configured",
        )
    if issuer is None:
        # Signature is still verified below; only the issuer check is off.
        _warn_issuer_verification_disabled()

    try:
        client = _get_jwks_client(jwks_url)
        # PyJWKClient does a (cached) blocking HTTP fetch; keep it off the loop.
        signing_key = await run_in_threadpool(
            client.get_signing_key_from_jwt, token
        )
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=issuer,
            # Clerk session tokens are short-lived; tolerate minor clock skew
            # between this server and Clerk so valid tokens aren't rejected.
            leeway=10,
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_iss": issuer is not None,
                "verify_aud": False,  # Clerk session tokens carry no aud
                "require": ["exp", "iat", "sub"],
            },
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except (jwt.InvalidTokenError, PyJWKClientError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
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

    # Create the user with an atomic upsert. A brand-new user's first page load
    # fires several authenticated requests at once, all reaching this branch
    # together; a plain INSERT would let one win and the others hit the unique
    # clerk_user_id constraint, raising a 500 that escapes before CORS headers
    # attach (an opaque "failed to fetch" on the client). INSERT ... ON CONFLICT
    # DO NOTHING resolves the collision in a single statement — the losers no-op
    # instead of erroring — so no request fails. We then read the row back
    # (whichever request actually inserted it) to return a session-managed
    # instance. created_at is passed explicitly to keep the app's naive-UTC
    # clock (utcnow()) visible at the call site rather than the column's
    # tz-aware now() server_default. It isn't strictly required: the model's
    # default_factory becomes a column-level default that Core applies to this
    # statement on its own, so the emitted SQL names created_at either way.
    stmt = (
        pg_insert(User)
        .values(
            clerk_user_id=clerk_user_id,
            email=email,
            first_name=first_name,
            last_name=last_name,
            created_at=utcnow(),
        )
        .on_conflict_do_nothing(index_elements=["clerk_user_id"])
    )
    await session.exec(stmt)
    await session.commit()

    result = await session.exec(
        select(User).where(User.clerk_user_id == clerk_user_id)
    )
    user = result.first()
    if user is None:
        # The row we just upserted must exist; a miss means something is deeply
        # wrong (not the benign race). Fail loudly rather than return None into
        # a non-optional contract the caller would dereference.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load user after creation",
        )
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

