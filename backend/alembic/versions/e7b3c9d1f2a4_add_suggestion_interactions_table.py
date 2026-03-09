"""add_suggestion_interactions_table

Revision ID: e7b3c9d1f2a4
Revises: d36fa4148cc4
Create Date: 2026-03-09 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e7b3c9d1f2a4'
down_revision = 'd36fa4148cc4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'suggestion_interactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('instrument_id', sa.Integer(), nullable=True),
        sa.Column('suggestion_rule_id', sa.String(length=100), nullable=False),
        sa.Column('suggestion_text', sa.Text(), nullable=False),
        sa.Column('interaction_type', sa.String(length=20), nullable=False),
        sa.Column('metadata_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['instrument_id'], ['instruments.id']),
    )
    op.create_index(op.f('ix_suggestion_interactions_user_id'), 'suggestion_interactions', ['user_id'])
    op.create_index(op.f('ix_suggestion_interactions_created_at'), 'suggestion_interactions', ['created_at'])


def downgrade() -> None:
    op.drop_index(op.f('ix_suggestion_interactions_created_at'), table_name='suggestion_interactions')
    op.drop_index(op.f('ix_suggestion_interactions_user_id'), table_name='suggestion_interactions')
    op.drop_table('suggestion_interactions')
