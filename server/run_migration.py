#!/usr/bin/env python3
"""
Database migration script to add cascade delete constraints
"""

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

# Database connection
DATABASE_URL = 'postgresql://brandonbakus:password123@localhost:5432/relay_db'
engine = create_engine(DATABASE_URL)

def run_migration():
    """Run the migration to add cascade delete constraints"""
    
    # Migration SQL commands
    migration_sql = [
        # Drop existing foreign key constraints (if they exist)
        "ALTER TABLE events DROP CONSTRAINT IF EXISTS events_project_id_fkey",
        "ALTER TABLE images DROP CONSTRAINT IF EXISTS images_event_id_fkey", 
        "ALTER TABLE images DROP CONSTRAINT IF EXISTS images_requests_id_fkey",
        "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_organization_id_fkey",
        "ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_organization_id_fkey",
        "ALTER TABLE personnels DROP CONSTRAINT IF EXISTS personnels_user_id_fkey",
        "ALTER TABLE access_requests DROP CONSTRAINT IF EXISTS access_requests_processed_by_fkey",
        
        # Add new foreign key constraints with proper cascade behavior
        "ALTER TABLE events ADD CONSTRAINT events_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE",
        "ALTER TABLE images ADD CONSTRAINT images_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE",
        "ALTER TABLE images ADD CONSTRAINT images_requests_id_fkey FOREIGN KEY (requests_id) REFERENCES shot_requests(id) ON DELETE CASCADE",
        "ALTER TABLE users ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL",
        "ALTER TABLE projects ADD CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE",
        "ALTER TABLE personnels ADD CONSTRAINT personnels_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL",
        "ALTER TABLE access_requests ADD CONSTRAINT access_requests_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL",
        
        # Add the process_point column if it doesn't exist
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS process_point TEXT DEFAULT 'idle'",
        
        # Update existing events to have a default process_point
        "UPDATE events SET process_point = 'idle' WHERE process_point IS NULL"
    ]
    
    with engine.connect() as conn:
        try:
            print("Starting migration...")
            
            for i, sql in enumerate(migration_sql, 1):
                print(f"Executing step {i}/{len(migration_sql)}: {sql[:50]}...")
                conn.execute(text(sql))
                conn.commit()
                print(f"✓ Step {i} completed")
            
            print("\n🎉 Migration completed successfully!")
            print("All cascade delete constraints have been added.")
            print("The process_point column has been added to events table.")
            
        except SQLAlchemyError as e:
            print(f"❌ Migration failed: {e}")
            conn.rollback()
            raise
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            conn.rollback()
            raise

if __name__ == "__main__":
    run_migration()
