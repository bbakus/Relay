"""
Migration: Add details column to events table
Date: 2025-10-09
Description: Adds a 'details' column to events for storing raw text details (no checklist functionality)
"""

from sqlalchemy import create_engine, Column, String
from sqlalchemy.orm import sessionmaker
import os

def run_migration():
    # Get database URL from environment or use default
    database_url = os.environ.get('DATABASE_URL', 'sqlite:///relay.db')
    engine = create_engine(database_url)
    
    # Add details column to events table
    with engine.begin() as connection:
        try:
            # Check if column already exists
            result = connection.execute("PRAGMA table_info(events)")
            columns = [row[1] for row in result]
            
            if 'details' not in columns:
                connection.execute("ALTER TABLE events ADD COLUMN details TEXT")
                print("✅ Successfully added 'details' column to events table")
            else:
                print("ℹ️  Column 'details' already exists in events table")
                
        except Exception as e:
            print(f"❌ Error adding details column: {e}")
            raise

if __name__ == "__main__":
    run_migration()

