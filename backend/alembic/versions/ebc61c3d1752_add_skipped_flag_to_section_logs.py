"""add skipped flag to section_logs

Revision ID: ebc61c3d1752
Revises: 0002_repertoire
Create Date: 2026-07-20 18:51:51.394841

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'ebc61c3d1752'
down_revision = '0002_repertoire'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'section_logs',
        sa.Column(
            'skipped',
            sa.Boolean(),
            server_default=sa.text('false'),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column('section_logs', 'skipped')
