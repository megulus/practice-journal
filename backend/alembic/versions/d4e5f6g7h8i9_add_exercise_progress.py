"""add_exercise_progress

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-01-29 10:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd4e5f6g7h8i9'
down_revision = 'c3d4e5f6g7h8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create exercise_progress table
    op.create_table(
        'exercise_progress',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('exercise_id', sa.Integer(), nullable=False),
        sa.Column('times_practiced', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_practiced_at', sa.DateTime(), nullable=True),
        sa.Column('current_tempo', sa.Integer(), nullable=True),
        sa.Column('current_difficulty', sa.Integer(), nullable=True),
        sa.Column('struggled_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('okay_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('nailed_it_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['exercise_id'], ['exercises.id']),
    )

    # Create indexes
    op.create_index('ix_exercise_progress_user_id', 'exercise_progress', ['user_id'])
    op.create_index('ix_exercise_progress_exercise_id', 'exercise_progress', ['exercise_id'])

    # Create unique constraint on (user_id, exercise_id)
    op.create_unique_constraint(
        'uq_exercise_progress_user_exercise',
        'exercise_progress',
        ['user_id', 'exercise_id']
    )


def downgrade() -> None:
    op.drop_constraint('uq_exercise_progress_user_exercise', 'exercise_progress', type_='unique')
    op.drop_index('ix_exercise_progress_exercise_id', table_name='exercise_progress')
    op.drop_index('ix_exercise_progress_user_id', table_name='exercise_progress')
    op.drop_table('exercise_progress')
