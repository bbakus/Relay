#!/usr/bin/env python3
"""
Script to replace all hardcoded localhost:5001 URLs with API_CONFIG.baseUrl
This ensures all frontend components use the apiConfig utility for deployment.
"""

import os
import re

def update_file(file_path):
    """Update a single file to use API_CONFIG.baseUrl"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if file already has API_CONFIG import
        has_api_config = 'API_CONFIG' in content
        
        # Replace hardcoded URLs
        old_content = content
        
        # Pattern 1: fetch('http://localhost:5001/api/...')
        content = re.sub(
            r"fetch\('http://localhost:5001/api/([^']+)'",
            r"fetch(`${API_CONFIG.baseUrl}/api/\1`",
            content
        )
        
        # Pattern 2: fetch(`http://localhost:5001/api/...`)
        content = re.sub(
            r'fetch\(`http://localhost:5001/api/([^`]+)`',
            r'fetch(`${API_CONFIG.baseUrl}/api/\1`',
            content
        )
        
        # Pattern 3: 'http://localhost:5001/api/...'
        content = re.sub(
            r"'http://localhost:5001/api/([^']+)'",
            r"`${API_CONFIG.baseUrl}/api/\1`",
            content
        )
        
        # Pattern 4: `http://localhost:5001/api/...`
        content = re.sub(
            r'`http://localhost:5001/api/([^`]+)`',
            r'`${API_CONFIG.baseUrl}/api/\1`',
            content
        )
        
        # Pattern 5: "http://localhost:5001/api/..."
        content = re.sub(
            r'"http://localhost:5001/api/([^"]+)"',
            r'`${API_CONFIG.baseUrl}/api/\1`',
            content
        )
        
        # Add API_CONFIG import if not present
        if not has_api_config and ('API_CONFIG.baseUrl' in content):
            # Find the first import statement
            import_match = re.search(r'^import\s+.*?from\s+.*?;?\s*$', content, re.MULTILINE)
            if import_match:
                import_line = import_match.group(0)
                api_config_import = 'import { API_CONFIG } from \'../utils/apiConfig\''
                if api_config_import not in content:
                    content = content.replace(import_line, f"{import_line}\n{api_config_import}")
        
        # Only write if content changed
        if content != old_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✅ Updated: {file_path}")
            return True
        else:
            print(f"⏭️  No changes: {file_path}")
            return False
            
    except Exception as e:
        print(f"❌ Error updating {file_path}: {e}")
        return False

def main():
    """Main function to update all JavaScript files"""
    client_src = 'client/src'
    updated_count = 0
    
    print("🔄 Updating hardcoded localhost URLs to use API_CONFIG...")
    
    # Walk through all JavaScript files
    for root, dirs, files in os.walk(client_src):
        for file in files:
            if file.endswith('.js') or file.endswith('.jsx'):
                file_path = os.path.join(root, file)
                if update_file(file_path):
                    updated_count += 1
    
    print(f"\n🎉 Update complete! Modified {updated_count} files.")
    print("\n📝 Next steps:")
    print("1. Review the changes")
    print("2. Commit and push the updates")
    print("3. Deploy your frontend")
    print("4. All API calls will now use REACT_APP_API_URL!")

if __name__ == "__main__":
    main()
