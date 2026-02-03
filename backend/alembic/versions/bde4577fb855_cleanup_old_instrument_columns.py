"""cleanup_old_instrument_columns

Revision ID: bde4577fb855
Revises: 4d661a5946f6
Create Date: 2026-02-03 15:53:50.125972

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = 'bde4577fb855'
down_revision = '4d661a5946f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Step 1: Delete user-specific instrument copies that were migrated to system instruments
    # Keep custom instruments (those that were converted because no system match existed)
    conn.execute(text("""
        DELETE FROM instruments
        WHERE user_id IS NOT NULL
          AND is_system = false
          AND created_by_user_id IS NULL
    """))

    # Step 2: Clear instrument_id for user templates (they now use user_instrument_id)
    conn.execute(text("""
        UPDATE practice_templates
        SET instrument_id = NULL
        WHERE user_instrument_id IS NOT NULL
    """))

    # Step 3: Drop the old unique constraint on instruments (user_id, name)
    op.drop_constraint('uq_instruments_user_id_name', 'instruments', type_='unique')

    # Step 4: Drop old foreign key and user_id column from instruments
    op.drop_constraint('instruments_user_id_fkey', 'instruments', type_='foreignkey')
    op.drop_column('instruments', 'user_id')

    # Step 5: Make instrument_id nullable on practice_templates
    # (user templates use user_instrument_id, system templates use instrument_id)
    op.alter_column('practice_templates', 'instrument_id', nullable=True)


def downgrade() -> None:
    # Re-add user_id column to instruments
    op.add_column('instruments', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_foreign_key('instruments_user_id_fkey', 'instruments', 'users', ['user_id'], ['id'])

    # Re-add unique constraint
    op.create_unique_constraint('uq_instruments_user_id_name', 'instruments', ['user_id', 'name'])

    # Make instrument_id NOT NULL again
    op.alter_column('practice_templates', 'instrument_id', nullable=False)


