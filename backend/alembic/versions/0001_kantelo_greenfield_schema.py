"""Kantelo greenfield schema

Revision ID: 0001_kantelo
Revises:
Create Date: 2026-03-24

Drop all old Practice Journal tables and create the Kantelo schema from scratch.
See docs/kantelo-schema-api.md for the full specification.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0001_kantelo"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Old tables to drop (in dependency order — children first)
OLD_TABLES = [
    "suggestion_interactions",
    "exercise_progress",
    "practice_log_details",
    "practice_logs",
    "exercises",
    "exercise_blocks",
    "practice_days",
    "practice_templates",
    "block_types",
    "user_instrument",
    "user_settings",
    "instruments",
    "users",
]


def upgrade() -> None:
    # --- Drop old tables (if they exist) ---
    for table in OLD_TABLES:
        op.execute(
            sa.text(f"DROP TABLE IF EXISTS {table} CASCADE")
        )

    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("clerk_user_id", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("first_name", sa.String(255), nullable=True),
        sa.Column("last_name", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime, nullable=True),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_users_clerk_user_id", "users", ["clerk_user_id"], unique=True)

    # --- user_settings ---
    op.create_table(
        "user_settings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "suggestions_preference",
            sa.String(20),
            nullable=False,
            server_default="all",
        ),
        sa.Column(
            "default_session_duration_minutes",
            sa.Integer,
            nullable=False,
            server_default="30",
        ),
        sa.Column(
            "week_starts_on",
            sa.String(10),
            nullable=False,
            server_default="monday",
        ),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )
    op.create_index(
        "ix_user_settings_user_id", "user_settings", ["user_id"], unique=True
    )

    # --- instruments ---
    op.create_table(
        "instruments",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column(
            "practice_frequency",
            sa.String(30),
            nullable=False,
            server_default="few_times_a_week",
        ),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime, nullable=True),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_instruments_user_id", "instruments", ["user_id"])

    # --- templates ---
    op.create_table(
        "templates",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "instrument_id",
            sa.Integer,
            sa.ForeignKey("instruments.id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "current_rotation_index",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime, nullable=True),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_templates_user_id", "templates", ["user_id"])
    op.create_index("ix_templates_instrument_id", "templates", ["instrument_id"])
    # One active template per instrument
    op.create_index(
        "ix_templates_one_active_per_instrument",
        "templates",
        ["instrument_id"],
        unique=True,
        postgresql_where=sa.text("is_active = true AND deleted_at IS NULL"),
    )

    # --- template_sessions ---
    op.create_table(
        "template_sessions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "template_id",
            sa.Integer,
            sa.ForeignKey("templates.id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("focus_description", sa.Text, nullable=True),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )
    op.create_index(
        "ix_template_sessions_template_id", "template_sessions", ["template_id"]
    )
    op.create_index(
        "uq_template_sessions_template_order",
        "template_sessions",
        ["template_id", "display_order"],
        unique=True,
    )

    # --- sections ---
    op.create_table(
        "sections",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "template_session_id",
            sa.Integer,
            sa.ForeignKey("template_sessions.id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("section_type", sa.String(30), nullable=False),
        sa.Column(
            "estimated_duration_minutes",
            sa.Integer,
            nullable=False,
            server_default="5",
        ),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )
    op.create_index(
        "ix_sections_template_session_id", "sections", ["template_session_id"]
    )

    # --- curated_blocks ---
    op.create_table(
        "curated_blocks",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("instrument_category", sa.String(100), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("section_type", sa.String(30), nullable=False),
        sa.Column(
            "default_duration_minutes",
            sa.Integer,
            nullable=False,
            server_default="5",
        ),
        sa.Column("usage_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_curated_blocks_instrument_category",
        "curated_blocks",
        ["instrument_category"],
    )
    op.create_index(
        "ix_curated_blocks_category_section",
        "curated_blocks",
        ["instrument_category", "section_type"],
    )

    # --- blocks ---
    op.create_table(
        "blocks",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "section_id",
            sa.Integer,
            sa.ForeignKey("sections.id"),
            nullable=False,
        ),
        sa.Column(
            "curated_block_id",
            sa.Integer,
            sa.ForeignKey("curated_blocks.id"),
            nullable=True,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("estimated_duration_minutes", sa.Integer, nullable=True),
        sa.Column("tempo_bpm", sa.Integer, nullable=True),
        sa.Column("key", sa.String(50), nullable=True),
        sa.Column("difficulty_level", sa.Integer, nullable=True),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_blocks_section_id", "blocks", ["section_id"])

    # --- practice_logs ---
    op.create_table(
        "practice_logs",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "instrument_id",
            sa.Integer,
            sa.ForeignKey("instruments.id"),
            nullable=False,
        ),
        sa.Column(
            "template_id",
            sa.Integer,
            sa.ForeignKey("templates.id"),
            nullable=True,
        ),
        sa.Column(
            "template_session_id",
            sa.Integer,
            sa.ForeignKey("template_sessions.id"),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="in_progress",
        ),
        sa.Column("practice_date", sa.Date, nullable=False),
        sa.Column(
            "total_duration_minutes",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("reflection_prompt", sa.Text, nullable=True),
        sa.Column("reflection_response", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime, nullable=True),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_practice_logs_user_id", "practice_logs", ["user_id"])
    op.create_index(
        "ix_practice_logs_instrument_id", "practice_logs", ["instrument_id"]
    )
    op.create_index(
        "ix_practice_logs_user_instrument_date",
        "practice_logs",
        ["user_id", "instrument_id", "practice_date"],
    )
    op.create_index(
        "ix_practice_logs_user_date",
        "practice_logs",
        ["user_id", "practice_date"],
    )
    op.create_index(
        "ix_practice_logs_user_status",
        "practice_logs",
        ["user_id", "status"],
    )

    # --- section_logs ---
    op.create_table(
        "section_logs",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "practice_log_id",
            sa.Integer,
            sa.ForeignKey("practice_logs.id"),
            nullable=False,
        ),
        sa.Column(
            "section_id",
            sa.Integer,
            sa.ForeignKey("sections.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("section_type", sa.String(30), nullable=False),
        sa.Column("section_name", sa.String(100), nullable=False),
        sa.Column("planned_duration_minutes", sa.Integer, nullable=True),
        sa.Column(
            "actual_duration_minutes",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("completed", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_section_logs_practice_log_id", "section_logs", ["practice_log_id"]
    )

    # --- block_logs ---
    op.create_table(
        "block_logs",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "section_log_id",
            sa.Integer,
            sa.ForeignKey("section_logs.id"),
            nullable=False,
        ),
        sa.Column(
            "block_id",
            sa.Integer,
            sa.ForeignKey("blocks.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("block_name", sa.String(200), nullable=False),
        sa.Column("rating", sa.SmallInteger, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("completed", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_block_logs_section_log_id", "block_logs", ["section_log_id"]
    )

    # --- suggestion_dismissals ---
    op.create_table(
        "suggestion_dismissals",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "instrument_id",
            sa.Integer,
            sa.ForeignKey("instruments.id"),
            nullable=True,
        ),
        sa.Column("suggestion_rule_id", sa.String(100), nullable=False),
        sa.Column("suggestion_tier", sa.String(30), nullable=False),
        sa.Column(
            "dismissed_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "user_id",
            "instrument_id",
            "suggestion_rule_id",
            name="uq_suggestion_dismissals_user_instrument_rule",
        ),
    )

    # --- suggestion_interactions ---
    op.create_table(
        "suggestion_interactions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "instrument_id",
            sa.Integer,
            sa.ForeignKey("instruments.id"),
            nullable=True,
        ),
        sa.Column("suggestion_rule_id", sa.String(100), nullable=False),
        sa.Column("suggestion_tier", sa.String(30), nullable=False),
        sa.Column("suggestion_text", sa.Text, nullable=False),
        sa.Column("interaction_type", sa.String(20), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_suggestion_interactions_user_id",
        "suggestion_interactions",
        ["user_id"],
    )
    op.create_index(
        "ix_suggestion_interactions_created_at",
        "suggestion_interactions",
        ["created_at"],
    )


def downgrade() -> None:
    # Drop new tables in reverse dependency order
    new_tables = [
        "suggestion_interactions",
        "suggestion_dismissals",
        "block_logs",
        "section_logs",
        "practice_logs",
        "blocks",
        "curated_blocks",
        "sections",
        "template_sessions",
        "templates",
        "instruments",
        "user_settings",
        "users",
    ]
    for table in new_tables:
        op.drop_table(table)
