from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    projects = relationship("Project", back_populates="owner")

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    pdf_filename = Column(String, unique=True)
    pdf_s3_key = Column(String, nullable=True)
    total_length_ft = Column(Float, default=0.0)
    page_count = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    owner = relationship("User", back_populates="projects")
    polylines = relationship("Polyline", back_populates="project", cascade="all, delete-orphan")
    scale_calibrations = relationship("ScaleCalibration", back_populates="project", cascade="all, delete-orphan")

class ScaleCalibration(Base):
    __tablename__ = "scale_calibrations"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    page_number = Column(Integer)
    method = Column(String)  # "manual" or "two_point"
    scale_factor = Column(Float)  # feet per PDF unit
    manual_scale_str = Column(String, nullable=True)  # e.g., "1 inch = 50 feet"
    point_a = Column(JSON, nullable=True)  # {x: float, y: float}
    point_b = Column(JSON, nullable=True)  # {x: float, y: float}
    known_distance_ft = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="scale_calibrations")

class Polyline(Base):
    __tablename__ = "polylines"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String)
    description = Column(Text, nullable=True)
    page_number = Column(Integer)
    points = Column(JSON)  # [{x: float, y: float}, ...]
    length_ft = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    project = relationship("Project", back_populates="polylines")
