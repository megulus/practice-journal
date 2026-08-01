"""add instrument_category to instruments

Canonical category ("violin") used to look up curated blocks, derived from the
user-editable instrument name. See app/services/instrument_category.py.

Revision ID: 0003_instrument_category
Revises: ebc61c3d1752
Create Date: 2026-08-01 17:05:00.000000

"""
from typing import Union

from alembic import op
import sqlalchemy as sa

from app.services.instrument_category import derive_instrument_category

# revision identifiers, used by Alembic.
revision: str = "0003_instrument_category"
down_revision: Union[str, None] = "ebc61c3d1752"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add nullable first, backfill, then tighten to NOT NULL.
    op.add_column(
        "instruments",
        sa.Column("instrument_category", sa.String(100), nullable=True),
    )

    # Backfill with the same derivation the app uses, so existing rows behave
    # identically to newly created ones.
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, name FROM instruments")).fetchall()
    for row in rows:
        conn.execute(
            sa.text(
                "UPDATE instruments SET instrument_category = :category "
                "WHERE id = :id"
            ),
            {"category": derive_instrument_category(row.name), "id": row.id},
        )

    op.alter_column("instruments", "instrument_category", nullable=False)
    op.create_index(
        "ix_instruments_instrument_category",
        "instruments",
        ["instrument_category"],
    )


def downgrade() -> None:
    op.drop_index("ix_instruments_instrument_category", table_name="instruments")
    op.drop_column("instruments", "instrument_category")
