"""
Migration: Add photographer_notes field to events table
"""

def upgrade():
    return """
    ALTER TABLE events ADD COLUMN photographer_notes TEXT;
    """

def downgrade():
    return """
    ALTER TABLE events DROP COLUMN photographer_notes;
    """
