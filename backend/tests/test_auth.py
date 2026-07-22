"""Unit tests for Clerk JWT verification (app/auth.py).

These exercise the real signature/expiry/issuer checks by signing tokens with a
test RSA key and pointing verification at a fake JWKS that serves the matching
public key. The forged-signature case is the security-critical one — a token
signed by a key the JWKS does not serve must be rejected.
"""
import asyncio
import base64
import hashlib
import hmac
import json
import time
from collections import namedtuple

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession

from app import auth
from app.models import User

ISSUER = "https://clerk.test.example.com"

_Keys = namedtuple("_Keys", ["private_pem", "public_pem"])


def _rsa_keypair():
    """Return (private_pem, public_key_object, public_pem)."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    priv_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    pub = key.public_key()
    pub_pem = pub.public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return priv_pem, pub, pub_pem


def _unsigned_none_token(claims: dict) -> str:
    """Hand-build an ``alg: none`` token — PyJWT won't emit one, so we construct
    it directly to prove the RS256 allowlist rejects it."""
    def _b64(d):
        return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()

    return f"{_b64({'alg': 'none', 'typ': 'JWT'})}.{_b64(claims)}."


def _hs256_token(claims: dict, secret: bytes) -> str:
    """Hand-build an HS256 token HMAC'd with ``secret`` — PyJWT refuses to encode
    HS* with a PEM public key (its own confusion guard), so we build it directly
    to prove the RS256 allowlist is what rejects the classic RS/HS attack."""
    def _b64(b: bytes) -> bytes:
        return base64.urlsafe_b64encode(b).rstrip(b"=")

    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64(json.dumps(claims).encode())
    signing_input = header + b"." + payload
    sig = hmac.new(secret, signing_input, hashlib.sha256).digest()
    return (signing_input + b"." + _b64(sig)).decode()


class _FakeSigningKey:
    def __init__(self, key):
        self.key = key


class _FakeJWKSClient:
    """Stand-in for PyJWKClient that always serves one public key."""

    def __init__(self, public_key):
        self._public_key = public_key

    def get_signing_key_from_jwt(self, token):
        return _FakeSigningKey(self._public_key)


def _token(key, _alg="RS256", **overrides):
    now = int(time.time())
    claims = {
        "sub": "user_abc",
        "iss": ISSUER,
        "iat": now,
        "exp": now + 3600,
        "email": "a@b.com",
    }
    claims.update(overrides)
    # A claim set to None is treated as "omit this claim".
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, key, algorithm=_alg)


@pytest.fixture
def server_key(monkeypatch):
    """Point verification at a fake JWKS serving a fresh keypair; return the
    keypair (private + public PEM) so tests can mint tokens."""
    priv_pem, pub, pub_pem = _rsa_keypair()
    monkeypatch.setattr(
        auth, "_resolve_verification", lambda: ("https://x/.well-known/jwks.json", ISSUER)
    )
    monkeypatch.setattr(auth, "_get_jwks_client", lambda url: _FakeJWKSClient(pub))
    return _Keys(priv_pem, pub_pem)


class TestVerifyClerkToken:
    async def test_valid_token_returns_payload(self, server_key):
        token = _token(server_key.private_pem)
        payload = await auth.verify_clerk_token(f"Bearer {token}")
        assert payload["sub"] == "user_abc"
        assert payload["email"] == "a@b.com"

    async def test_forged_signature_rejected(self, server_key):
        # Signed by a rogue key the JWKS does not serve — the core attack.
        rogue_priv, _, _ = _rsa_keypair()
        with pytest.raises(HTTPException) as exc:
            await auth.verify_clerk_token(f"Bearer {_token(rogue_priv)}")
        assert exc.value.status_code == 401

    async def test_alg_none_rejected(self, server_key):
        # An unsigned "alg: none" token must not slip past the RS256 allowlist.
        now = int(time.time())
        token = _unsigned_none_token(
            {"sub": "user_abc", "iss": ISSUER, "iat": now, "exp": now + 3600}
        )
        with pytest.raises(HTTPException) as exc:
            await auth.verify_clerk_token(f"Bearer {token}")
        assert exc.value.status_code == 401

    async def test_hs256_key_confusion_rejected(self, server_key):
        # Classic RS/HS confusion: attacker signs HS256 using the server's
        # PUBLIC key as the HMAC secret. Rejected because only RS256 is allowed.
        now = int(time.time())
        token = _hs256_token(
            {"sub": "user_abc", "iss": ISSUER, "iat": now, "exp": now + 3600},
            server_key.public_pem,
        )
        with pytest.raises(HTTPException) as exc:
            await auth.verify_clerk_token(f"Bearer {token}")
        assert exc.value.status_code == 401

    async def test_expired_token_rejected(self, server_key):
        now = int(time.time())
        token = _token(server_key.private_pem, iat=now - 7200, exp=now - 3600)
        with pytest.raises(HTTPException) as exc:
            await auth.verify_clerk_token(f"Bearer {token}")
        assert exc.value.status_code == 401
        assert "expired" in exc.value.detail.lower()

    async def test_wrong_issuer_rejected(self, server_key):
        token = _token(server_key.private_pem, iss="https://evil.example.com")
        with pytest.raises(HTTPException) as exc:
            await auth.verify_clerk_token(f"Bearer {token}")
        assert exc.value.status_code == 401

    async def test_missing_sub_rejected(self, server_key):
        token = _token(server_key.private_pem, sub=None)
        with pytest.raises(HTTPException) as exc:
            await auth.verify_clerk_token(f"Bearer {token}")
        assert exc.value.status_code == 401

    async def test_no_authorization_returns_none(self):
        assert await auth.verify_clerk_token(None) is None

    async def test_non_bearer_scheme_returns_none(self):
        assert await auth.verify_clerk_token("Basic abc.def.ghi") is None

    async def test_unconfigured_raises_500(self, monkeypatch):
        monkeypatch.setattr(auth, "_resolve_verification", lambda: (None, None))
        with pytest.raises(HTTPException) as exc:
            await auth.verify_clerk_token("Bearer whatever")
        assert exc.value.status_code == 500


def _clerk_pk(prefix: str, host: str) -> str:
    """Build a publishable key the way Clerk does: base64 of ``<host>$`` with
    the padding stripped. Using hosts whose length forces padding is what makes
    these a regression guard for the unpadded-decode bug."""
    return prefix + base64.b64encode(f"{host}$".encode()).decode().rstrip("=")


class TestPublishableKeyDerivation:
    # These hosts encode to lengths that require base64 padding, so the
    # unpadded keys below only decode if the padding is restored first.
    def test_derives_host_from_test_key(self):
        host = "trusty-seagull-17.clerk.accounts.dev"
        assert auth._frontend_api_from_publishable_key(
            _clerk_pk("pk_test_", host)
        ) == host

    def test_derives_host_from_live_key(self):
        host = "moving-tiger-42.clerk.accounts.dev"
        assert auth._frontend_api_from_publishable_key(
            _clerk_pk("pk_live_", host)
        ) == host

    def test_returns_none_for_garbage(self):
        assert auth._frontend_api_from_publishable_key("not-a-key") is None
        assert auth._frontend_api_from_publishable_key("") is None

    def test_resolve_derives_jwks_and_issuer(self, monkeypatch):
        host = "trusty-seagull-17.clerk.accounts.dev"
        monkeypatch.setattr(
            auth.settings, "clerk_publishable_key", _clerk_pk("pk_test_", host)
        )
        monkeypatch.setattr(auth.settings, "clerk_jwks_url", "")
        monkeypatch.setattr(auth.settings, "clerk_issuer", "")
        jwks_url, issuer = auth._resolve_verification()
        assert jwks_url == f"https://{host}/.well-known/jwks.json"
        assert issuer == f"https://{host}"


async def _count_users(db_session, clerk_id: str) -> int:
    from sqlalchemy import func, select as sa_select

    return await db_session.scalar(
        sa_select(func.count())
        .select_from(User)
        .where(User.clerk_user_id == clerk_id)
    )


class TestGetOrCreateUser:
    """Behavior of get_or_create_user against the migrated test DB: create on
    first sight, a read-only fast path for unchanged repeat calls (it runs on
    every authenticated request), and profile-field updates from fresh claims.
    """

    @pytest.mark.asyncio
    async def test_creates_new_user(self, db_session):
        user = await auth.get_or_create_user(
            db_session, "user_new", "new@example.com", "Ada", "Byron"
        )
        assert user is not None
        assert user.id is not None
        assert user.email == "new@example.com"
        assert user.first_name == "Ada"
        # The Core-insert path stamps created_at explicitly (no ORM default runs).
        assert user.created_at is not None
        assert await _count_users(db_session, "user_new") == 1

    @pytest.mark.asyncio
    async def test_repeat_call_is_read_only(self, db_session):
        # get_or_create_user runs on every request; an unchanged repeat must not
        # write. updated_at stays None (its onupdate only fires on an UPDATE).
        first = await auth.get_or_create_user(
            db_session, "user_hot", "hot@example.com", "Grace", "Hopper"
        )
        assert first.updated_at is None

        again = await auth.get_or_create_user(
            db_session, "user_hot", "hot@example.com", "Grace", "Hopper"
        )
        assert again.id == first.id
        assert again.updated_at is None
        assert await _count_users(db_session, "user_hot") == 1

    @pytest.mark.asyncio
    async def test_updates_changed_fields(self, db_session):
        created = await auth.get_or_create_user(
            db_session, "user_upd", "old@example.com", "Old", None
        )
        assert created.updated_at is None

        updated = await auth.get_or_create_user(
            db_session, "user_upd", "new@example.com", "New", "Name"
        )
        assert updated.id == created.id
        assert updated.email == "new@example.com"
        assert updated.first_name == "New"
        assert updated.last_name == "Name"
        # The update path ran, so onupdate stamped updated_at.
        assert updated.updated_at is not None

    @pytest.mark.asyncio
    async def test_empty_claims_do_not_overwrite(self, db_session):
        created = await auth.get_or_create_user(
            db_session, "user_keep", "keep@example.com", "Keep", "Me"
        )

        # Empty email / missing names (as anonymous-ish claims might arrive)
        # must not blank out the stored profile.
        result = await auth.get_or_create_user(
            db_session, "user_keep", "", None, None
        )
        assert result.email == "keep@example.com"
        assert result.first_name == "Keep"
        assert result.last_name == "Me"


class TestGetOrCreateUserConcurrencyIntegration:
    """Real-Postgres coverage for the creation race against the migrated test
    DB — the payoff of the ON CONFLICT DO NOTHING upsert. Several concurrent
    first requests (each its own session, as separate HTTP requests would have)
    must all resolve to the same single row with no unhandled error.
    """

    @pytest.mark.asyncio
    async def test_concurrent_first_requests_resolve_to_one_row(
        self, db_session, test_engine
    ):
        from sqlalchemy.ext.asyncio import async_sessionmaker

        clerk_id = "user_concurrent_signup"
        factory = async_sessionmaker(
            test_engine, class_=AsyncSession, expire_on_commit=False
        )

        async def create_once():
            # Each runs on its own session; interleaving at await points means
            # they typically all miss the initial SELECT and then race on the
            # insert (the first-load scenario). Whatever the interleaving, they
            # must all resolve to one row with no raised error.
            async with factory() as s:
                return await auth.get_or_create_user(
                    s, clerk_id, "concurrent@example.com"
                )

        results = await asyncio.gather(*(create_once() for _ in range(5)))

        # None raised, and all resolved to the same single row.
        ids = {u.id for u in results}
        assert len(ids) == 1, f"expected one shared user row, got ids={ids}"
        assert await _count_users(db_session, clerk_id) == 1
