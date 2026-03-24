"""split_user_name_into_first_last

Revision ID: 1bb48989475d
Revises: d4e5f6g7h8i9
Create Date: 2026-01-30 11:52:52.428488

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = '1bb48989475d'
down_revision = 'd4e5f6g7h8i9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new first_name and last_name columns
    op.add_column('users', sa.Column('first_name', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True))
    op.add_column('users', sa.Column('last_name', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True))

    # Migrate data: split name on first space
    # first_name gets everything before the first space, last_name gets everything after
    op.execute("""
        UPDATE users
        SET first_name = CASE
                WHEN name IS NULL THEN NULL
                WHEN position(' ' in name) > 0 THEN substring(name from 1 for position(' ' in name) - 1)
                ELSE name
            END,
            last_name = CASE
                WHEN name IS NULL THEN NULL
                WHEN position(' ' in name) > 0 THEN substring(name from position(' ' in name) + 1)
                ELSE NULL
            END
    """)

    # Drop the old name column
    op.drop_column('users', 'name')


def downgrade() -> None:
    # Add back the name column
    op.add_column('users', sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True))

    # Migrate data: combine first_name and last_name back into name
    op.execute("""
        UPDATE users
        SET name = CASE
                WHEN first_name IS NULL AND last_name IS NULL THEN NULL
                WHEN first_name IS NULL THEN last_name
                WHEN last_name IS NULL THEN first_name
                ELSE first_name || ' ' || last_name
            END
    """)

    # Drop the new columns
    op.drop_column('users', 'last_name')
    op.drop_column('users', 'first_name')


