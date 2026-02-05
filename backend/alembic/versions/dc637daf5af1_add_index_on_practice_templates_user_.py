"""add_index_on_practice_templates_user_instrument_id

Revision ID: dc637daf5af1
Revises: bde4577fb855
Create Date: 2026-02-05 10:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'dc637daf5af1'
down_revision = 'bde4577fb855'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        'ix_practice_templates_user_instrument_id',
        'practice_templates',
        ['user_instrument_id']
    )


def downgrade() -> None:
    op.drop_index('ix_practice_templates_user_instrument_id', 'practice_templates')
