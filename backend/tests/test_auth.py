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
from sqlalchemy.exc import IntegrityError
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


# The unique-index violation asyncpg raises for the clerk_user_id race; the
# recovery path keys off the constraint name in the error text.
_CLERK_CONFLICT = 'duplicate key value violates unique constraint "ix_users_clerk_user_id"'


class _RaceSession:
    """Minimal AsyncSession stand-in for the first-request creation race.

    The initial SELECT misses (user not found), the INSERT commit raises the
    unique-constraint IntegrityError the concurrent winner triggered, and the
    retry SELECT returns the winner's row.
    """

    def __init__(self, winner, conflict=_CLERK_CONFLICT):
        self._winner = winner
        self._conflict = conflict
        self._selects = 0
        self.rolled_back = False

    async def exec(self, _stmt):
        self._selects += 1
        found = None if self._selects == 1 else self._winner
        return namedtuple("_Result", ["first"])(lambda: found)

    def add(self, _obj):
        pass

    async def commit(self):
        raise IntegrityError("insert", {}, Exception(self._conflict))

    async def rollback(self):
        self.rolled_back = True

    async def refresh(self, _obj):
        pass


class TestGetOrCreateUserRace:
    """A brand-new user's first page load fires several authenticated requests
    at once; only one can win the insert. The losers must recover, not 500.
    """

    @pytest.mark.asyncio
    async def test_recovers_from_concurrent_insert(self):
        winner = User(
            id=7, clerk_user_id="user_race", email="race@example.com"
        )
        session = _RaceSession(winner)

        result = await auth.get_or_create_user(
            session, "user_race", "race@example.com"
        )

        # Returns the winner's row instead of propagating the IntegrityError.
        assert result is winner
        assert session.rolled_back is True

    @pytest.mark.asyncio
    async def test_reraises_when_row_still_absent(self):
        # A clerk_user_id conflict but the retry SELECT is still empty — this
        # isn't the race we expected, so surface the error rather than swallow.
        session = _RaceSession(winner=None)
        with pytest.raises(IntegrityError):
            await auth.get_or_create_user(
                session, "user_ghost", "ghost@example.com"
            )
        assert session.rolled_back is True

    @pytest.mark.asyncio
    async def test_reraises_unrelated_integrity_error(self):
        # An integrity violation on some *other* constraint must not be masked
        # by re-fetching — even if a row with this clerk_user_id happens to
        # exist. The recovery is scoped to the clerk_user_id conflict only.
        winner = User(id=9, clerk_user_id="user_other", email="o@example.com")
        session = _RaceSession(
            winner,
            conflict='null value in column "email" violates not-null constraint',
        )
        with pytest.raises(IntegrityError):
            await auth.get_or_create_user(
                session, "user_other", "o@example.com"
            )


class TestGetOrCreateUserConcurrencyIntegration:
    """Real-Postgres coverage for the creation race, against the migrated test
    DB. Complements the fake-session unit tests above, which can't prove that a
    real async session is reusable after a failed commit + rollback, or that
    Postgres actually raises IntegrityError (not something else) on the unique
    index under genuine concurrency.
    """

    @pytest.mark.asyncio
    async def test_concurrent_first_requests_resolve_to_one_row(
        self, db_session, test_engine
    ):
        from sqlalchemy import func, select as sa_select
        from sqlalchemy.ext.asyncio import async_sessionmaker

        clerk_id = "user_concurrent_signup"
        factory = async_sessionmaker(
            test_engine, class_=AsyncSession, expire_on_commit=False
        )

        async def create_once():
            # Each concurrent request gets its own session, as separate HTTP
            # requests would. All await the SELECT first (and miss), so they
            # then race on the INSERT — exactly the first-load scenario.
            async with factory() as s:
                return await auth.get_or_create_user(
                    s, clerk_id, "concurrent@example.com"
                )

        results = await asyncio.gather(*(create_once() for _ in range(5)))

        # None raised, and all resolved to the same single row.
        ids = {u.id for u in results}
        assert len(ids) == 1, f"expected one shared user row, got ids={ids}"

        count = await db_session.scalar(
            sa_select(func.count())
            .select_from(User)
            .where(User.clerk_user_id == clerk_id)
        )
        assert count == 1
