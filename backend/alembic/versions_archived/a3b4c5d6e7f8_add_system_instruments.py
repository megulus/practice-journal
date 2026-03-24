"""add_system_instruments

Revision ID: a3b4c5d6e7f8
Revises: dc637daf5af1
Create Date: 2026-02-10 12:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'a3b4c5d6e7f8'
down_revision = 'dc637daf5af1'
branch_labels = None
depends_on = None

# New system instruments to add (name, description)
# Descriptions included only where the name alone is ambiguous.
INSTRUMENTS = [
    # Strings
    ("Cello", ""),
    ("Viola", ""),
    ("Double Bass", ""),
    ("Acoustic Guitar", "Steel-string acoustic guitar"),
    ("Classical Guitar", "Nylon-string classical guitar"),
    ("Electric Guitar", ""),
    ("Bass Guitar", ""),
    ("Harp", "Pedal or lever harp"),
    ("Ukulele", "Soprano, concert, tenor, or baritone ukulele"),
    ("Mandolin", ""),
    ("Banjo", "Four or five-string banjo"),
    # Woodwinds
    ("Flute", "Western concert flute"),
    ("Clarinet", "B-flat or A clarinet"),
    ("Oboe", ""),
    ("Bassoon", ""),
    ("Contrabassoon", ""),
    ("Saxophone", "Alto, tenor, or other saxophone"),
    ("Recorder", "Soprano, alto, tenor, or bass recorder"),
    # Brass
    ("Trumpet", "B-flat or C trumpet"),
    ("French Horn", ""),
    ("Trombone", "Tenor trombone"),
    ("Bass Trombone", ""),
    ("Tuba", ""),
    # Keyboards
    ("Piano", ""),
    ("Organ", "Pipe, electric, or electronic organ"),
    ("Accordion", "Piano or button accordion"),
    # Percussion
    ("Percussion", "Orchestral or concert percussion"),
    ("Drums", "Drum set or kit"),
    # Voice
    ("Voice", ""),
]


def upgrade() -> None:
    for name, description in INSTRUMENTS:
        escaped_desc = description.replace("'", "''")
        op.execute(
            f"INSERT INTO instruments (name, description, created_at, is_system, is_shareable) "
            f"VALUES ('{name}', '{escaped_desc}', NOW(), true, false)"
        )
    # Clear description on existing Violin row
    op.execute("UPDATE instruments SET description = '' WHERE name = 'Violin' AND is_system = true")


def downgrade() -> None:
    names = ", ".join(f"'{name}'" for name, _ in INSTRUMENTS)
    op.execute(f"DELETE FROM instruments WHERE name IN ({names}) AND is_system = true")
    # Restore original Violin description
    op.execute(
        "UPDATE instruments SET description = 'Western classical violin' "
        "WHERE name = 'Violin' AND is_system = true"
    )
