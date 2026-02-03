"""migrate_user_instruments_data

Revision ID: 4d661a5946f6
Revises: 596617e756d5
Create Date: 2026-02-03 15:53:21.640920

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = '4d661a5946f6'
down_revision = '596617e756d5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Step 1: For each user instrument, find or create the canonical instrument
    # and create a user_instrument record

    # Get all user-copied instruments (user_id IS NOT NULL, is_system = false)
    user_instruments = conn.execute(text("""
        SELECT id, user_id, name, description
        FROM instruments
        WHERE user_id IS NOT NULL AND is_system = false
    """)).fetchall()

    for ui in user_instruments:
        user_inst_id, user_id, name, description = ui

        # Find matching system instrument by name
        system_inst = conn.execute(text("""
            SELECT id FROM instruments
            WHERE name = :name AND is_system = true
            LIMIT 1
        """), {"name": name}).fetchone()

        if system_inst:
            # System instrument exists - link user to it
            canonical_instrument_id = system_inst[0]
        else:
            # No matching system instrument - convert this to a custom instrument
            # Update the existing row to be a custom instrument
            conn.execute(text("""
                UPDATE instruments
                SET is_system = false,
                    created_by_user_id = :user_id,
                    user_id = NULL
                WHERE id = :id
            """), {"user_id": user_id, "id": user_inst_id})
            canonical_instrument_id = user_inst_id

        # Check if user_instrument record already exists (avoid duplicates)
        existing = conn.execute(text("""
            SELECT id FROM user_instrument
            WHERE user_id = :user_id AND instrument_id = :instrument_id
        """), {"user_id": user_id, "instrument_id": canonical_instrument_id}).fetchone()

        if existing:
            new_user_instrument_id = existing[0]
        else:
            # Create user_instrument junction record
            result = conn.execute(text("""
                INSERT INTO user_instrument (user_id, instrument_id, display_order, added_at)
                VALUES (:user_id, :instrument_id, 0, NOW())
                RETURNING id
            """), {"user_id": user_id, "instrument_id": canonical_instrument_id})
            new_user_instrument_id = result.fetchone()[0]

        # Update practice_templates that referenced the old user instrument
        conn.execute(text("""
            UPDATE practice_templates
            SET user_instrument_id = :new_id
            WHERE instrument_id = :old_id AND user_id = :user_id
        """), {"new_id": new_user_instrument_id, "old_id": user_inst_id, "user_id": user_id})

    # Step 2: Handle system templates - they should reference system instruments
    # For now, system templates will keep their instrument_id until we decide how to handle them
    # (System templates don't have a user_id, so they can't have a user_instrument_id)


def downgrade() -> None:
    # This migration is complex to reverse - would need to recreate user instrument copies
    # For safety, we'll just clear the user_instrument_id on templates
    conn = op.get_bind()

    conn.execute(text("""
        UPDATE practice_templates
        SET user_instrument_id = NULL
    """))

    conn.execute(text("""
        DELETE FROM user_instrument
    """))


