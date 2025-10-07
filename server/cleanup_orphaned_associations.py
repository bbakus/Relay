"""
Cleanup script to remove orphaned associations from personnel_event_association table
where the event_id references an event that no longer exists.
"""

from models import get_session, Events, Personnel
from sqlalchemy import text

def cleanup_orphaned_associations():
    session = get_session()
    
    try:
        print("🧹 Starting cleanup of orphaned associations...")
        
        # Get all valid event IDs
        valid_event_ids = [e.id for e in session.query(Events.id).all()]
        print(f"✅ Found {len(valid_event_ids)} valid events in database")
        
        # Find orphaned associations in personnel_event_association table
        result = session.execute(text("""
            SELECT personnel_id, event_id 
            FROM personnel_event_association
        """))
        
        associations = result.fetchall()
        print(f"📊 Found {len(associations)} total personnel-event associations")
        
        # Identify orphaned associations
        orphaned = []
        for personnel_id, event_id in associations:
            if event_id not in valid_event_ids:
                orphaned.append((personnel_id, event_id))
        
        if orphaned:
            print(f"⚠️  Found {len(orphaned)} orphaned associations:")
            
            # Group by personnel to show which photographers are affected
            personnel_orphans = {}
            for personnel_id, event_id in orphaned:
                if personnel_id not in personnel_orphans:
                    personnel = session.query(Personnel).filter_by(id=personnel_id).first()
                    personnel_orphans[personnel_id] = {
                        'name': personnel.name if personnel else f"Unknown (ID: {personnel_id})",
                        'event_ids': []
                    }
                personnel_orphans[personnel_id]['event_ids'].append(event_id)
            
            for personnel_id, info in personnel_orphans.items():
                print(f"   - {info['name']}: linked to deleted events {info['event_ids']}")
            
            # Delete orphaned associations
            print("\n🗑️  Removing orphaned associations...")
            for personnel_id, event_id in orphaned:
                session.execute(text("""
                    DELETE FROM personnel_event_association 
                    WHERE personnel_id = :personnel_id AND event_id = :event_id
                """), {'personnel_id': personnel_id, 'event_id': event_id})
            
            session.commit()
            print(f"✅ Successfully removed {len(orphaned)} orphaned associations")
        else:
            print("✅ No orphaned associations found - database is clean!")
        
        # Also clean up orphaned shot request associations
        print("\n🧹 Checking shot request associations...")
        result = session.execute(text("""
            SELECT event_id, shot_request_id 
            FROM event_request_association
        """))
        
        sr_associations = result.fetchall()
        orphaned_sr = []
        for event_id, shot_request_id in sr_associations:
            if event_id not in valid_event_ids:
                orphaned_sr.append((event_id, shot_request_id))
        
        if orphaned_sr:
            print(f"⚠️  Found {len(orphaned_sr)} orphaned shot request associations")
            print("🗑️  Removing orphaned shot request associations...")
            for event_id, shot_request_id in orphaned_sr:
                session.execute(text("""
                    DELETE FROM event_request_association 
                    WHERE event_id = :event_id AND shot_request_id = :shot_request_id
                """), {'event_id': event_id, 'shot_request_id': shot_request_id})
            
            session.commit()
            print(f"✅ Successfully removed {len(orphaned_sr)} orphaned shot request associations")
        else:
            print("✅ No orphaned shot request associations found")
        
        print("\n✨ Cleanup complete! Database associations are now in sync.")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Error during cleanup: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    cleanup_orphaned_associations()

