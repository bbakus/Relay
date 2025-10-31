"""
Migration: Add EXIF metadata fields to images table
Date: 2025-10-31
Description: Adds camera metadata, ingest organization, and project relationship fields to the images table
"""

from sqlalchemy import text
from models import get_session

def run_migration():
    session = get_session()
    
    try:
        print("🔄 Starting migration: add_exif_fields_to_images")
        
        # Add EXIF metadata columns
        migrations = [
            # EXIF metadata fields
            "ALTER TABLE images ADD COLUMN IF NOT EXISTS camera_make VARCHAR",
            "ALTER TABLE images ADD COLUMN IF NOT EXISTS camera_model VARCHAR",
            "ALTER TABLE images ADD COLUMN IF NOT EXISTS lens VARCHAR",
            "ALTER TABLE images ADD COLUMN IF NOT EXISTS iso INTEGER",
            "ALTER TABLE images ADD COLUMN IF NOT EXISTS shutter_speed VARCHAR",
            "ALTER TABLE images ADD COLUMN IF NOT EXISTS aperture VARCHAR",
            "ALTER TABLE images ADD COLUMN IF NOT EXISTS focal_length VARCHAR",
            "ALTER TABLE images ADD COLUMN IF NOT EXISTS capture_timestamp TIMESTAMP",
            "ALTER TABLE images ADD COLUMN IF NOT EXISTS width INTEGER",
            "ALTER TABLE images ADD COLUMN IF NOT EXISTS height INTEGER",
            "ALTER TABLE images ADD COLUMN IF NOT EXISTS orientation INTEGER DEFAULT 1",
            
            # Ingest folder organization
            "ALTER TABLE images ADD COLUMN IF NOT EXISTS folder_name VARCHAR",
            "ALTER TABLE images ADD COLUMN IF NOT EXISTS ingest_date VARCHAR",
            "ALTER TABLE images ADD COLUMN IF NOT EXISTS photographer_id INTEGER REFERENCES personnels(id) ON DELETE SET NULL",
            
            # Project relationship
            "ALTER TABLE images ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE",
        ]
        
        for migration in migrations:
            print(f"  ➤ Running: {migration[:80]}...")
            session.execute(text(migration))
        
        session.commit()
        print("✅ Migration completed successfully: add_exif_fields_to_images")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        session.close()

if __name__ == '__main__':
    run_migration()

