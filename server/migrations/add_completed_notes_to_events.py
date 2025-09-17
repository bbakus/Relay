#!/usr/bin/env python3

"""
Migration: Add completed_notes column to events table
This field will store an array of completed note items as JSON
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from models import DATABASE_URL

def upgrade():
    """Add completed_notes column to events table"""
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Add completed_notes column as JSON with default empty array
        conn.execute(text("""
            ALTER TABLE events 
            ADD COLUMN completed_notes JSON DEFAULT '[]'
        """))
        conn.commit()
        print("✅ Added completed_notes column to events table")

def downgrade():
    """Remove completed_notes column from events table"""
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE events DROP COLUMN completed_notes"))
        conn.commit()
        print("✅ Removed completed_notes column from events table")

if __name__ == "__main__":
    upgrade()
