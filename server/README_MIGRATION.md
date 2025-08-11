# Database Migration: Add Cascade Delete Constraints

## What This Migration Does

This migration adds proper foreign key constraints with cascade delete behavior to ensure that when you delete a project, all associated events and images are automatically deleted.

## Changes Made

1. **Models Updated** (`models.py`):
   - Added `cascade='all, delete-orphan'` to Project-Events relationship
   - Added `cascade='all, delete-orphan'` to Events-Images relationship  
   - Added `cascade='all, delete-orphan'` to ShotRequest-Images relationship
   - Updated foreign key constraints with proper `ondelete` behavior

2. **API Updated** (`main.py`):
   - Enhanced project deletion to handle cascade deletion gracefully
   - Added better error handling and user feedback

## How to Run the Migration

1. **Stop your Flask backend** if it's running

2. **Run the migration script**:
   ```bash
   cd server
   python run_migration.py
   ```

3. **Restart your Flask backend**

4. **Test the deletion** by trying to delete a project from the Settings page

## What Happens Now

- When you delete a project, all associated events will be automatically deleted
- When you delete an event, all associated images will be automatically deleted
- When you delete a shot request, all associated images will be automatically deleted
- The `process_point` column will be added to the events table if it doesn't exist

## Rollback (if needed)

If something goes wrong, you can restore from a database backup. The migration script is designed to be safe and will rollback changes if any step fails.

## Verification

After running the migration, you should be able to:
1. Delete projects without getting foreign key constraint errors
2. See that associated events are automatically removed
3. Use the new `process_point` field for event coloring in the schedule
