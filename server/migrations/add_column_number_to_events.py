"""
Migration: Add column_number field to events table
Date: 2024-01-XX (Update with current date)
"""

from sqlalchemy import Column, Integer, create_engine, text
from sqlalchemy.orm import sessionmaker
import sys
import os

# Add parent directory to path to import models
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# PostgreSQL connection URL - should match models.py
DATABASE_URL = 'postgresql://brandonbakus:password123@localhost:5432/relay_db'

def run_migration():
    """Add column_number field to events table"""
    
    # Create engine and session
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("Adding column_number field to events table...")
        
        # Add the column_number field with default value 0
        session.execute(text("""
            ALTER TABLE events 
            ADD COLUMN IF NOT EXISTS column_number INTEGER DEFAULT 0;
        """))
        
        # Update existing events to distribute them across columns based on ID
        # This gives a reasonably balanced initial distribution
        session.execute(text("""
            UPDATE events 
            SET column_number = (id % 4)
            WHERE column_number IS NULL OR column_number = 0;
        """))
        
        session.commit()
        print("✅ Successfully added column_number field to events table")
        print("✅ Existing events distributed across columns 0-3")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Error during migration: {e}")
        raise
    finally:
        session.close()

def rollback_migration():
    """Remove column_number field from events table"""
    
    # Create engine and session
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("Removing column_number field from events table...")
        
        session.execute(text("""
            ALTER TABLE events 
            DROP COLUMN IF EXISTS column_number;
        """))
        
        session.commit()
        print("✅ Successfully removed column_number field from events table")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Error during rollback: {e}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--rollback":
        rollback_migration()
    else:
        run_migration()
