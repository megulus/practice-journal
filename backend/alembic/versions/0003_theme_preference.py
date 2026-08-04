"""add theme_preference to user_settings

Revision ID: 0003_theme_preference
Revises: ebc61c3d1752
Create Date: 2026-08-01

Adds the light/dark theme preference (ThemePreference enum: system | light |
dark) so the frontend ThemeProvider can sync the choice across devices.
Existing rows are backfilled with 'system' via the server default.

See docs/kantelo-schema-api.md §3 (user_settings).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0003_theme_preference"
down_revision: Union[str, None] = "ebc61c3d1752"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column(
            "theme_preference",
            sa.String(10),
            nullable=False,
            server_default="system",
        ),
    )


def downgrade() -> None:
    op.drop_column("user_settings", "theme_preference")
