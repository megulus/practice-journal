"""add idempotency_records

Stores the committed result of a mutation against a client-supplied
`Idempotency-Key`, so a retry of a request whose response was lost in flight
replays the original result instead of creating a duplicate (#290).

Revision ID: 0006_idempotency_records
Revises: 0005_block_log_tempo_bpm
Create Date: 2026-08-12 00:00:00.000000

"""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0006_idempotency_records"
down_revision: Union[str, None] = "0005_block_log_tempo_bpm"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.create_table(
        "idempotency_records",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("idempotency_key", sa.String(255), nullable=False),
        sa.Column("endpoint", sa.String(100), nullable=False),
        sa.Column("request_fingerprint", sa.String(64), nullable=False),
        sa.Column("response_status", sa.Integer, nullable=False),
        sa.Column("response_body", postgresql.JSONB, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        # Keys are per-user: a key from one account can never replay another's
        # result. This is also the lock a concurrent duplicate blocks on, and
        # its leading column serves every user-scoped lookup, so `user_id`
        # needs no index of its own.
        sa.UniqueConstraint(
            "user_id",
            "idempotency_key",
            name="uq_idempotency_records_user_key",
        ),
    )
    # For the eventual purge of expired keys (see the model docstring).
    op.create_index(
        "ix_idempotency_records_created_at", "idempotency_records", ["created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_idempotency_records_created_at", "idempotency_records")
    op.drop_table("idempotency_records")
