"""
Shared idempotency helpers for create endpoints (#290).

A `POST` that commits server-side but whose response never reaches the client
— dropped connection, timeout, backgrounded tab — leaves the client unable to
tell "it failed" from "it worked and I didn't hear". Retrying then creates a
second copy of everything. The fix is a client-supplied key:

    Idempotency-Key: 6f1c…            (header, one per attempt)

The endpoint stores its committed response against `(user_id, key)` in the
same transaction as the work. A retry carrying the same key finds that row and
**replays the original response verbatim** — same status, same body, same ids.
A replay is deliberately *not* a 409: the client can't act on "you already did
this" any differently than on "this failed", which is the whole problem.

Design notes, since this is the first endpoint in the API to do it:

- **Header, not a body field.** It's request metadata, not part of the
  resource, so it stays out of every request schema and any POST can opt in by
  taking the `idempotency_key` dependency. Matches the IETF draft / Stripe
  convention clients already know.
- **Scoped per user.** The unique constraint is `(user_id, idempotency_key)`,
  so a key can only ever replay its own account's result.
- **The same key with a different payload is a 409**, not a replay — that's a
  client bug (a key reused for a different operation), and answering it with
  the old result would be silently wrong. A retry sends an identical payload;
  changed answers mean a new attempt, which gets a new key.
- **The key is reserved first**, before any of the endpoint's own writes, so a
  concurrent duplicate blocks on *this* key rather than on whichever unrelated
  constraint it happens to reach first. The reservation lives in the request's
  transaction, so an attempt that fails rolls it back and the key stays usable
  — a rejected request doesn't burn its key.
- **Cleanup:** rows are small (one JSON response, a few KB) and written once
  per opted-in mutation, so at quick-start volume — roughly one per user, ever
  — growth is negligible and there's no expiry job yet. Keys are only useful
  for the minutes-long retry window, so when more (or higher-frequency)
  endpoints adopt this, add a periodic `DELETE FROM idempotency_records WHERE
  created_at < now() - interval '7 days'`; `created_at` is indexed for exactly
  that.

Usage in an endpoint::

    ENDPOINT = "POST /api/thing"

    @router.post("", response_model=ThingRead, status_code=201)
    async def create_thing(body, response: Response, ..., key=Depends(idempotency_key)):
        idem = await IdempotentRequest.open(
            session, user_id=current_user.id, endpoint=ENDPOINT, key=key, body=body
        )
        if idem.replay is not None:
            return idem.respond(response)

        ...build rows...
        payload = ThingRead(...)
        idem.store(payload, status_code=201)
        await session.commit()
        return payload
"""
import hashlib
import json
from typing import Any, Optional, Union

from fastapi import Header, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import IdempotencyRecord

IDEMPOTENCY_HEADER = "Idempotency-Key"
MAX_KEY_LENGTH = 255

#: Set on a replayed response so clients and logs can tell one apart.
REPLAY_HEADER = "Idempotent-Replay"


async def idempotency_key(
    idempotency_key: Optional[str] = Header(default=None, alias=IDEMPOTENCY_HEADER),
) -> Optional[str]:
    """FastAPI dependency: the request's validated `Idempotency-Key`.

    Optional — a request without one behaves exactly as it did before, which
    keeps the header additive for any client that doesn't send it.
    """
    if idempotency_key is None:
        return None
    key = idempotency_key.strip()
    if not key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{IDEMPOTENCY_HEADER} cannot be blank",
        )
    if len(key) > MAX_KEY_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{IDEMPOTENCY_HEADER} cannot exceed {MAX_KEY_LENGTH} characters",
        )
    return key


def fingerprint_request(body: Union[BaseModel, dict]) -> str:
    """SHA-256 of the request body in canonical form.

    Taken from the *validated* model, so normalization the schema already does
    (trimming, blank → null) can't make an identical retry look different.
    """
    payload = body.model_dump(mode="json") if isinstance(body, BaseModel) else body
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _as_json(body: Union[BaseModel, dict]) -> dict[str, Any]:
    return body.model_dump(mode="json") if isinstance(body, BaseModel) else body


class IdempotentRequest:
    """Idempotency state for a single request.

    `open()` either finds the stored response of an earlier identical request
    — replay it and do nothing else — or reserves the key so this request can
    proceed. `store()` then fills the reservation with the response, which
    commits alongside the work: the stored result can't exist without the rows
    it describes, and those rows can't exist without a way to replay them.

    With no key, every method is a no-op and the endpoint behaves as before.
    """

    def __init__(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        endpoint: str,
        key: Optional[str],
        fingerprint: Optional[str],
    ):
        self._session = session
        self._user_id = user_id
        self._endpoint = endpoint
        self._key = key
        self._fingerprint = fingerprint
        self._reservation: Optional[IdempotencyRecord] = None
        #: The earlier response to replay, or None if this request is new.
        self.replay: Optional[IdempotencyRecord] = None

    @classmethod
    async def open(
        cls,
        session: AsyncSession,
        *,
        user_id: int,
        endpoint: str,
        key: Optional[str],
        body: Union[BaseModel, dict],
    ) -> "IdempotentRequest":
        """Claim `key` for this request, or find the response to replay.

        Call before the endpoint writes anything.
        """
        idem = cls(
            session,
            user_id=user_id,
            endpoint=endpoint,
            key=key,
            fingerprint=fingerprint_request(body) if key else None,
        )
        if key is None:
            return idem

        existing = await idem._find()
        if existing is not None:
            idem._matches(existing)
            idem.replay = existing
            return idem

        # Placeholder values: the row is only ever committed via store(), and
        # a request that never gets there rolls the reservation back with it.
        reservation = IdempotencyRecord(
            user_id=user_id,
            idempotency_key=key,
            endpoint=endpoint,
            request_fingerprint=idem._fingerprint,
            response_status=0,
            response_body={},
        )
        session.add(reservation)
        try:
            await session.flush()
        except IntegrityError:
            # An identical request was already in flight and won the race; its
            # commit released the lock this insert was waiting on.
            await session.rollback()
            winner = await idem._find()
            if winner is None:
                raise
            idem._matches(winner)
            idem.replay = winner
            return idem

        idem._reservation = reservation
        return idem

    def store(self, body: Union[BaseModel, dict], *, status_code: int) -> None:
        """Attach the response to the reservation, to commit with the work."""
        if self._reservation is None:
            return
        self._reservation.response_status = status_code
        self._reservation.response_body = _as_json(body)
        self._session.add(self._reservation)

    def respond(self, response: Response) -> dict[str, Any]:
        """Return the stored response, with the original status code."""
        assert self.replay is not None, "respond() is only valid for a replay"
        response.status_code = self.replay.response_status
        response.headers[REPLAY_HEADER] = "true"
        return self.replay.response_body

    # -- internals --------------------------------------------------------

    async def _find(self) -> Optional[IdempotencyRecord]:
        result = await self._session.exec(
            select(IdempotencyRecord).where(
                IdempotencyRecord.user_id == self._user_id,
                IdempotencyRecord.idempotency_key == self._key,
            )
        )
        return result.first()

    def _matches(self, record: IdempotencyRecord) -> None:
        """Reject a key reused for a different request (see module docstring)."""
        if (
            record.endpoint != self._endpoint
            or record.request_fingerprint != self._fingerprint
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"{IDEMPOTENCY_HEADER} was already used for a different "
                    "request. Use a new key for a new request."
                ),
            )
