#!/usr/bin/env python3
"""
Migration: Add Company Model and Multi-Tenant Structure

This migration:
1. Creates the Company table
2. Adds company_id foreign keys to existing tables
3. Creates the "Relay" super admin company
4. Assigns all existing data to the Relay company
5. Preserves all existing functionality while enabling multi-tenancy

Date: 2025-01-16
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy import create_engine
from datetime import datetime
import traceback

# Use the same Base and connection as main models
from models import Base, DATABASE_URL

# Create engine and session
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

def run_migration():
    """Run the company model migration"""
    session = Session()
    
    try:
        print("🏢 Starting Company Model Migration...")
        
        # Step 1: Create Company table
        print("📋 Step 1: Creating Company table...")
        session.execute(text("""
            CREATE TABLE IF NOT EXISTS companies (
                id SERIAL PRIMARY KEY,
                name VARCHAR NOT NULL UNIQUE,
                is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        
        # Step 2: Create the Relay super admin company
        print("📋 Step 2: Creating Relay super admin company...")
        session.execute(text("""
            INSERT INTO companies (name, is_super_admin, created_at, updated_at)
            VALUES ('Relay', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (name) DO NOTHING;
        """))
        
        # Get the Relay company ID
        relay_result = session.execute(text("SELECT id FROM companies WHERE name = 'Relay'"))
        relay_company_id = relay_result.fetchone()[0]
        print(f"✅ Relay company created with ID: {relay_company_id}")
        
        # Step 3: Add company_id columns to existing tables
        print("📋 Step 3: Adding company_id columns...")
        
        # Add company_id to users table
        try:
            session.execute(text("ALTER TABLE users ADD COLUMN company_id INTEGER"))
            print("  ✅ Added company_id to users table")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("  ℹ️  company_id column already exists in users table")
            else:
                raise e
        
        # Add company_id to organizations table
        try:
            session.execute(text("ALTER TABLE organizations ADD COLUMN company_id INTEGER"))
            print("  ✅ Added company_id to organizations table")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("  ℹ️  company_id column already exists in organizations table")
            else:
                raise e
        
        # Add company_id to personnels table
        try:
            session.execute(text("ALTER TABLE personnels ADD COLUMN company_id INTEGER"))
            print("  ✅ Added company_id to personnels table")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("  ℹ️  company_id column already exists in personnels table")
            else:
                raise e
        
        # Step 4: Assign all existing data to Relay company
        print("📋 Step 4: Assigning existing data to Relay company...")
        
        # Update users
        users_updated = session.execute(text(f"""
            UPDATE users SET company_id = {relay_company_id} 
            WHERE company_id IS NULL
        """))
        print(f"  ✅ Updated {users_updated.rowcount} users")
        
        # Update organizations
        orgs_updated = session.execute(text(f"""
            UPDATE organizations SET company_id = {relay_company_id} 
            WHERE company_id IS NULL
        """))
        print(f"  ✅ Updated {orgs_updated.rowcount} organizations")
        
        # Update personnel
        personnel_updated = session.execute(text(f"""
            UPDATE personnels SET company_id = {relay_company_id} 
            WHERE company_id IS NULL
        """))
        print(f"  ✅ Updated {personnel_updated.rowcount} personnel records")
        
        # Step 5: Add foreign key constraints
        print("📋 Step 5: Adding foreign key constraints...")
        
        try:
            session.execute(text("""
                ALTER TABLE users 
                ADD CONSTRAINT fk_users_company 
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
            """))
            print("  ✅ Added foreign key constraint to users table")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("  ℹ️  Foreign key constraint already exists on users table")
            else:
                print(f"  ⚠️  Could not add foreign key to users: {e}")
        
        try:
            session.execute(text("""
                ALTER TABLE organizations 
                ADD CONSTRAINT fk_organizations_company 
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            """))
            print("  ✅ Added foreign key constraint to organizations table")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("  ℹ️  Foreign key constraint already exists on organizations table")
            else:
                print(f"  ⚠️  Could not add foreign key to organizations: {e}")
        
        try:
            session.execute(text("""
                ALTER TABLE personnels 
                ADD CONSTRAINT fk_personnels_company 
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            """))
            print("  ✅ Added foreign key constraint to personnels table")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("  ℹ️  Foreign key constraint already exists on personnels table")
            else:
                print(f"  ⚠️  Could not add foreign key to personnels: {e}")
        
        # Commit all changes
        session.commit()
        print("🎉 Company model migration completed successfully!")
        print(f"📊 Summary:")
        print(f"   - Created Company table")
        print(f"   - Created Relay super admin company (ID: {relay_company_id})")
        print(f"   - Added company_id columns to users, organizations, and personnels")
        print(f"   - All existing data assigned to Relay company")
        print(f"   - System is now ready for multi-tenant architecture!")
        
        return True
        
    except Exception as e:
        session.rollback()
        print(f"❌ Migration failed: {e}")
        traceback.print_exc()
        return False
        
    finally:
        session.close()

def rollback_migration():
    """Rollback the migration (for testing purposes)"""
    session = Session()
    
    try:
        print("🔄 Rolling back Company Model Migration...")
        
        # Remove foreign key constraints
        print("📋 Removing foreign key constraints...")
        session.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_company"))
        session.execute(text("ALTER TABLE organizations DROP CONSTRAINT IF EXISTS fk_organizations_company"))
        session.execute(text("ALTER TABLE personnels DROP CONSTRAINT IF EXISTS fk_personnels_company"))
        
        # Remove company_id columns
        print("📋 Removing company_id columns...")
        session.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS company_id"))
        session.execute(text("ALTER TABLE organizations DROP COLUMN IF EXISTS company_id"))
        session.execute(text("ALTER TABLE personnels DROP COLUMN IF EXISTS company_id"))
        
        # Drop companies table
        print("📋 Dropping companies table...")
        session.execute(text("DROP TABLE IF EXISTS companies"))
        
        session.commit()
        print("✅ Rollback completed successfully!")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Rollback failed: {e}")
        traceback.print_exc()
        
    finally:
        session.close()

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        rollback_migration()
    else:
        success = run_migration()
        if not success:
            sys.exit(1)
