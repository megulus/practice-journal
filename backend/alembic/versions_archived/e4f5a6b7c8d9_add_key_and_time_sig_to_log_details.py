"""add_key_and_time_sig_to_log_details

Revision ID: e4f5a6b7c8d9
Revises: a3b4c5d6e7f8
Create Date: 2026-02-11 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e4f5a6b7c8d9'
down_revision = 'a3b4c5d6e7f8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('practice_log_details', sa.Column('key_practiced', sa.String(length=20), nullable=True))
    op.add_column('practice_log_details', sa.Column('time_signature', sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column('practice_log_details', 'time_signature')
    op.drop_column('practice_log_details', 'key_practiced')
