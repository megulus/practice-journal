"""add_duration_to_log_details

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-02-11 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f5a6b7c8d9e0'
down_revision = 'e4f5a6b7c8d9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('practice_log_details', sa.Column('duration_minutes', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('practice_log_details', 'duration_minutes')
