"""add_exercise_metadata

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-01-29 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6g7'
down_revision = '6112e8733982'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add structured metadata fields to exercises table
    op.add_column('exercises', sa.Column('tempo_bpm', sa.Integer(), nullable=True))
    op.add_column('exercises', sa.Column('key', sa.String(length=50), nullable=True))
    op.add_column('exercises', sa.Column('technique_category', sa.String(length=50), nullable=True))
    op.add_column('exercises', sa.Column('difficulty_level', sa.Integer(), nullable=True))
    op.add_column('exercises', sa.Column('notes', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('exercises', 'notes')
    op.drop_column('exercises', 'difficulty_level')
    op.drop_column('exercises', 'technique_category')
    op.drop_column('exercises', 'key')
    op.drop_column('exercises', 'tempo_bpm')
