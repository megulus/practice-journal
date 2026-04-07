"""Add pieces, spots, and template_block_spots tables for the repertoire model.

Revision ID: 0002_repertoire
Revises: 0001_kantelo
Create Date: 2026-04-07

Adds the repertoire model: pieces (per-instrument), spots (sub-units of pieces),
template_block_spots (join table for default spot lists on repertoire blocks),
piece_id on blocks, and spot_id on block_logs.

See docs/kantelo-schema-api.md §3 for the full specification.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0002_repertoire"
down_revision: Union[str, None] = "0001_kantelo"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- pieces ---
    op.create_table(
        "pieces",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "instrument_id",
            sa.Integer,
            sa.ForeignKey("instruments.id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("composer_or_source", sa.String(200), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_pieces_instrument_deleted", "pieces", ["instrument_id", "deleted_at"]
    )

    # --- spots ---
    op.create_table(
        "spots",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "piece_id",
            sa.Integer,
            sa.ForeignKey("pieces.id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("location", sa.String(300), nullable=True),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("retired_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_spots_piece_id", "spots", ["piece_id"])
    op.create_index(
        "ix_spots_piece_deleted_retired",
        "spots",
        ["piece_id", "deleted_at", "retired_at"],
    )
    op.create_index(
        "ix_spots_piece_retired", "spots", ["piece_id", "retired_at"]
    )

    # --- template_block_spots ---
    op.create_table(
        "template_block_spots",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "block_id",
            sa.Integer,
            sa.ForeignKey("blocks.id"),
            nullable=False,
        ),
        sa.Column(
            "spot_id",
            sa.Integer,
            sa.ForeignKey("spots.id"),
            nullable=False,
        ),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("block_id", "spot_id", name="uq_block_spot"),
    )
    op.create_index(
        "ix_template_block_spots_block_id", "template_block_spots", ["block_id"]
    )
    op.create_index(
        "ix_template_block_spots_spot_id", "template_block_spots", ["spot_id"]
    )

    # --- Add piece_id to blocks ---
    op.add_column(
        "blocks",
        sa.Column(
            "piece_id",
            sa.Integer,
            sa.ForeignKey("pieces.id"),
            nullable=True,
        ),
    )
    # Make name nullable (repertoire blocks inherit name from piece)
    op.alter_column("blocks", "name", existing_type=sa.String(200), nullable=True)
    # Check constraint: a block cannot be both a curated block and a repertoire block
    op.create_check_constraint(
        "ck_blocks_piece_or_curated",
        "blocks",
        "(piece_id IS NULL) OR (curated_block_id IS NULL)",
    )

    # --- Add spot_id to block_logs ---
    # ON DELETE SET NULL: deliberately NOT CASCADE — historical logs must
    # survive spot deletion. block_name is denormalized for this reason.
    op.add_column(
        "block_logs",
        sa.Column(
            "spot_id",
            sa.Integer,
            sa.ForeignKey("spots.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_block_logs_spot_created", "block_logs", ["spot_id", "created_at"]
    )
    # Widen block_name to 300 chars to accommodate "{piece} — {spot}" names
    op.alter_column(
        "block_logs",
        "block_name",
        existing_type=sa.String(200),
        type_=sa.String(300),
        existing_nullable=False,
    )


def downgrade() -> None:
    # Reverse block_logs changes
    op.alter_column(
        "block_logs",
        "block_name",
        existing_type=sa.String(300),
        type_=sa.String(200),
        existing_nullable=False,
    )
    op.drop_index("ix_block_logs_spot_created", table_name="block_logs")
    op.drop_column("block_logs", "spot_id")

    # Reverse blocks changes
    op.drop_constraint("ck_blocks_piece_or_curated", "blocks", type_="check")
    op.alter_column("blocks", "name", existing_type=sa.String(200), nullable=False)
    op.drop_column("blocks", "piece_id")

    # Drop new tables (children first)
    op.drop_table("template_block_spots")
    op.drop_table("spots")
    op.drop_table("pieces")
