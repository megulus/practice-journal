"""Tests for the shared idempotency helper (app/api/idempotency.py).

The endpoint-level behaviour lives in `test_quickstart_api.py`; these cover
the guards that exist for the *next* endpoint to adopt this.
"""
import pytest
from fastapi import Response
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.idempotency import REPLAY_HEADER, IdempotentRequest, fingerprint_request
from app.models import IdempotencyRecord

ENDPOINT = "POST /api/thing"


class TestReplayHeaderIsReadableCrossOrigin:
    async def test_cors_exposes_the_replay_header(self, client: AsyncClient):
        """It's part of the documented contract, so browser JS must see it.

        A response header is invisible to cross-origin JS unless the server
        names it in `Access-Control-Expose-Headers`.
        """
        from app.main import _cors_origins

        resp = await client.get("/health", headers={"Origin": _cors_origins[0]})
        exposed = resp.headers["access-control-expose-headers"].lower()
        assert REPLAY_HEADER.lower() in exposed


class TestFingerprint:
    def test_key_order_does_not_change_the_fingerprint(self):
        assert fingerprint_request({"a": 1, "b": 2}) == fingerprint_request(
            {"b": 2, "a": 1}
        )

    def test_a_different_payload_fingerprints_differently(self):
        assert fingerprint_request({"a": 1}) != fingerprint_request({"a": 2})


class TestReservationGuards:
    """A reservation must never reach the database unfilled: it would replay a
    status-0 non-response to every later retry and burn the key for good."""

    async def test_commit_refuses_a_reservation_store_never_filled(
        self, db_session: AsyncSession, test_user
    ):
        idem = await IdempotentRequest.open(
            db_session,
            user_id=test_user.id,
            endpoint=ENDPOINT,
            key="unfilled-key",
            body={"a": 1},
        )

        with pytest.raises(RuntimeError, match="store\\(\\) must be called"):
            await idem.commit()

        await db_session.rollback()
        result = await db_session.exec(select(IdempotencyRecord))
        assert result.all() == []

    async def test_commit_writes_the_reservation_once_stored(
        self, db_session: AsyncSession, test_user
    ):
        idem = await IdempotentRequest.open(
            db_session,
            user_id=test_user.id,
            endpoint=ENDPOINT,
            key="filled-key",
            body={"a": 1},
        )
        idem.store({"thing": "made"}, status_code=201)
        await idem.commit()

        result = await db_session.exec(select(IdempotencyRecord))
        record = result.one()
        assert record.response_status == 201
        assert record.response_body == {"thing": "made"}

    async def test_a_keyless_request_commits_as_before(
        self, db_session: AsyncSession, test_user
    ):
        idem = await IdempotentRequest.open(
            db_session,
            user_id=test_user.id,
            endpoint=ENDPOINT,
            key=None,
            body={"a": 1},
        )
        idem.store({"thing": "made"}, status_code=201)
        await idem.commit()

        result = await db_session.exec(select(IdempotencyRecord))
        assert result.all() == []

    async def test_replaying_an_unfilled_record_is_loud(
        self, db_session: AsyncSession, test_user
    ):
        # Only reachable if an endpoint committed without store() — make sure
        # it surfaces as an error rather than a response with status 0.
        db_session.add(
            IdempotencyRecord(
                user_id=test_user.id,
                idempotency_key="poisoned-key",
                endpoint=ENDPOINT,
                request_fingerprint=fingerprint_request({"a": 1}),
                response_status=0,
                response_body={},
            )
        )
        await db_session.commit()

        idem = await IdempotentRequest.open(
            db_session,
            user_id=test_user.id,
            endpoint=ENDPOINT,
            key="poisoned-key",
            body={"a": 1},
        )
        assert idem.replay is not None
        with pytest.raises(RuntimeError, match="never completed"):
            idem.respond(Response())
