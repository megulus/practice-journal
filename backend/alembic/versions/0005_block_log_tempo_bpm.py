"""add tempo_bpm to block_logs

Per-session logged tempo for a block. Set when the user confirms or adjusts
the smart tempo default on an active-session block row (#181); feeds the next
session's `last_tempo_bpm`.

Revision ID: 0005_block_log_tempo_bpm
Revises: 0004_instrument_category
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0005_block_log_tempo_bpm"
down_revision: Union[str, None] = "0004_instrument_category"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column(
        "block_logs",
        sa.Column("tempo_bpm", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("block_logs", "tempo_bpm")
