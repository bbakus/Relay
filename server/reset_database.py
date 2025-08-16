#!/usr/bin/env python3
"""
Reset Database and Create Relay Super Admin
This script will:
1. Drop all existing tables
2. Recreate all tables from models
3. Create the Relay super admin company
4. Create the super admin user linked to Relay
"""

from models import *
from sqlalchemy import text
import sys

def drop_all_tables():
    """Drop all tables in the database"""
    engine = create_engine(DATABASE_URL)
    
    try:
        with engine.connect() as conn:
            # Get all table names
            result = conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'"))
            tables = [row[0] for row in result]
            
            if tables:
                print(f"Dropping {len(tables)} tables...")
                # Drop all tables
                for table in tables:
                    conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
                conn.commit()
                print("All tables dropped successfully!")
            else:
                print("No tables found to drop.")
                
    except Exception as e:
        print(f"Error dropping tables: {e}")
        return False
    
    return True

def create_relay_super_admin():
    """Create Relay company and super admin user"""
    session = get_session()
    
    try:
        # 1. Create the Relay super admin company
        print("Creating Relay super admin company...")
        relay_company = Company(
            name='Relay',
            is_super_admin=True
        )
        session.add(relay_company)
        session.flush()  # Get the ID without committing
        
        # 3. Create the super admin user
        print("Creating super admin user...")
        admin_user = User(
            name='Super Admin',
            email='admin@relay.com',
            access='Admin',
            avatar='avatar1.png',
            company_id=relay_company.id,
            organization_id=None  # Super admin is not linked to any organization
        )
        admin_user.set_password('password123')
        session.add(admin_user)
        
        # 4. Create optional personnel record for the admin
        print("Creating admin personnel record...")
        admin_personnel = Personnel(
            name='Super Admin',
            email='admin@relay.com',
            phone='555-0000',
            role='Admin',
            avatar='avatar1.png',
            company_id=relay_company.id,
            user_id=admin_user.id
        )
        session.add(admin_personnel)
        
        # Commit all changes
        session.commit()
        
        print("\n✅ SUCCESS! Created:")
        print(f"   • Relay Company (ID: {relay_company.id}, Super Admin: {relay_company.is_super_admin})")
        print(f"   • Super Admin User (ID: {admin_user.id})")
        print(f"     - Email: {admin_user.email}")
        print(f"     - Password: password123")
        print(f"     - Is Super Admin: {admin_user.is_super_admin}")
        print(f"     - Is Company Admin: {admin_user.is_company_admin}")
        print(f"   • Admin Personnel (ID: {admin_personnel.id})")
        
        return True
        
    except Exception as e:
        session.rollback()
        print(f"❌ Error creating super admin: {e}")
        return False
    
    finally:
        session.close()

def main():
    """Main execution function"""
    print("🔥 RELAY DATABASE RESET 🔥")
    print("=" * 40)
    
    # Confirm with user
    confirm = input("This will PERMANENTLY DELETE all data. Type 'YES' to continue: ")
    if confirm != 'YES':
        print("Operation cancelled.")
        return
    
    print("\nStarting database reset...")
    
    # Step 1: Drop all tables
    if not drop_all_tables():
        print("❌ Failed to drop tables. Exiting.")
        return
    
    # Step 2: Create all tables
    print("Creating all tables from models...")
    try:
        init_db()
        print("✅ All tables created successfully!")
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return
    
    # Step 3: Create Relay super admin
    if not create_relay_super_admin():
        print("❌ Failed to create super admin. Exiting.")
        return
    
    print("\n🎉 Database reset complete!")
    print("You can now login with:")
    print("   Email: admin@relay.com")
    print("   Password: password123")

if __name__ == "__main__":
    main()
