"""Unit tests for Clerk JWT verification (app/auth.py).

These exercise the real signature/expiry/issuer checks by signing tokens with a
test RSA key and pointing verification at a fake JWKS that serves the matching
public key. The forged-signature case is the security-critical one — a token
signed by a key the JWKS does not serve must be rejected.
"""
import base64
import time

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from app import auth

ISSUER = "https://clerk.test.example.com"


def _rsa_keypair():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    priv_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    return priv_pem, key.public_key()


class _FakeSigningKey:
    def __init__(self, key):
        self.key = key


class _FakeJWKSClient:
    """Stand-in for PyJWKClient that always serves one public key."""

    def __init__(self, public_key):
        self._public_key = public_key

    def get_signing_key_from_jwt(self, token):
        return _FakeSigningKey(self._public_key)


def _token(priv_pem, **overrides):
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
    return jwt.encode(claims, priv_pem, algorithm="RS256")


@pytest.fixture
def server_key(monkeypatch):
    """Point verification at a fake JWKS serving a fresh keypair; return the
    matching private key so tests can mint valid tokens."""
    priv_pem, pub = _rsa_keypair()
    monkeypatch.setattr(
        auth, "_resolve_verification", lambda: ("https://x/.well-known/jwks.json", ISSUER)
    )
    monkeypatch.setattr(auth, "_get_jwks_client", lambda url: _FakeJWKSClient(pub))
    return priv_pem


class TestVerifyClerkToken:
    async def test_valid_token_returns_payload(self, server_key):
        payload = await auth.verify_clerk_token(f"Bearer {_token(server_key)}")
        assert payload["sub"] == "user_abc"
        assert payload["email"] == "a@b.com"

    async def test_forged_signature_rejected(self, server_key):
        # Signed by a rogue key the JWKS does not serve — the core attack.
        rogue_priv, _ = _rsa_keypair()
        with pytest.raises(HTTPException) as exc:
            await auth.verify_clerk_token(f"Bearer {_token(rogue_priv)}")
        assert exc.value.status_code == 401

    async def test_expired_token_rejected(self, server_key):
        now = int(time.time())
        token = _token(server_key, iat=now - 7200, exp=now - 3600)
        with pytest.raises(HTTPException) as exc:
            await auth.verify_clerk_token(f"Bearer {token}")
        assert exc.value.status_code == 401
        assert "expired" in exc.value.detail.lower()

    async def test_wrong_issuer_rejected(self, server_key):
        token = _token(server_key, iss="https://evil.example.com")
        with pytest.raises(HTTPException) as exc:
            await auth.verify_clerk_token(f"Bearer {token}")
        assert exc.value.status_code == 401

    async def test_missing_sub_rejected(self, server_key):
        with pytest.raises(HTTPException) as exc:
            await auth.verify_clerk_token(f"Bearer {_token(server_key, sub=None)}")
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


class TestPublishableKeyDerivation:
    def test_derives_host_from_test_key(self):
        host = "clerk.example.com"
        pk = "pk_test_" + base64.b64encode(f"{host}$".encode()).decode()
        assert auth._frontend_api_from_publishable_key(pk) == host

    def test_derives_host_from_live_key(self):
        host = "moving-tiger-42.clerk.accounts.dev"
        pk = "pk_live_" + base64.b64encode(f"{host}$".encode()).decode()
        assert auth._frontend_api_from_publishable_key(pk) == host

    def test_returns_none_for_garbage(self):
        assert auth._frontend_api_from_publishable_key("not-a-key") is None
        assert auth._frontend_api_from_publishable_key("") is None

    def test_resolve_derives_jwks_and_issuer(self, monkeypatch):
        host = "clerk.example.com"
        pk = "pk_test_" + base64.b64encode(f"{host}$".encode()).decode()
        monkeypatch.setattr(auth.settings, "clerk_publishable_key", pk)
        monkeypatch.setattr(auth.settings, "clerk_jwks_url", "")
        monkeypatch.setattr(auth.settings, "clerk_issuer", "")
        jwks_url, issuer = auth._resolve_verification()
        assert jwks_url == "https://clerk.example.com/.well-known/jwks.json"
        assert issuer == "https://clerk.example.com"
