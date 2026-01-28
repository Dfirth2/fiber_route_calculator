from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# Point schema
class Point(BaseModel):
    x: float
    y: float

# Scale calibration schemas
class ScaleCalibration(BaseModel):
    method: str  # "manual" or "two_point"
    scale_factor: float  # feet per PDF unit
    manual_scale_str: Optional[str] = None  # e.g., "1 inch = 50 feet"
    point_a: Optional[Point] = None
    point_b: Optional[Point] = None
    known_distance_ft: Optional[float] = None

class ScaleCalibrationResponse(ScaleCalibration):
    id: int
    page_number: int
    created_at: datetime

# Polyline/Path schemas
class PolylineCreate(BaseModel):
    name: str
    points: List[Point]
    page_number: int
    description: Optional[str] = None

class PolylineUpdate(BaseModel):
    name: Optional[str] = None
    points: Optional[List[Point]] = None
    description: Optional[str] = None

class PolylineResponse(PolylineCreate):
    id: int
    project_id: int
    length_ft: float
    created_at: datetime
    updated_at: datetime

# Marker schemas
class MarkerCreate(BaseModel):
    page_number: int
    marker_type: str  # "terminal" or "dropPed"
    x: float
    y: float

class MarkerResponse(MarkerCreate):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

# Marker Link schemas
class MarkerLinkCreate(BaseModel):
    marker_id: int
    page_number: int
    to_x: float
    to_y: float

class MarkerLinkResponse(MarkerLinkCreate):
    id: int
    created_at: datetime
    updated_at: datetime

# Conduit schemas
class ConduitCreate(BaseModel):
    page_number: int
    terminal_id: int
    drop_ped_id: int
    footage: float

class ConduitResponse(ConduitCreate):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

# Project schemas
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    project_number: Optional[str] = None
    devlog_number: Optional[str] = None
    pon_cable_name: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    project_number: Optional[str] = None
    devlog_number: Optional[str] = None
    pon_cable_name: Optional[str] = None

class ProjectResponse(ProjectCreate):
    id: int
    pdf_filename: str
    page_count: int
    total_length_ft: float
    project_number: Optional[str] = None
    devlog_number: Optional[str] = None
    pon_cable_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class ProjectDetail(ProjectResponse):
    polylines: List[PolylineResponse]
    scale_calibrations: List[ScaleCalibrationResponse]
    scale_calibrations: List[ScaleCalibrationResponse]

# Export schemas
class ExportRequest(BaseModel):
    format: str  # "csv" or "pdf"
    include_slack_factor: Optional[float] = None  # e.g., 0.05 for 5%

class ExportResponse(BaseModel):
    filename: str
    content_type: str
    size: int

# Measurement response
class MeasurementResponse(BaseModel):
    polyline_id: int
    polyline_name: str
    length_ft: float
    segment_count: int
    page_number: int

class TotalMeasurementResponse(BaseModel):
    total_length_ft: float
    total_segments: int
    polyline_count: int
    measurements: List[MeasurementResponse]
