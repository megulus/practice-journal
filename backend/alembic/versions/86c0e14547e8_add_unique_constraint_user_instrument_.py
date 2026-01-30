"""add_unique_constraint_user_instrument_name

Revision ID: 86c0e14547e8
Revises: 1bb48989475d
Create Date: 2026-01-30 12:09:12.787002

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '86c0e14547e8'
down_revision = '1bb48989475d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # First, remove duplicate user instruments (keep the oldest one by id)
    # This handles any existing duplicates before adding the constraint
    op.execute("""
        DELETE FROM instruments
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM instruments
            WHERE user_id IS NOT NULL
            GROUP BY user_id, name
        )
        AND user_id IS NOT NULL
    """)

    # Add unique constraint on (user_id, name) for instruments
    # This prevents a user from having duplicate instrument names
    # Note: PostgreSQL treats NULLs as distinct in unique constraints,
    # so system instruments (user_id=NULL) are not affected
    op.create_unique_constraint(
        'uq_instruments_user_id_name',
        'instruments',
        ['user_id', 'name']
    )


def downgrade() -> None:
    op.drop_constraint('uq_instruments_user_id_name', 'instruments', type_='unique')


