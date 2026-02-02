"""Pydantic schemas for cable configuration."""
from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional


class TerminalConfigCreate(BaseModel):
    """Create terminal config."""
    terminal_marker_id: int
    address: Optional[str] = None
    suggested_size: int
    actual_size: int
    order: int


class TerminalConfigResponse(TerminalConfigCreate):
    """Terminal config response."""
    id: int
    cable_config_id: int
    created_at: datetime
    updated_at: datetime


class CableConfigCreate(BaseModel):
    """Create cable config."""
    cable_number: int
    cable_type: str  # "BAU" or "FNAP"
    cable_size: int
    order: int


class CableConfigResponse(CableConfigCreate):
    """Cable config response."""
    id: int
    cable_config_id: int
    created_at: datetime
    updated_at: datetime


class TeatherSplicerCreate(BaseModel):
    """Create teather splicer."""
    cable_id: int
    target_cable_id: int
    divert_count: int


class TeatherSplicerResponse(TeatherSplicerCreate):
    """Teather splicer response."""
    id: int
    cable_config_id: int
    created_at: datetime
    updated_at: datetime


class CableConfigurationCreate(BaseModel):
    """Create cable configuration."""
    name: Optional[str] = None
    terminals: List[TerminalConfigCreate] = []
    cables: List[CableConfigCreate] = []
    teathers: List[TeatherSplicerCreate] = []


class CableConfigurationResponse(BaseModel):
    """Cable configuration response."""
    id: int
    project_id: int
    name: Optional[str]
    terminals: List[TerminalConfigResponse] = []
    cables: List[CableConfigResponse] = []
    teathers: List[TeatherSplicerResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
