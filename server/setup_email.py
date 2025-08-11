#!/usr/bin/env python3
"""
Email Setup Script for Relay
This script helps you configure email settings for the Relay application.
"""

import os
import getpass

def setup_email():
    print("🔧 Relay Email Configuration Setup")
    print("=" * 40)
    print()
    
    print("This script will help you set up email sending for access request approvals.")
    print()
    
    # Get email address
    email = input("Enter your email address: ").strip()
    
    if not email:
        print("❌ Email address is required!")
        return False
    
    # Get password (hidden input)
    print()
    print("For Gmail, you need an 'App Password' (not your regular password):")
    print("1. Enable 2-factor authentication on your Google account")
    print("2. Go to: https://myaccount.google.com/apppasswords")
    print("3. Generate an app password for 'Mail'")
    print("4. Use that app password below")
    print()
    
    password = getpass.getpass("Enter your app password: ").strip()
    
    if not password:
        print("❌ Password is required!")
        return False
    
    # Test the configuration
    print()
    print("🧪 Testing email configuration...")
    
    try:
        import smtplib
        from email.mime.text import MIMEText
        
        # Test connection
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(email, password)
        server.quit()
        
        print("✅ Email configuration test successful!")
        
    except Exception as e:
        print(f"❌ Email configuration test failed: {str(e)}")
        print("Please check your email and app password and try again.")
        return False
    
    # Create environment setup instructions
    print()
    print("📝 Environment Setup Instructions:")
    print("=" * 40)
    print()
    print("Add these environment variables to your system:")
    print()
    print(f"export RELAY_EMAIL='{email}'")
    print(f"export RELAY_EMAIL_PASSWORD='{password}'")
    print()
    print("You can add these to your ~/.bash_profile, ~/.zshrc, or run them in your terminal")
    print("before starting the Flask server.")
    print()
    
    # Option to create a local env file
    create_file = input("Create a local .env file? (y/n): ").lower().strip()
    
    if create_file == 'y':
        try:
            with open('.env', 'w') as f:
                f.write(f"# Relay Email Configuration\n")
                f.write(f"export RELAY_EMAIL='{email}'\n")
                f.write(f"export RELAY_EMAIL_PASSWORD='{password}'\n")
            
            print()
            print("✅ .env file created! Run 'source .env' before starting your server.")
            print()
            print("⚠️  WARNING: Do not commit the .env file to version control!")
            print("   Add '.env' to your .gitignore file.")
            
        except Exception as e:
            print(f"❌ Failed to create .env file: {str(e)}")
    
    print()
    print("🎉 Email setup complete!")
    print("Restart your Flask server to use the new email configuration.")
    
    return True

if __name__ == "__main__":
    setup_email()
