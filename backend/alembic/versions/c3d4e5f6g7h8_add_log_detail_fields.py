"""add_log_detail_fields

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6g7
Create Date: 2026-01-29 10:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c3d4e5f6g7h8'
down_revision = 'b2c3d4e5f6g7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add enhanced fields to practice_log_details table
    op.add_column('practice_log_details', sa.Column('exercise_id', sa.Integer(), nullable=True))
    op.add_column('practice_log_details', sa.Column('tempo_practiced', sa.Integer(), nullable=True))
    op.add_column('practice_log_details', sa.Column('outcome', sa.String(length=20), nullable=True))
    op.add_column('practice_log_details', sa.Column('notes', sa.Text(), nullable=True))

    # Add foreign key constraint for exercise_id
    op.create_foreign_key(
        'fk_practice_log_details_exercise_id',
        'practice_log_details', 'exercises',
        ['exercise_id'], ['id']
    )


def downgrade() -> None:
    op.drop_constraint('fk_practice_log_details_exercise_id', 'practice_log_details', type_='foreignkey')
    op.drop_column('practice_log_details', 'notes')
    op.drop_column('practice_log_details', 'outcome')
    op.drop_column('practice_log_details', 'tempo_practiced')
    op.drop_column('practice_log_details', 'exercise_id')
