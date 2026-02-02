"""Cable configuration models for cable builder."""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.database import Base


class CableConfiguration(Base):
    """Project-wide cable configuration."""
    __tablename__ = "cable_configurations"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    project = relationship("Project", back_populates="cable_configuration")
    terminals = relationship("TerminalConfig", back_populates="cable_config", cascade="all, delete-orphan")
    cables = relationship("CableConfig", back_populates="cable_config", cascade="all, delete-orphan")
    teathers = relationship("TeatherSplicer", back_populates="cable_config", cascade="all, delete-orphan")


class TerminalConfig(Base):
    """Terminal configuration for cable builder."""
    __tablename__ = "terminal_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    cable_config_id = Column(Integer, ForeignKey("cable_configurations.id"))
    terminal_marker_id = Column(Integer, ForeignKey("markers.id"))
    address = Column(String, nullable=True)
    suggested_size = Column(Integer)  # 4, 6, 8, 12
    actual_size = Column(Integer)     # User selected size
    order = Column(Integer)            # Display order (drag-and-drop)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    cable_config = relationship("CableConfiguration", back_populates="terminals")
    marker = relationship("Marker", foreign_keys=[terminal_marker_id])


class CableConfig(Base):
    """Cable configuration for cable builder."""
    __tablename__ = "cable_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    cable_config_id = Column(Integer, ForeignKey("cable_configurations.id"))
    cable_number = Column(Integer)     # 1, 2, 3, etc.
    cable_type = Column(String)        # "BAU" or "FNAP"
    cable_size = Column(Integer)       # 24, 48, 72, 144, 216, 288, 432, 864
    order = Column(Integer)            # Display order (drag-and-drop)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    cable_config = relationship("CableConfiguration", back_populates="cables")
    teathers_from = relationship("TeatherSplicer", foreign_keys="TeatherSplicer.cable_id", back_populates="cable")
    teathers_to = relationship("TeatherSplicer", foreign_keys="TeatherSplicer.target_cable_id", back_populates="target_cable")


class TeatherSplicer(Base):
    """Teather splicer connecting cables."""
    __tablename__ = "teather_splicers"
    
    id = Column(Integer, primary_key=True, index=True)
    cable_config_id = Column(Integer, ForeignKey("cable_configurations.id"))
    cable_id = Column(Integer, ForeignKey("cable_configs.id"))
    target_cable_id = Column(Integer, ForeignKey("cable_configs.id"))
    divert_count = Column(Integer)     # 12, 24, 36, 48 strands
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    cable_config = relationship("CableConfiguration", back_populates="teathers")
    cable = relationship("CableConfig", foreign_keys=[cable_id], back_populates="teathers_from")
    target_cable = relationship("CableConfig", foreign_keys=[target_cable_id], back_populates="teathers_to")
