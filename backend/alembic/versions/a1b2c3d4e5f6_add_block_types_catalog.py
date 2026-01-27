"""add_block_types_catalog

Revision ID: a1b2c3d4e5f6
Revises: f0612b1838c1
Create Date: 2026-01-27 10:00:00.000000

"""
from datetime import datetime
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'f0612b1838c1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create block_types table
    op.create_table(
        'block_types',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('slug', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
        sa.Column('label', sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('default_duration_minutes', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('icon_key', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
    )
    op.create_index(op.f('ix_block_types_slug'), 'block_types', ['slug'], unique=True)

    # 2. Add block_type_id and duration_minutes to exercise_blocks
    op.add_column('exercise_blocks', sa.Column('block_type_id', sa.Integer(), nullable=True))
    op.add_column('exercise_blocks', sa.Column('duration_minutes', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_exercise_blocks_block_type_id',
        'exercise_blocks', 'block_types',
        ['block_type_id'], ['id']
    )

    # 3. Seed system block types
    block_types_table = sa.table(
        'block_types',
        sa.column('id', sa.Integer),
        sa.column('slug', sa.String),
        sa.column('label', sa.String),
        sa.column('description', sa.String),
        sa.column('default_duration_minutes', sa.Integer),
        sa.column('icon_key', sa.String),
        sa.column('display_order', sa.Integer),
        sa.column('is_system', sa.Boolean),
        sa.column('user_id', sa.Integer),
        sa.column('created_at', sa.DateTime),
    )
    op.bulk_insert(block_types_table, [
        {
            'slug': 'warmup',
            'label': 'Warm-up',
            'description': 'Warm-up exercises to prepare for practice',
            'default_duration_minutes': 5,
            'icon_key': 'clock',
            'display_order': 1,
            'is_system': True,
            'user_id': None,
            'created_at': datetime.utcnow(),
        },
        {
            'slug': 'scales',
            'label': 'Scales & Arpeggios',
            'description': 'Scale and arpeggio practice',
            'default_duration_minutes': 10,
            'icon_key': 'music',
            'display_order': 2,
            'is_system': True,
            'user_id': None,
            'created_at': datetime.utcnow(),
        },
        {
            'slug': 'technique',
            'label': 'Technical Focus',
            'description': 'Technical exercises and etudes',
            'default_duration_minutes': 12,
            'icon_key': 'target',
            'display_order': 3,
            'is_system': True,
            'user_id': None,
            'created_at': datetime.utcnow(),
        },
        {
            'slug': 'repertoire',
            'label': 'Repertoire',
            'description': 'Repertoire practice and performance preparation',
            'default_duration_minutes': 15,
            'icon_key': 'book-open',
            'display_order': 4,
            'is_system': True,
            'user_id': None,
            'created_at': datetime.utcnow(),
        },
        {
            'slug': 'sight_reading',
            'label': 'Sight Reading',
            'description': 'Sight reading exercises',
            'default_duration_minutes': 10,
            'icon_key': 'eye',
            'display_order': 5,
            'is_system': True,
            'user_id': None,
            'created_at': datetime.utcnow(),
        },
        {
            'slug': 'cool_down',
            'label': 'Cool Down',
            'description': 'Cool down and reflection',
            'default_duration_minutes': 5,
            'icon_key': 'sunset',
            'display_order': 6,
            'is_system': True,
            'user_id': None,
            'created_at': datetime.utcnow(),
        },
    ])

    # 4. Data migration: set block_type_id for existing blockA/blockB rows to "technique"
    conn = op.get_bind()
    technique_id = conn.execute(
        sa.text("SELECT id FROM block_types WHERE slug = 'technique'")
    ).scalar()
    warmup_id = conn.execute(
        sa.text("SELECT id FROM block_types WHERE slug = 'warmup'")
    ).scalar()
    scales_id = conn.execute(
        sa.text("SELECT id FROM block_types WHERE slug = 'scales'")
    ).scalar()
    repertoire_id = conn.execute(
        sa.text("SELECT id FROM block_types WHERE slug = 'repertoire'")
    ).scalar()

    # Set block_type_id = technique for all existing exercise_blocks (blockA/blockB)
    conn.execute(
        sa.text("UPDATE exercise_blocks SET block_type_id = :tid WHERE block_type_id IS NULL"),
        {'tid': technique_id}
    )

    # 5. For each practice_day with warmup/scales/repertoire text, create exercise_block + exercise rows
    days = conn.execute(sa.text(
        "SELECT id, warmup, scales, repertoire FROM practice_days"
    )).fetchall()

    for day in days:
        day_id, warmup_text, scales_text, repertoire_text = day

        # Get current max display_order for this day
        max_order = conn.execute(sa.text(
            "SELECT COALESCE(MAX(display_order), 0) FROM exercise_blocks WHERE practice_day_id = :did"
        ), {'did': day_id}).scalar()

        if warmup_text:
            # Create warmup block with display_order 0 (goes first)
            conn.execute(sa.text(
                "INSERT INTO exercise_blocks (practice_day_id, block_type, block_type_id, display_order) "
                "VALUES (:did, 'warmup', :btid, 0)"
            ), {'did': day_id, 'btid': warmup_id})
            warmup_block_id = conn.execute(sa.text(
                "SELECT id FROM exercise_blocks WHERE practice_day_id = :did AND block_type = 'warmup' ORDER BY id DESC LIMIT 1"
            ), {'did': day_id}).scalar()
            conn.execute(sa.text(
                "INSERT INTO exercises (block_id, exercise_text, display_order) "
                "VALUES (:bid, :txt, 1)"
            ), {'bid': warmup_block_id, 'txt': warmup_text})

        if scales_text:
            # Create scales block with display_order 1
            conn.execute(sa.text(
                "INSERT INTO exercise_blocks (practice_day_id, block_type, block_type_id, display_order) "
                "VALUES (:did, 'scales', :btid, 1)"
            ), {'did': day_id, 'btid': scales_id})
            scales_block_id = conn.execute(sa.text(
                "SELECT id FROM exercise_blocks WHERE practice_day_id = :did AND block_type = 'scales' ORDER BY id DESC LIMIT 1"
            ), {'did': day_id}).scalar()
            conn.execute(sa.text(
                "INSERT INTO exercises (block_id, exercise_text, display_order) "
                "VALUES (:bid, :txt, 1)"
            ), {'bid': scales_block_id, 'txt': scales_text})

        if repertoire_text:
            # Create repertoire block with display_order 100 (goes last)
            conn.execute(sa.text(
                "INSERT INTO exercise_blocks (practice_day_id, block_type, block_type_id, display_order) "
                "VALUES (:did, 'repertoire', :btid, 100)"
            ), {'did': day_id, 'btid': repertoire_id})
            repertoire_block_id = conn.execute(sa.text(
                "SELECT id FROM exercise_blocks WHERE practice_day_id = :did AND block_type = 'repertoire' ORDER BY id DESC LIMIT 1"
            ), {'did': day_id}).scalar()
            conn.execute(sa.text(
                "INSERT INTO exercises (block_id, exercise_text, display_order) "
                "VALUES (:bid, :txt, 1)"
            ), {'bid': repertoire_block_id, 'txt': repertoire_text})

    # 6. Reorder existing blockA/blockB display_order to 3 and 4
    conn.execute(sa.text(
        "UPDATE exercise_blocks SET display_order = 3 WHERE block_type = 'blockA'"
    ))
    conn.execute(sa.text(
        "UPDATE exercise_blocks SET display_order = 4 WHERE block_type = 'blockB'"
    ))


def downgrade() -> None:
    conn = op.get_bind()

    # Remove exercise_blocks created by the data migration (warmup, scales, repertoire block_type)
    # First remove their exercises, then the blocks themselves
    conn.execute(sa.text(
        "DELETE FROM exercises WHERE block_id IN "
        "(SELECT id FROM exercise_blocks WHERE block_type IN ('warmup', 'scales', 'repertoire'))"
    ))
    conn.execute(sa.text(
        "DELETE FROM exercise_blocks WHERE block_type IN ('warmup', 'scales', 'repertoire')"
    ))

    # Restore original display_order for blockA/blockB
    conn.execute(sa.text("UPDATE exercise_blocks SET display_order = 1 WHERE block_type = 'blockA'"))
    conn.execute(sa.text("UPDATE exercise_blocks SET display_order = 2 WHERE block_type = 'blockB'"))

    # Drop FK, columns, table
    op.drop_constraint('fk_exercise_blocks_block_type_id', 'exercise_blocks', type_='foreignkey')
    op.drop_column('exercise_blocks', 'duration_minutes')
    op.drop_column('exercise_blocks', 'block_type_id')
    op.drop_index(op.f('ix_block_types_slug'), table_name='block_types')
    op.drop_table('block_types')
