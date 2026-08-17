"""
IdempotencyRecord — the stored result of a mutation, keyed by client key.

Lets a client safely retry a POST whose response it never saw (dropped
connection, timeout, backgrounded tab): the retry carries the same
`Idempotency-Key`, the endpoint finds this row, and replays the original
response instead of creating a second set of rows. See #290 and
`docs/kantelo-schema-api.md` §4 "Idempotent creates".

Generic on purpose — `endpoint` and the stored `response_body` mean any POST
can opt in without its own table.
"""
from datetime import datetime
from typing import Any, Optional

import sqlalchemy as sa
from sqlalchemy import UniqueConstraint
from sqlalchemy.dialects import postgresql
from sqlmodel import Field, SQLModel

from app.enums import utcnow


class IdempotencyRecord(SQLModel, table=True):
    """One committed mutation, replayable by its (user, key) pair."""

    __tablename__ = "idempotency_records"
    __table_args__ = (
        # Scoped to the user so one client's key can never read another's
        # result — and so a key only has to be unique within an account.
        UniqueConstraint(
            "user_id",
            "idempotency_key",
            name="uq_idempotency_records_user_key",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    # No index of its own: it leads the unique constraint above, which serves
    # every lookup this table has.
    user_id: int = Field(foreign_key="users.id")
    idempotency_key: str = Field(max_length=255)
    # Which operation the key was spent on, e.g. "POST /api/quickstart".
    endpoint: str = Field(max_length=100)
    # SHA-256 of the canonical request body: the same key with a different
    # payload is a client bug, not a retry, and is rejected rather than
    # answered with someone else's result.
    request_fingerprint: str = Field(max_length=64)
    response_status: int
    response_body: dict[str, Any] = Field(
        sa_column=sa.Column(postgresql.JSONB, nullable=False)
    )
    # Indexed so a future purge of old keys is a cheap range scan.
    created_at: datetime = Field(default_factory=utcnow, index=True)
