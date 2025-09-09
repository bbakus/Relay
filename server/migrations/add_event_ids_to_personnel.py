"""
Migration: Add event_ids field to Personnel model
"""

from sqlalchemy import text

def upgrade(engine):
    """Add event_ids column to personnels table"""
    with engine.connect() as conn:
        # Add event_ids column as JSON with default empty list
        conn.execute(text("""
            ALTER TABLE personnels 
            ADD COLUMN event_ids JSON DEFAULT '[]'::json
        """))
        conn.commit()

def downgrade(engine):
    """Remove event_ids column from personnels table"""
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE personnels 
            DROP COLUMN event_ids
        """))
        conn.commit()
