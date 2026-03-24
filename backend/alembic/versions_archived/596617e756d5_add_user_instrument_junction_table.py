"""add_user_instrument_junction_table

Revision ID: 596617e756d5
Revises: 86c0e14547e8
Create Date: 2026-02-03 15:52:51.377677

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = '596617e756d5'
down_revision = '86c0e14547e8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add new columns to instruments table
    op.add_column('instruments', sa.Column('created_by_user_id', sa.Integer(), nullable=True))
    op.add_column('instruments', sa.Column('is_shareable', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('instruments', sa.Column('deleted_at', sa.DateTime(), nullable=True))
    op.create_foreign_key(
        'fk_instruments_created_by_user_id',
        'instruments', 'users',
        ['created_by_user_id'], ['id']
    )

    # 2. Create user_instrument junction table
    op.create_table(
        'user_instrument',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('instrument_id', sa.Integer(), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('added_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_user_instrument_user_id'),
        sa.ForeignKeyConstraint(['instrument_id'], ['instruments.id'], name='fk_user_instrument_instrument_id'),
        sa.UniqueConstraint('user_id', 'instrument_id', name='uq_user_instrument_user_id_instrument_id')
    )
    op.create_index('ix_user_instrument_user_id', 'user_instrument', ['user_id'])
    op.create_index('ix_user_instrument_instrument_id', 'user_instrument', ['instrument_id'])

    # 3. Add user_instrument_id to practice_templates (nullable for now)
    op.add_column('practice_templates', sa.Column('user_instrument_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_practice_templates_user_instrument_id',
        'practice_templates', 'user_instrument',
        ['user_instrument_id'], ['id']
    )


def downgrade() -> None:
    # Remove user_instrument_id from practice_templates
    op.drop_constraint('fk_practice_templates_user_instrument_id', 'practice_templates', type_='foreignkey')
    op.drop_column('practice_templates', 'user_instrument_id')

    # Drop user_instrument table
    op.drop_index('ix_user_instrument_instrument_id', 'user_instrument')
    op.drop_index('ix_user_instrument_user_id', 'user_instrument')
    op.drop_table('user_instrument')

    # Remove new columns from instruments
    op.drop_constraint('fk_instruments_created_by_user_id', 'instruments', type_='foreignkey')
    op.drop_column('instruments', 'deleted_at')
    op.drop_column('instruments', 'is_shareable')
    op.drop_column('instruments', 'created_by_user_id')


