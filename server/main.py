from flask import Flask, request, jsonify
from flask_cors import CORS
from sqlalchemy.engine import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError
from models import (
    User,
    Personnel as PersonnelModel,
    Events as EventModel,
    ShotRequest as ShotRequestModel,
    Image as ImageModel,
    Project as ProjectModel,
    get_session,
    Organization,
    AccessRequest,
    personnel_event_association_table,
)
from flask_restful import Api, Resource
from werkzeug.security import check_password_hash
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
api = Api(app)

DATABASE_URL = 'postgresql://brandonbakus:password123@localhost:5432/relay_db'
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

# Email configuration
EMAIL_CONFIG = {
    'smtp_server': 'smtp.gmail.com',  # Change this to your SMTP server
    'smtp_port': 587,
    'email': os.getenv('RELAY_EMAIL', 'relay.system@gmail.com'),  # Change to your email
    'password': os.getenv('RELAY_EMAIL_PASSWORD', '')  # Use environment variable for security
}

def send_approval_email(recipient_email, recipient_name, login_email, temporary_password, organization_name):
    """Send approval email to the requestee with login information"""
    try:
        # Check if email configuration is set up
        if not EMAIL_CONFIG['email'] or EMAIL_CONFIG['email'] == 'relay.system@gmail.com':
            print("Email not configured: RELAY_EMAIL environment variable not set")
            return False
            
        if not EMAIL_CONFIG['password']:
            print("Email not configured: RELAY_EMAIL_PASSWORD environment variable not set")
            return False
        
        print(f"Attempting to send email to {recipient_email} using {EMAIL_CONFIG['email']}")
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = EMAIL_CONFIG['email']
        msg['To'] = recipient_email
        msg['Subject'] = f"Access Request Approved - Welcome to Relay!"
        
        # Email body
        body = f"""
Dear {recipient_name},

Great news! Your access request to join the Relay platform has been approved.

Your login credentials:
• Email: {login_email}
• Temporary Password: {temporary_password}
• Organization: {organization_name}

Please log in at your earliest convenience and change your password in the settings.

If you have any questions or need assistance, please don't hesitate to reach out.

Welcome to the team!

Best regards,
The Relay Team
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        # Connect to server and send email
        print(f"Connecting to SMTP server: {EMAIL_CONFIG['smtp_server']}:{EMAIL_CONFIG['smtp_port']}")
        server = smtplib.SMTP(EMAIL_CONFIG['smtp_server'], EMAIL_CONFIG['smtp_port'])
        server.starttls()  # Enable TLS encryption
        
        print("Attempting to login to email server...")
        server.login(EMAIL_CONFIG['email'], EMAIL_CONFIG['password'])
        
        print("Sending email...")
        text = msg.as_string()
        server.sendmail(EMAIL_CONFIG['email'], recipient_email, text)
        server.quit()
        
        print(f"Email sent successfully to {recipient_email}")
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"SMTP Authentication failed: {str(e)}")
        print("This usually means your email/password is incorrect or you need an app password")
        return False
    except smtplib.SMTPException as e:
        print(f"SMTP error occurred: {str(e)}")
        return False
    except Exception as e:
        print(f"Failed to send email: {str(e)}")
        return False


# Authentication helper
def authenticate_user(email, password):
    """Authenticate a user with email and password"""
    session = Session()
    try:
        user = session.query(User).filter_by(email=email).first()
        if user and user.check_password(password):
            return user
        return None
    finally:
        session.close()


# User endpoints
class Users(Resource):
    def get(self):
        """Get all users"""
        session = Session()
        try:
            users = session.query(User).all()
            payload = [
                {
                    'id': u.id,
                    'name': u.name,
                    'email': u.email,
                    'access': u.access,
                    'avatar': u.avatar,
                    'organization_id': getattr(u, 'organization_id', None),
                }
                for u in users
            ]
            return payload, 200
        except Exception as e:
            return {'error': str(e)}, 500
        finally:
            session.close()

    def post(self):
        """Create a new user (optionally with linked personnel)"""
        session = Session()
        try:
            data = request.get_json()
            
            # Check if user already exists
            existing_user = session.query(User).filter_by(email=data['email']).first()
            if existing_user:
                return {'error': 'User with this email already exists'}, 400
            
            # Optional: attach to organization by id
            org = None
            org_id = data.get('organization_id')
            if org_id is not None:
                org = session.query(Organization).filter_by(id=org_id).first()
                if not org:
                    return {'error': 'Organization not found'}, 400

            # Create new user
            new_user = User(
                name=data['name'],
                email=data['email'],
                access=data.get('access', 'Guest'),
            )
            if org is not None:
                new_user.organization = org

            new_user.set_password(data['password'])
            session.add(new_user)
            session.flush()  # get new_user.id

            # Optionally create linked personnel
            if data.get('create_personnel'):
                personnel_payload = data.get('personnel', {})
                new_personnel = PersonnelModel(
                    name=personnel_payload.get('name', new_user.name),
                    email=personnel_payload.get('email', new_user.email),
                    phone=personnel_payload.get('phone'),
                    role=personnel_payload.get('role', new_user.access),
                    avatar=personnel_payload.get('avatar')
                )
                new_personnel.user = new_user
                session.add(new_personnel)

            session.commit()
            
            return {
                'id': new_user.id,
                'name': new_user.name,
                'email': new_user.email,
                'access': new_user.access,
                'avatar': new_user.avatar,
                'organization_id': new_user.organization_id
            }, 201
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()


class UserDetail(Resource):
    def get(self, user_id):
        """Get a specific user"""
        session = Session()
        try:
            user = session.query(User).filter_by(id=user_id).first()
            if user:
                user_payload = {
                    'id': user.id,
                    'name': user.name,
                    'email': user.email,
                    'access': user.access,
                    'avatar': user.avatar,
                    'organization_id': getattr(user, 'organization_id', None),
                }
                return user_payload, 200
            return {'error': 'User not found'}, 404
        except Exception as e:
            return {'error': str(e)}, 500
        finally:
            session.close()

    def put(self, user_id):
        """Update a user"""
        session = Session()
        try:
            user = session.query(User).filter_by(id=user_id).first()
            if not user:
                return {'error': 'User not found'}, 404
            
            data = request.get_json()

            # If organization_id provided, update relationship
            if 'organization_id' in data:
                org_id = data.get('organization_id')
                if org_id is None:
                    user.organization = None
                else:
                    org = session.query(Organization).filter_by(id=org_id).first()
                    if not org:
                        return {'error': 'Organization not found'}, 400
                    user.organization = org

            for key, value in data.items():
                if hasattr(user, key) and key not in ('password_hash', 'organization', 'organization_id'):
                    setattr(user, key, value)
            
            # Handle password update separately
            if 'password' in data:
                user.set_password(data['password'])
            
            session.commit()
            return {
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'access': user.access,
                'avatar': user.avatar,
                'organization_id': user.organization_id
            }, 200
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()

    def delete(self, user_id):
        """Delete a user and associated personnel"""
        session = Session()
        try:
            user = session.query(User).filter_by(id=user_id).first()
            if not user:
                return {'error': 'User not found'}, 404
            
            # Find and delete associated personnel record if it exists
            from models import Personnel as PersonnelModel
            personnel = session.query(PersonnelModel).filter_by(user_id=user_id).first()
            if personnel:
                session.delete(personnel)
            
            session.delete(user)
            session.commit()
            
            message = 'User deleted successfully'
            if personnel:
                message += ' (including associated personnel record)'
            
            return {'message': message}, 200
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()


class UserLogin(Resource):
    def post(self):
        """User login"""
        try:
            data = request.get_json()
            user = authenticate_user(data['email'], data['password'])
            
            if user:
                user_payload = {
                    'id': user.id,
                    'name': user.name,
                    'email': user.email,
                    'access': user.access,
                    'avatar': user.avatar,
                    'organization_id': getattr(user, 'organization_id', None),
                }
                return {
                    'message': 'Login successful',
                    'user': user_payload
                }, 200
            else:
                return {'error': 'Invalid credentials'}, 401
        except Exception as e:
            return {'error': str(e)}, 500


class UserSchedule(Resource):
    def get(self, user_id):
        """Get the schedule (events) for a user's linked personnel for a given date (YYYY-MM-DD)"""
        session = Session()
        try:
            date = request.args.get('date')
            user = session.query(User).filter_by(id=user_id).first()
            if not user:
                return {'error': 'User not found'}, 404
            if not user.personnel:
                return {'events': []}, 200

            # Filter events by date if provided
            personnel = user.personnel
            events_query = session.query(EventModel).join(personnel_event_association_table, EventModel.id == personnel_event_association_table.c.event_id)
            events_query = events_query.filter(personnel_event_association_table.c.personnel_id == personnel.id)
            if date:
                events_query = events_query.filter(EventModel.date == date)

            events = events_query.all()
            return [{
                'id': event.id,
                'name': event.name,
                'date': event.date,
                'start_time': event.start_time,
                'end_time': event.end_time,
                'location': event.location,
                'notes': event.notes,
                'quick_turn': event.quick_turn,
                'deadline': event.deadline,
                'process_point': getattr(event, 'process_point', 'idle'),
                'project_id': event.project_id
            } for event in events], 200
        except Exception as e:
            return {'error': str(e)}, 500
        finally:
            session.close()


# Project endpoints
class ProjectsResource(Resource):
    def get(self):
        """Get all projects"""
        session = Session()
        try:
            projects = session.query(ProjectModel).all()
            return [{
                'id': project.id,
                'name': project.name,
                'location': project.location,
                'start_date': project.start_date,
                'end_date': project.end_date,
                'deliver_date': project.deliver_date,
                'organization_id': project.organization_id
            } for project in projects], 200
        except Exception as e:
            return {'error': str(e)}, 500
        finally:
            session.close()

    def post(self):
        """Create a new project"""
        session = Session()
        try:
            data = request.get_json()

            # Optional: attach to organization by id
            org = None
            org_id = data.get('organization_id')
            if org_id is not None:
                org = session.query(Organization).filter_by(id=org_id).first()
                if not org:
                    return {'error': 'Organization not found'}, 400

            new_project = ProjectModel(
                name=data['name'],
                location=data['location'],
                start_date=data['start_date'],
                end_date=data['end_date'],
                deliver_date=data.get('deliver_date')
            )

            if org is not None:
                new_project.organization = org
            
            session.add(new_project)
            session.commit()
            
            return {
                'id': new_project.id,
                'name': new_project.name,
                'location': new_project.location,
                'start_date': new_project.start_date,
                'end_date': new_project.end_date,
                'deliver_date': new_project.deliver_date,
                'organization_id': new_project.organization_id
            }, 201
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()


class ProjectDetail(Resource):
    def get(self, project_id):
        """Get a specific project"""
        session = Session()
        try:
            project = session.query(ProjectModel).filter_by(id=project_id).first()
            if project:
                return {
                    'id': project.id,
                    'name': project.name,
                    'location': project.location,
                    'start_date': project.start_date,
                    'end_date': project.end_date,
                    'deliver_date': project.deliver_date,
                    'organization_id': project.organization_id
                }, 200
            return {'error': 'Project not found'}, 404
        except Exception as e:
            return {'error': str(e)}, 500
        finally:
            session.close()

    def put(self, project_id):
        """Update a project"""
        session = Session()
        try:
            project = session.query(ProjectModel).filter_by(id=project_id).first()
            if not project:
                return {'error': 'Project not found'}, 404
            
            data = request.get_json()

            # If organization_id provided, update relationship
            if 'organization_id' in data:
                org_id = data.get('organization_id')
                if org_id is None:
                    project.organization = None
                else:
                    org = session.query(Organization).filter_by(id=org_id).first()
                    if not org:
                        return {'error': 'Organization not found'}, 400
                    project.organization = org

            for key, value in data.items():
                if hasattr(project, key) and key not in ('organization', 'organization_id'):
                    setattr(project, key, value)
            
            session.commit()
            return {
                'id': project.id,
                'name': project.name,
                'location': project.location,
                'start_date': project.start_date,
                'end_date': project.end_date,
                'deliver_date': project.deliver_date,
                'organization_id': project.organization_id
            }, 200
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()

    def delete(self, project_id):
        """Delete a project and all associated events"""
        session = Session()
        try:
            project = session.query(ProjectModel).filter_by(id=project_id).first()
            if not project:
                return {'error': 'Project not found'}, 404
            
            # With cascade='all, delete-orphan' in the model, SQLAlchemy will automatically
            # delete all associated events when the project is deleted
            # We can also delete them explicitly for extra safety
            event_count = len(project.events)
            for event in project.events:
                session.delete(event)
            
            session.delete(project)
            session.commit()
            
            message = f'Project deleted successfully. {event_count} associated events were also deleted.'
            return {'message': message}, 200
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()


# Event endpoints
class EventsResource(Resource):
    def get(self):
        """Get all events"""
        session = Session()
        try:
            events = session.query(EventModel).all()
            return [{
                'id': event.id,
                'name': event.name,
                'date': event.date,
                'start_time': event.start_time,
                'end_time': event.end_time,
                'location': event.location,
                'notes': event.notes,
                'quick_turn': event.quick_turn,
                'deadline': event.deadline,
                'process_point': getattr(event, 'process_point', 'idle'),
                'project_id': event.project_id
            } for event in events], 200
        except Exception as e:
            return {'error': str(e)}, 500
        finally:
            session.close()

    def post(self):
        """Create a new event"""
        session = Session()
        try:
            data = request.get_json()
            # Normalize project_id (client sends as string)
            raw_project_id = data.get('project_id')
            project_id = None
            if raw_project_id not in (None, ''):
                try:
                    project_id = int(raw_project_id)
                except (TypeError, ValueError):
                    return {'error': 'Invalid project_id'}, 400

            new_event = EventModel(
                name=data['name'],
                date=data['date'],
                start_time=data.get('start_time'),
                end_time=data.get('end_time'),
                location=data.get('location'),
                notes=data.get('notes'),
                quick_turn=data.get('quick_turn', False),
                deadline= data.get('deadline'),
                process_point=data.get('process_point', 'idle'),
                project_id=project_id
            )
            
            session.add(new_event)
            session.commit()
            
            return {
                'id': new_event.id,
                'name': new_event.name,
                'date': new_event.date,
                'start_time': new_event.start_time,
                'end_time': new_event.end_time,
                'location': new_event.location,
                'notes': new_event.notes,
                'quick_turn': new_event.quick_turn,
                'deadline': new_event.deadline,
                'process_point': getattr(new_event, 'process_point', 'idle'),
                'project_id': new_event.project_id
            }, 201
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()


class EventDetail(Resource):
    def get(self, event_id):
        """Get a specific event"""
        session = Session()
        try:
            event = session.query(EventModel).filter_by(id=event_id).first()
            if event:
                return {
                    'id': event.id,
                    'name': event.name,
                    'date': event.date,
                    'start_time': event.start_time,
                    'end_time': event.end_time,
                    'location': event.location,
                    'notes': event.notes,
                    'quick_turn': event.quick_turn,
                    'deadline': event.deadline,
                    'project_id': event.project_id
                }, 200
            return {'error': 'Event not found'}, 404
        except Exception as e:
            return {'error': str(e)}, 500
        finally:
            session.close()

    def put(self, event_id):
        """Update an event"""
        session = Session()
        try:
            event = session.query(EventModel).filter_by(id=event_id).first()
            if not event:
                return {'error': 'Event not found'}, 404
            
            data = request.get_json()
            # Normalize project_id if included
            if 'project_id' in data:
                raw_project_id = data.get('project_id')
                if raw_project_id in (None, ''):
                    event.project_id = None
                else:
                    try:
                        event.project_id = int(raw_project_id)
                    except (TypeError, ValueError):
                        return {'error': 'Invalid project_id'}, 400

            for key, value in data.items():
                if key == 'project_id':
                    continue
                if hasattr(event, key):
                    setattr(event, key, value)
            
            session.commit()
            return {
                'id': event.id,
                'name': event.name,
                'date': event.date,
                'start_time': event.start_time,
                'end_time': event.end_time,
                'location': event.location,
                'notes': event.notes,
                'quick_turn': event.quick_turn,
                'deadline': event.deadline,
                'process_point': getattr(event, 'process_point', 'idle'),
                'project_id': event.project_id
            }, 200
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()

    def delete(self, event_id):
        """Delete an event"""
        session = Session()
        try:
            event = session.query(EventModel).filter_by(id=event_id).first()
            if not event:
                return {'error': 'Event not found'}, 404
            
            session.delete(event)
            session.commit()
            return {'message': 'Event deleted successfully'}, 200
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()


# Personnel endpoints
class PersonnelResource(Resource):
    def get(self):
        """Get all personnel"""
        session = Session()
        try:
            personnel = session.query(PersonnelModel).all()
            return [{
                'id': person.id,
                'name': person.name,
                'email': person.email,
                'phone': person.phone,
                'role': person.role,
                'avatar': person.avatar,
                'user_id': person.user_id,
                'event_ids': [event.id for event in person.events],
                'project_ids': [project.id for project in person.projects]
            } for person in personnel], 200
        except Exception as e:
            return {'error': str(e)}, 500
        finally:
            session.close()

    def post(self):
        """Create new personnel"""
        session = Session()
        try:
            data = request.get_json()
            new_personnel = PersonnelModel(
                name=data['name'],
                email=data.get('email'),
                phone=data.get('phone'),
                role=data.get('role'),
                avatar=data.get('avatar')
            )
            
            session.add(new_personnel)
            session.commit()
            
            return {
                'id': new_personnel.id,
                'name': new_personnel.name,
                'email': new_personnel.email,
                'phone': new_personnel.phone,
                'role': new_personnel.role,
                'avatar': new_personnel.avatar,
                'user_id': new_personnel.user_id
            }, 201
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()


class PersonnelDetail(Resource):
    def get(self, personnel_id):
        """Get a specific personnel"""
        session = Session()
        try:
            personnel = session.query(PersonnelModel).filter_by(id=personnel_id).first()
            if personnel:
                return {
                    'id': personnel.id,
                    'name': personnel.name,
                    'email': personnel.email,
                    'phone': personnel.phone,
                    'role': personnel.role,
                    'avatar': personnel.avatar,
                    'user_id': personnel.user_id,
                    'event_ids': [event.id for event in personnel.events],
                    'project_ids': [project.id for project in personnel.projects]
                }, 200
            return {'error': 'Personnel not found'}, 404
        except Exception as e:
            return {'error': str(e)}, 500
        finally:
            session.close()

    def put(self, personnel_id):
        """Update personnel"""
        session = Session()
        try:
            personnel = session.query(PersonnelModel).filter_by(id=personnel_id).first()
            if not personnel:
                return {'error': 'Personnel not found'}, 404
            
            data = request.get_json()
            
            # Handle event assignments
            if 'event_ids' in data:
                event_ids = data.pop('event_ids')  # Remove from data to avoid setattr
                
                # Clear existing event assignments
                personnel.events.clear()
                
                # Assign to new events
                if event_ids:
                    events = session.query(EventModel).filter(EventModel.id.in_(event_ids)).all()
                    personnel.events.extend(events)
                    
                    # Auto-assign to projects that these events belong to
                    project_ids = set()
                    for event in events:
                        if event.project_id:
                            project_ids.add(event.project_id)
                    
                    if project_ids:
                        # Clear existing project assignments
                        personnel.projects.clear()
                        # Assign to projects
                        projects = session.query(ProjectModel).filter(ProjectModel.id.in_(project_ids)).all()
                        personnel.projects.extend(projects)
            
            # Update other fields
            for key, value in data.items():
                if hasattr(personnel, key):
                    setattr(personnel, key, value)
            
            session.commit()
            
            # Return updated personnel with assignments
            event_ids = [event.id for event in personnel.events]
            project_ids = [project.id for project in personnel.projects]
            
            return {
                'id': personnel.id,
                'name': personnel.name,
                'email': personnel.email,
                'phone': personnel.phone,
                'role': personnel.role,
                'avatar': personnel.avatar,
                'user_id': personnel.user_id,
                'event_ids': event_ids,
                'project_ids': project_ids
            }, 200
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()

    def delete(self, personnel_id):
        """Delete personnel"""
        session = Session()
        try:
            personnel = session.query(PersonnelModel).filter_by(id=personnel_id).first()
            if not personnel:
                return {'error': 'Personnel not found'}, 404
            
            session.delete(personnel)
            session.commit()
            return {'message': 'Personnel deleted successfully'}, 200
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()


# Shot Request endpoints
class ShotRequests(Resource):
    def get(self):
        """Get all shot requests"""
        session = Session()
        try:
            shot_requests = session.query(ShotRequestModel).all()
            return [{
                'id': request.id,
                'request': request.request,
                'notes': request.notes,
                'quick_turn': request.quick_turn,
                'start_time': request.start_time,
                'end_time': request.end_time,
                'deadline': request.deadline,
                'process_point': getattr(request, 'process_point', 'idle')
            } for request in shot_requests], 200
        except Exception as e:
            return {'error': str(e)}, 500
        finally:
            session.close()

    def post(self):
        """Create a new shot request"""
        session = Session()
        try:
            data = request.get_json()
            new_request = ShotRequestModel(
                request=data['request'],
                notes=data.get('notes'),
                quick_turn=data.get('quick_turn', False),
                start_time=data.get('start_time'),
                end_time=data.get('end_time'),
                deadline=data.get('deadline')
            )
            
            session.add(new_request)
            session.flush()  # Get the ID before committing
            
            # If project_id is provided, associate with project
            project_id = data.get('project_id')
            if project_id:
                project = session.query(ProjectModel).filter_by(id=project_id).first()
                if project:
                    new_request.projects.append(project)
            
            # If event_id is provided, associate with event
            event_id = data.get('event_id')
            if event_id:
                event = session.query(EventModel).filter_by(id=event_id).first()
                if event:
                    new_request.events.append(event)
            
            session.commit()
            
            return {
                'id': new_request.id,
                'request': new_request.request,
                'notes': new_request.notes,
                'quick_turn': new_request.quick_turn,
                'start_time': new_request.start_time,
                'end_time': new_request.end_time,
                'deadline': new_request.deadline
            }, 201
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()


class ShotRequestDetail(Resource):
    def get(self, shot_request_id):
        """Get a specific shot request"""
        session = Session()
        try:
            shot_request = session.query(ShotRequestModel).filter_by(id=shot_request_id).first()
            if shot_request:
                return {
                    'id': shot_request.id,
                    'request': shot_request.request,
                    'notes': shot_request.notes,
                    'quick_turn': shot_request.quick_turn,
                    'start_time': shot_request.start_time,
                    'end_time': shot_request.end_time,
                    'deadline': shot_request.deadline,
                    'process_point': getattr(shot_request, 'process_point', 'idle')
                }, 200
            return {'error': 'Shot request not found'}, 404
        except Exception as e:
            return {'error': str(e)}, 500
        finally:
            session.close()

    def put(self, shot_request_id):
        """Update a shot request"""
        session = Session()
        try:
            shot_request = session.query(ShotRequestModel).filter_by(id=shot_request_id).first()
            if not shot_request:
                return {'error': 'Shot request not found'}, 404
            
            data = request.get_json()
            for key, value in data.items():
                if hasattr(shot_request, key):
                    setattr(shot_request, key, value)
            
            session.commit()
            return {
                'id': shot_request.id,
                'request': shot_request.request,
                'notes': shot_request.notes,
                'quick_turn': shot_request.quick_turn,
                'start_time': shot_request.start_time,
                'end_time': shot_request.end_time,
                'deadline': shot_request.deadline,
                'process_point': getattr(shot_request, 'process_point', 'idle')
            }, 200
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()

    def delete(self, shot_request_id):
        """Delete a shot request"""
        session = Session()
        try:
            shot_request = session.query(ShotRequestModel).filter_by(id=shot_request_id).first()
            if not shot_request:
                return {'error': 'Shot request not found'}, 404
            
            session.delete(shot_request)
            session.commit()
            return {'message': 'Shot request deleted successfully'}, 200
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()


# Image endpoints
class ImagesResource(Resource):
    def get(self):
        """Get all images"""
        session = Session()
        try:
            images = session.query(ImageModel).all()
            return [{
                'id': image.id,
                'file_path': image.file_path,
                'caption': image.caption,
                'event_id': image.event_id,
                'requests_id': image.requests_id
            } for image in images], 200
        except Exception as e:
            return {'error': str(e)}, 500
        finally:
            session.close()

    def post(self):
        """Create a new image record"""
        session = Session()
        try:
            data = request.get_json()
            new_image = ImageModel(
                filename=data['filename'],
                client_select=data.get('client_select', False),
                event_id=data.get('event_id'),
                requests_id=data.get('requests_id')
            )
            
            session.add(new_image)
            session.commit()
            
            return {
                'id': new_image.id,
                'file_path': new_image.file_path,
                'caption': new_image.caption,
                'event_id': new_image.event_id,
                'requests_id': new_image.requests_id
            }, 201
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()


class ImageDetail(Resource):
    def get(self, image_id):
        """Get a specific image"""
        session = Session()
        try:
            image = session.query(ImageModel).filter_by(id=image_id).first()
            if image:
                return {
                    'id': image.id,
                    'file_path': image.file_path,
                    'caption': image.caption,
                    'event_id': image.event_id,
                    'requests_id': image.requests_id
                }, 200
            return {'error': 'Image not found'}, 404
        except Exception as e:
            return {'error': str(e)}, 500
        finally:
            session.close()

    def put(self, image_id):
        """Update an image"""
        session = Session()
        try:
            image = session.query(ImageModel).filter_by(id=image_id).first()
            if not image:
                return {'error': 'Image not found'}, 404
            
            data = request.get_json()
            for key, value in data.items():
                if hasattr(image, key):
                    setattr(image, key, value)
            
            session.commit()
            return {
                'id': image.id,
                'file_path': image.file_path,
                'caption': image.caption,
                'event_id': image.event_id,
                'requests_id': image.requests_id
            }, 200
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()

    def delete(self, image_id):
        """Delete an image"""
        session = Session()
        try:
            image = session.query(ImageModel).filter_by(id=image_id).first()
            if not image:
                return {'error': 'Image not found'}, 404
            
            session.delete(image)
            session.commit()
            return {'message': 'Image deleted successfully'}, 200
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()


# Organization endpoints
class Organizations(Resource):
    def get(self):
        """Get all organizations"""
        session = Session()
        try:
            organizations = session.query(Organization).all()
            return [{
                'id': org.id,
                'name': org.name,
                'details': org.details
            } for org in organizations], 200
        except Exception as e:
            return {'error': str(e)}, 500
        finally:
            session.close()

    def post(self):
        """Create a new organization"""
        session = Session()
        try:
            data = request.get_json()
            new_org = Organization(
                name=data['name'],
                details=data.get('details')
            )
            session.add(new_org)
            session.commit()
            return {
                'id': new_org.id,
                'name': new_org.name,
                'details': new_org.details
            }, 201
        except IntegrityError as e:
            session.rollback()
            return {'error': 'Organization with this name already exists'}, 400
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()


class OrganizationDetail(Resource):
    def get(self, org_id):
        """Get a specific organization"""
        session = Session()
        try:
            org = session.query(Organization).filter_by(id=org_id).first()
            if org:
                return {
                    'id': org.id,
                    'name': org.name,
                    'details': org.details
                }, 200
            return {'error': 'Organization not found'}, 404
        except Exception as e:
            return {'error': str(e)}, 500
        finally:
            session.close()

    def put(self, org_id):
        """Update an organization"""
        session = Session()
        try:
            org = session.query(Organization).filter_by(id=org_id).first()
            if not org:
                return {'error': 'Organization not found'}, 404
            
            data = request.get_json()
            for key, value in data.items():
                if hasattr(org, key):
                    setattr(org, key, value)
            
            session.commit()
            return {
                'id': org.id,
                'name': org.name,
                'details': org.details
            }, 200
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()

    def delete(self, org_id):
        """Delete an organization"""
        session = Session()
        try:
            org = session.query(Organization).filter_by(id=org_id).first()
            if not org:
                return {'error': 'Organization not found'}, 404
            
            session.delete(org)
            session.commit()
            return {'message': 'Organization deleted successfully'}, 200
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()


# Access Request endpoints
class AccessRequests(Resource):
    def get(self):
        """Get all access requests"""
        session = get_session()
        try:
            requests = session.query(AccessRequest).filter_by(status='pending').all()
            return [{
                'id': req.id,
                'name': req.name,
                'email': req.email,
                'organization': req.organization,
                'phone': req.phone,
                'requested_access': req.requested_access,
                'message': req.message,
                'created_at': req.created_at,
                'status': req.status
            } for req in requests], 200
        except Exception as e:
            return {'error': str(e)}, 500
        finally:
            session.close()

    def post(self):
        """Create a new access request"""
        session = get_session()
        try:
            data = request.get_json()
            
            # Check if request already exists for this email
            existing = session.query(AccessRequest).filter_by(
                email=data['email'], 
                status='pending'
            ).first()
            
            if existing:
                return {'error': 'Access request already pending for this email'}, 400
            
            new_request = AccessRequest(
                name=data['name'],
                email=data['email'],
                organization=data['organization'],
                phone=data.get('phone'),
                requested_access=data.get('requested_access'),
                message=data.get('message'),
                created_at=data.get('created_at')
            )
            
            session.add(new_request)
            session.commit()
            
            return {
                'id': new_request.id,
                'name': new_request.name,
                'email': new_request.email,
                'organization': new_request.organization,
                'status': new_request.status
            }, 201
            
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()


class AccessRequestDetail(Resource):
    def get(self, request_id):
        """Get a specific access request"""
        session = get_session()
        try:
            req = session.query(AccessRequest).filter_by(id=request_id).first()
            if req:
                return {
                    'id': req.id,
                    'name': req.name,
                    'email': req.email,
                    'organization': req.organization,
                    'phone': req.phone,
                    'requested_access': req.requested_access,
                    'message': req.message,
                    'created_at': req.created_at,
                    'status': req.status
                }, 200
            return {'error': 'Access request not found'}, 404
        except Exception as e:
            return {'error': str(e)}, 500
        finally:
            session.close()

    def put(self, request_id):
        """Process an access request (approve/deny)"""
        session = get_session()
        try:
            data = request.get_json()
            req = session.query(AccessRequest).filter_by(id=request_id).first()
            
            if not req:
                return {'error': 'Access request not found'}, 404
            
            action = data.get('action')  # 'approve' or 'deny'
            
            if action == 'approve':
                # Create new user
                new_user = User(
                    name=req.name,
                    email=req.email,
                    access=data.get('role', 'Client'),
                    avatar=data.get('avatar', 'default-avatar.png'),
                    organization_id=data.get('organization_id')
                )
                temporary_password = data.get('temporary_password', 'temp123')
                new_user.set_password(temporary_password)
                
                session.add(new_user)
                session.flush()  # Get the user ID
                
                # Optionally create personnel record
                if data.get('create_personnel', False):
                    new_personnel = PersonnelModel(
                        name=req.name,
                        email=req.email,
                        phone=req.phone or data.get('phone', ''),  # Use request phone first, then approval phone
                        role=data.get('role', 'Staff'),
                        user_id=new_user.id
                    )
                    session.add(new_personnel)
                
                req.status = 'approved'
                req.processed_at = data.get('processed_at')
                req.processed_by = data.get('processed_by')
                
                # Get organization name for email
                organization = session.query(Organization).filter_by(id=data.get('organization_id')).first()
                organization_name = organization.name if organization else req.organization
                
                session.commit()
                
                # Send approval email
                email_sent = send_approval_email(
                    recipient_email=req.email,
                    recipient_name=req.name,
                    login_email=req.email,
                    temporary_password=temporary_password,
                    organization_name=organization_name
                )
                
                response_message = 'Access request approved and user created'
                if email_sent:
                    response_message += '. Approval email sent successfully.'
                else:
                    response_message += '. Note: Failed to send approval email.'
                
                return {
                    'message': response_message,
                    'user_id': new_user.id,
                    'email_sent': email_sent
                }, 200
                
            elif action == 'deny':
                req.status = 'denied'
                req.processed_at = data.get('processed_at')
                req.processed_by = data.get('processed_by')
                
                session.commit()
                
                return {'message': 'Access request denied'}, 200
            
            else:
                return {'error': 'Invalid action. Use "approve" or "deny"'}, 400
                
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()

    def delete(self, request_id):
        """Delete an access request"""
        session = get_session()
        try:
            req = session.query(AccessRequest).filter_by(id=request_id).first()
            if req:
                session.delete(req)
                session.commit()
                return {'message': 'Access request deleted'}, 200
            return {'error': 'Access request not found'}, 404
        except Exception as e:
            session.rollback()
            return {'error': str(e)}, 500
        finally:
            session.close()


# API Routes
api.add_resource(Users, '/api/users')
api.add_resource(UserDetail, '/api/users/<int:user_id>')
api.add_resource(UserLogin, '/api/login')
api.add_resource(UserSchedule, '/api/users/<int:user_id>/schedule')
api.add_resource(ProjectsResource, '/api/projects')
api.add_resource(ProjectDetail, '/api/projects/<int:project_id>')
api.add_resource(EventsResource, '/api/events')
api.add_resource(EventDetail, '/api/events/<int:event_id>')
api.add_resource(PersonnelResource, '/api/personnel')
api.add_resource(PersonnelDetail, '/api/personnel/<int:personnel_id>')
api.add_resource(ShotRequests, '/api/shot-requests')
api.add_resource(ShotRequestDetail, '/api/shot-requests/<int:shot_request_id>')
api.add_resource(ImagesResource, '/api/images')
api.add_resource(ImageDetail, '/api/images/<int:image_id>')
api.add_resource(Organizations, '/api/organizations')
api.add_resource(OrganizationDetail, '/api/organizations/<int:org_id>')
api.add_resource(AccessRequests, '/api/access-requests')
api.add_resource(AccessRequestDetail, '/api/access-requests/<int:request_id>')


@app.route('/')
def home():
    return {'message': 'Relay API is running!'}


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)

