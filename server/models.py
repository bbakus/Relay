from sqlalchemy import Column, Integer, Float, Boolean, String, Table, ForeignKey, create_engine
from sqlalchemy_serializer import SerializerMixin
from werkzeug.security import check_password_hash, generate_password_hash
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker


Base = declarative_base()

# PostgreSQL connection URL
DATABASE_URL = 'postgresql://brandonbakus:password123@localhost:5432/relay_db'



# Association tables for many-to-many relationships
event_request_association_table = Table(
    'event_request_association',
    Base.metadata,
    Column('event_id', Integer, ForeignKey('events.id'), primary_key=True),
    Column('shot_request_id', Integer, ForeignKey('shot_requests.id'), primary_key=True)
)

personnel_event_association_table = Table(
    'personnel_event_association',
    Base.metadata,
    Column('personnel_id', Integer, ForeignKey('personnels.id'), primary_key=True),
    Column('event_id', Integer, ForeignKey('events.id'), primary_key=True)
)

personnel_shot_request_association_table = Table(
    'personnel_shot_request_association',
    Base.metadata,
    Column('personnel_id', Integer, ForeignKey('personnels.id'), primary_key=True),
    Column('shot_request_id', Integer, ForeignKey('shot_requests.id'), primary_key=True)
)

project_requests_association_table = Table(
    'project_requests_association',
    Base.metadata,
    Column('project_id', Integer, ForeignKey('projects.id'), primary_key=True),
    Column('shot_request_id', Integer, ForeignKey('shot_requests.id'), primary_key=True)
)

project_personnel_association_table = Table(
    'project_personnel_association',
    Base.metadata,
    Column('project_id', Integer, ForeignKey('projects.id'), primary_key=True),
    Column('personnel_id', Integer, ForeignKey('personnels.id'), primary_key=True)
)



class User(Base, SerializerMixin):

    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    access = Column(String, nullable=False) # Admin, Client, Coordinator, Photographer, Videographer, Editor
    avatar = Column(String, default='avatar1.png') # Avatar image filename
    # Organization relationship: many users -> one organization
    organization_id = Column(Integer, ForeignKey('organizations.id', ondelete='SET NULL'))
    organization = relationship('Organization', back_populates='users')
    # 1-1 link to Personnel (optional)
    personnel = relationship('Personnel', back_populates='user', uselist=False)

    def set_password(self, password):
        """Hash and set the password"""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Check if the provided password matches the hash"""
        return check_password_hash(self.password_hash, password)

    


class Events(Base, SerializerMixin):
    __tablename__ = 'events'

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    date = Column(String, nullable=False)
    start_time = Column(String)
    end_time = Column(String)
    location = Column(String)
    notes = Column(String)
    quick_turn = Column(Boolean)
    deadline = Column(String)
    # Pipeline/process point for coloring the schedule card
    # allowed values: idle, ingest, cull, color, delivered
    process_point = Column(String, default='idle')
    # Column assignment for schedule (0-3 for the 4 columns)
    column_number = Column(Integer, default=0)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete='CASCADE'))

    # Relationships
    shot_requests = relationship('ShotRequest', secondary=event_request_association_table, back_populates='events')
    personnels = relationship('Personnel', secondary=personnel_event_association_table, back_populates='events')
    project = relationship('Project', back_populates='events')
    images = relationship('Image', back_populates='event', cascade='all, delete-orphan')


class ShotRequest(Base, SerializerMixin):
    __tablename__ = 'shot_requests'

    id = Column(Integer, primary_key=True)
    request = Column(String, nullable=False)
    notes = Column(String)
    quick_turn = Column(Boolean)
    start_time = Column(String)
    end_time = Column(String)
    deadline = Column(String)
    process_point = Column(String, default='idle')

    # Relationships
    events = relationship('Events', secondary=event_request_association_table, back_populates='shot_requests')
    personnels = relationship('Personnel', secondary=personnel_shot_request_association_table, back_populates='shot_requests')
    projects = relationship('Project', secondary=project_requests_association_table, back_populates='shot_requests')
    images = relationship('Image', back_populates='shot_request', cascade='all, delete-orphan')


class Personnel(Base, SerializerMixin):
    __tablename__ = 'personnels'

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String)
    phone = Column(String)
    role = Column(String)
    avatar = Column(String)
    # Optional 1-1 link back to User
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), unique=True)
    user = relationship('User', back_populates='personnel')

    # Relationships
    events = relationship('Events', secondary=personnel_event_association_table, back_populates='personnels')
    shot_requests = relationship('ShotRequest', secondary=personnel_shot_request_association_table, back_populates='personnels')
    projects = relationship('Project', secondary=project_personnel_association_table, back_populates='personnels')


class Project(Base, SerializerMixin):
    __tablename__ = 'projects'

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=False)
    start_date = Column(String, nullable=False)
    end_date = Column(String, nullable=False)
    deliver_date = Column(String)
    # Organization relationship: many projects -> one organization
    organization_id = Column(Integer, ForeignKey('organizations.id', ondelete='CASCADE'))
    organization = relationship('Organization', back_populates='projects')
    
    # Relationships
    events = relationship('Events', back_populates='project', cascade='all, delete-orphan')
    shot_requests = relationship('ShotRequest', secondary=project_requests_association_table, back_populates='projects')
    personnels = relationship('Personnel', secondary=project_personnel_association_table, back_populates='projects')


class Image(Base, SerializerMixin):

    __tablename__ = 'images'

    id = Column(Integer, primary_key=True)
    filename = Column(String, nullable=False)
    file_path = Column(String)  # Full path to the image file
    thumbnail_path = Column(String)  # Path to thumbnail for gallery view
    client_select = Column(Boolean, default=False)
    favorite = Column(Boolean, default=False)  # User favorite flag
    upload_date = Column(String)  # When the image was uploaded
    file_size = Column(Integer)  # File size in bytes

    event_id = Column(Integer, ForeignKey('events.id', ondelete='CASCADE'))
    requests_id = Column(Integer, ForeignKey('shot_requests.id', ondelete='CASCADE'))

    # Relationships
    event = relationship('Events', back_populates='images')
    shot_request = relationship('ShotRequest', back_populates='images')


class Organization(Base, SerializerMixin):

    __tablename__ = 'organizations'

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    details = Column(String)
    
    # One organization -> many projects, many users
    projects = relationship('Project', back_populates='organization')
    users = relationship('User', back_populates='organization')


class AccessRequest(Base):
    __tablename__ = 'access_requests'
    
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    organization = Column(String, nullable=False)
    phone = Column(String)  # Phone number from requester
    requested_access = Column(String)  # Optional - requested role
    message = Column(String)  # Optional message from requester
    status = Column(String, default='pending')  # pending, approved, denied
    created_at = Column(String)  # We'll store as ISO string for simplicity
    processed_at = Column(String)  # When approved/denied
    processed_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'))  # Admin who processed




# Database initialization
def init_db():
    """Initialize the database with all tables"""
    engine = create_engine(DATABASE_URL)
    Base.metadata.create_all(engine)
    return engine


def get_session():
    """Create a new database session"""
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    return Session()


def create_admin_user():
    """Create the default admin user"""
    session = get_session()
    
    # Ensure default organization exists
    org = session.query(Organization).filter_by(name='Relay').first()
    if not org:
        org = Organization(name='Relay', details='Default organization')
        session.add(org)
        session.commit()

    # Check if admin already exists
    admin = session.query(User).filter_by(email='admin@relay.com').first()
    if not admin:
        admin = User(
            name='admin',
            email='admin@relay.com',
            access='Admin',
            organization=org
        )
        admin.set_password('password123')  # Hash the password
        session.add(admin)
        session.commit()
        print("Admin user created successfully!")
    else:
        print("Admin user already exists!")
    
    session.close()




if __name__ == "__main__":
    # Create all tables when running this file directly
    init_db()
    print("Database tables created successfully!")
    
    # Create admin user
    create_admin_user()




