from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import os
import shutil
import uuid

from app.db.database import get_db
from app.models.database import Project, Polyline, ScaleCalibration, Marker, MarkerLink, Conduit
from app.models.schemas import (
    ProjectCreate, ProjectResponse, ProjectDetail,
    PolylineCreate, PolylineResponse,
    ScaleCalibration as ScaleCalibrationSchema,
    MarkerCreate, MarkerResponse,
    MarkerLinkCreate, MarkerLinkResponse,
    ConduitCreate, ConduitResponse,
)
from app.services.geometry import (
    calculate_polyline_length_ft,
    calculate_two_point_scale,
    parse_manual_scale,
)
from app.services.pdf_handler import validate_pdf_file, get_pdf_info
from app.config import settings

router = APIRouter(prefix="/api/projects", tags=["projects"])

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

@router.post("/", response_model=ProjectResponse)
def create_project(
    name: str = Form(...),
    description: str = Form(None),
    pdf_file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Create a new project with a PDF upload."""
    
    # Enforce unique project names (case-insensitive)
    existing = db.query(Project).filter(func.lower(Project.name) == name.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Project name already exists")

    # Generate unique filename to avoid conflicts
    file_ext = os.path.splitext(pdf_file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    temp_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
    
    try:
        # Save uploaded file temporarily
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(pdf_file.file, f)
        
        # Validate it's a valid PDF
        is_valid, message = validate_pdf_file(temp_path)
        if not is_valid:
            os.remove(temp_path)
            raise HTTPException(status_code=400, detail=f"Invalid PDF: {message}")
        
        # Get PDF info
        pdf_info = get_pdf_info(temp_path)
        
        # Create project in database
        db_project = Project(
            name=name,
            description=description,
            pdf_filename=unique_filename,
            page_count=pdf_info.get("page_count", 1),
        )
        db.add(db_project)
        db.commit()
        db.refresh(db_project)
        
        return ProjectResponse(
            id=db_project.id,
            name=db_project.name,
            description=db_project.description,
            pdf_filename=db_project.pdf_filename,
            page_count=db_project.page_count,
            total_length_ft=0.0,
            created_at=db_project.created_at,
            updated_at=db_project.updated_at,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[ProjectResponse])
def list_projects(db: Session = Depends(get_db)):
    """List all projects."""
    projects = db.query(Project).all()
    return [
        ProjectResponse(
            id=p.id,
            name=p.name,
            description=p.description,
            pdf_filename=p.pdf_filename,
            page_count=p.page_count,
            total_length_ft=p.total_length_ft,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in projects
    ]

@router.get("/{project_id}/pdf")
def get_project_pdf(project_id: int, db: Session = Depends(get_db)):
    """Download the PDF file for a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    pdf_path = os.path.join(settings.UPLOAD_DIR, project.pdf_filename)
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF file not found")
    
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=project.pdf_filename
    )

@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(project_id: int, db: Session = Depends(get_db)):
    """Get project with all details."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    polylines = db.query(Polyline).filter(Polyline.project_id == project_id).all()
    scale_calibrations = db.query(ScaleCalibration).filter(
        ScaleCalibration.project_id == project_id
    ).all()
    
    return ProjectDetail(
        id=project.id,
        name=project.name,
        description=project.description,
        pdf_filename=project.pdf_filename,
        page_count=project.page_count,
        total_length_ft=project.total_length_ft,
        created_at=project.created_at,
        updated_at=project.updated_at,
        polylines=[
            PolylineResponse(
                id=p.id,
                project_id=p.project_id,
                name=p.name,
                description=p.description,
                page_number=p.page_number,
                points=p.points,
                length_ft=p.length_ft,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
            for p in polylines
        ],
        scale_calibrations=[
            {
                "id": sc.id,
                "page_number": sc.page_number,
                "method": sc.method,
                "scale_factor": sc.scale_factor,
                "manual_scale_str": sc.manual_scale_str,
                "point_a": sc.point_a,
                "point_b": sc.point_b,
                "known_distance_ft": sc.known_distance_ft,
                "created_at": sc.created_at,
            }
            for sc in scale_calibrations
        ],
    )

@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    """Delete a project and its associated data."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Delete the PDF file
    pdf_path = os.path.join(settings.UPLOAD_DIR, project.pdf_filename)
    if os.path.exists(pdf_path):
        os.remove(pdf_path)
    
    # Delete from database (cascades to polylines and calibrations)
    db.delete(project)
    db.commit()
    
    return {"message": "Project deleted"}

@router.get("/{project_id}/scale-calibrations", response_model=List[ScaleCalibrationSchema])
def get_scale_calibrations(
    project_id: int,
    db: Session = Depends(get_db),
):
    """Get all scale calibrations for a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    calibrations = db.query(ScaleCalibration).filter(
        ScaleCalibration.project_id == project_id
    ).all()
    
    return calibrations


@router.post("/{project_id}/scale-calibrations", response_model=ScaleCalibrationSchema)
def create_scale_calibration(
    project_id: int,
    calibration: ScaleCalibrationSchema,
    db: Session = Depends(get_db),
):
    """Create or update scale calibration for a project page."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if calibration already exists for this page
    existing = db.query(ScaleCalibration).filter(
        ScaleCalibration.project_id == project_id,
        ScaleCalibration.page_number == calibration.page_number if hasattr(calibration, 'page_number') else True,
    ).first()
    
    if existing:
        existing.method = calibration.method
        existing.scale_factor = calibration.scale_factor
        existing.manual_scale_str = calibration.manual_scale_str
        existing.point_a = calibration.point_a.dict() if calibration.point_a else None
        existing.point_b = calibration.point_b.dict() if calibration.point_b else None
        existing.known_distance_ft = calibration.known_distance_ft
    else:
        # Create new calibration
        db_calib = ScaleCalibration(
            project_id=project_id,
            page_number=getattr(calibration, 'page_number', 1),
            method=calibration.method,
            scale_factor=calibration.scale_factor,
            manual_scale_str=calibration.manual_scale_str,
            point_a=calibration.point_a.dict() if calibration.point_a else None,
            point_b=calibration.point_b.dict() if calibration.point_b else None,
            known_distance_ft=calibration.known_distance_ft,
        )
        db.add(db_calib)
    
    db.commit()
    return calibration

@router.get("/{project_id}/polylines", response_model=List[PolylineResponse])
def get_polylines(project_id: int, db: Session = Depends(get_db)):
    """Get all polylines for a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    polylines = db.query(Polyline).filter(Polyline.project_id == project_id).all()
    return polylines

@router.post("/{project_id}/polylines", response_model=PolylineResponse)
def create_polyline(
    project_id: int,
    polyline: PolylineCreate,
    db: Session = Depends(get_db),
):
    """Create a new polyline (fiber route) in a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get the scale factor for this page
    scale_calib = db.query(ScaleCalibration).filter(
        ScaleCalibration.project_id == project_id,
        ScaleCalibration.page_number == polyline.page_number,
    ).first()
    
    if not scale_calib:
        raise HTTPException(
            status_code=400,
            detail=f"No scale calibration for page {polyline.page_number}"
        )
    
    # Calculate length
    points_dicts = [p.dict() for p in polyline.points]
    length_ft = calculate_polyline_length_ft(points_dicts, scale_calib.scale_factor)
    
    # Create polyline
    db_polyline = Polyline(
        project_id=project_id,
        name=polyline.name,
        description=polyline.description,
        page_number=polyline.page_number,
        points=points_dicts,
        length_ft=length_ft,
    )
    db.add(db_polyline)
    
    # Update project total length
    project.total_length_ft += length_ft
    project.updated_at = func.now()
    
    db.commit()
    db.refresh(db_polyline)
    
    return PolylineResponse(
        id=db_polyline.id,
        project_id=db_polyline.project_id,
        name=db_polyline.name,
        description=db_polyline.description,
        page_number=db_polyline.page_number,
        points=db_polyline.points,
        length_ft=db_polyline.length_ft,
        created_at=db_polyline.created_at,
        updated_at=db_polyline.updated_at,
    )

@router.put("/{project_id}/polylines/{polyline_id}", response_model=PolylineResponse)
def update_polyline(
    project_id: int,
    polyline_id: int,
    update_data: dict,
    db: Session = Depends(get_db),
):
    """Update an existing polyline."""
    polyline = db.query(Polyline).filter(
        Polyline.id == polyline_id,
        Polyline.project_id == project_id,
    ).first()
    
    if not polyline:
        raise HTTPException(status_code=404, detail="Polyline not found")
    
    project = db.query(Project).filter(Project.id == project_id).first()
    
    # Update fields
    if "name" in update_data:
        polyline.name = update_data["name"]
    
    if "description" in update_data:
        polyline.description = update_data["description"]
    
    if "points" in update_data:
        # Recalculate length
        points_dicts = update_data["points"]
        scale_calib = db.query(ScaleCalibration).filter(
            ScaleCalibration.project_id == project_id,
            ScaleCalibration.page_number == polyline.page_number,
        ).first()
        
        if scale_calib:
            new_length = calculate_polyline_length_ft(points_dicts, scale_calib.scale_factor)
            # Update project total
            project.total_length_ft -= polyline.length_ft
            project.total_length_ft += new_length
            polyline.length_ft = new_length
        
        polyline.points = points_dicts
    
    db.commit()
    db.refresh(polyline)
    
    return PolylineResponse(
        id=polyline.id,
        project_id=polyline.project_id,
        name=polyline.name,
        description=polyline.description,
        page_number=polyline.page_number,
        points=polyline.points,
        length_ft=polyline.length_ft,
        created_at=polyline.created_at,
        updated_at=polyline.updated_at,
    )

@router.delete("/{project_id}/polylines/{polyline_id}")
def delete_polyline(
    project_id: int,
    polyline_id: int,
    db: Session = Depends(get_db),
):
    """Delete a polyline."""
    polyline = db.query(Polyline).filter(
        Polyline.id == polyline_id,
        Polyline.project_id == project_id,
    ).first()
    
    if not polyline:
        raise HTTPException(status_code=404, detail="Polyline not found")
    
    project = db.query(Project).filter(Project.id == project_id).first()
    project.total_length_ft -= polyline.length_ft
    
    db.delete(polyline)
    db.commit()
    
    return {"message": "Polyline deleted"}

# Marker endpoints
@router.post("/{project_id}/markers", response_model=MarkerResponse)
def create_marker(
    project_id: int,
    marker: MarkerCreate,
    db: Session = Depends(get_db),
):
    """Create a marker (terminal or drop pedestal)."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db_marker = Marker(
        project_id=project_id,
        page_number=marker.page_number,
        marker_type=marker.marker_type,
        x=marker.x,
        y=marker.y,
    )
    db.add(db_marker)
    db.commit()
    db.refresh(db_marker)
    return db_marker


@router.get("/{project_id}/markers", response_model=List[MarkerResponse])
def get_markers(
    project_id: int,
    page_number: int = None,
    db: Session = Depends(get_db),
):
    """Get markers for a project, optionally filtered by page."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    query = db.query(Marker).filter(Marker.project_id == project_id)
    if page_number is not None:
        query = query.filter(Marker.page_number == page_number)
    
    return query.all()


@router.delete("/{project_id}/markers/{marker_id}")
def delete_marker(
    project_id: int,
    marker_id: int,
    db: Session = Depends(get_db),
):
    """Delete a marker."""
    marker = db.query(Marker).filter(
        Marker.id == marker_id,
        Marker.project_id == project_id,
    ).first()
    
    if not marker:
        raise HTTPException(status_code=404, detail="Marker not found")
    
    db.delete(marker)
    db.commit()
    
    return {"message": "Marker deleted"}


# Marker Link endpoints
@router.post("/{project_id}/marker-links", response_model=MarkerLinkResponse)
def create_marker_link(
    project_id: int,
    link: MarkerLinkCreate,
    db: Session = Depends(get_db),
):
    """Create a marker assignment link."""
    marker = db.query(Marker).filter(
        Marker.id == link.marker_id,
        Marker.project_id == project_id,
    ).first()
    
    if not marker:
        raise HTTPException(status_code=404, detail="Marker not found")
    
    db_link = MarkerLink(
        marker_id=link.marker_id,
        page_number=link.page_number,
        to_x=link.to_x,
        to_y=link.to_y,
    )
    db.add(db_link)
    db.commit()
    db.refresh(db_link)
    return db_link


@router.get("/{project_id}/marker-links", response_model=List[MarkerLinkResponse])
def get_marker_links(
    project_id: int,
    page_number: int = None,
    db: Session = Depends(get_db),
):
    """Get marker links for a project, optionally filtered by page."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    query = db.query(MarkerLink).join(Marker).filter(Marker.project_id == project_id)
    if page_number is not None:
        query = query.filter(MarkerLink.page_number == page_number)
    
    return query.all()


@router.delete("/{project_id}/marker-links/{link_id}")
def delete_marker_link(
    project_id: int,
    link_id: int,
    db: Session = Depends(get_db),
):
    """Delete a marker link."""
    link = db.query(MarkerLink).join(Marker).filter(
        MarkerLink.id == link_id,
        Marker.project_id == project_id,
    ).first()
    
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    
    db.delete(link)
    db.commit()
    
    return {"message": "Link deleted"}


# Conduit endpoints
@router.post("/{project_id}/conduits", response_model=ConduitResponse)
def create_conduit(
    project_id: int,
    conduit: ConduitCreate,
    db: Session = Depends(get_db),
):
    """Create a conduit connection between terminal and drop pedestal."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    terminal = db.query(Marker).filter(
        Marker.id == conduit.terminal_id,
        Marker.project_id == project_id,
    ).first()
    
    drop_ped = db.query(Marker).filter(
        Marker.id == conduit.drop_ped_id,
        Marker.project_id == project_id,
    ).first()
    
    if not terminal or not drop_ped:
        raise HTTPException(status_code=404, detail="Terminal or drop pedestal not found")

    # Validate endpoint types: must be (terminal -> dropPed) or (dropPed -> dropPed)
    if drop_ped.marker_type != 'dropPed':
        raise HTTPException(status_code=400, detail="drop_ped_id must reference a drop pedestal marker")
    if terminal.marker_type == 'terminal' and drop_ped.marker_type == 'terminal':
        raise HTTPException(status_code=400, detail="Conduit cannot connect terminal to terminal")
    if terminal.marker_type not in ['terminal', 'dropPed']:
        raise HTTPException(status_code=400, detail="terminal_id must reference a terminal or drop pedestal marker")
    
    db_conduit = Conduit(
        project_id=project_id,
        page_number=conduit.page_number,
        terminal_id=conduit.terminal_id,
        drop_ped_id=conduit.drop_ped_id,
        footage=conduit.footage,
    )
    db.add(db_conduit)
    db.commit()
    db.refresh(db_conduit)
    return db_conduit


@router.get("/{project_id}/conduits", response_model=List[ConduitResponse])
def get_conduits(
    project_id: int,
    page_number: int = None,
    db: Session = Depends(get_db),
):
    """Get conduits for a project, optionally filtered by page."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    query = db.query(Conduit).filter(Conduit.project_id == project_id)
    if page_number is not None:
        query = query.filter(Conduit.page_number == page_number)
    
    return query.all()


@router.delete("/{project_id}/conduits/{conduit_id}")
def delete_conduit(
    project_id: int,
    conduit_id: int,
    db: Session = Depends(get_db),
):
    """Delete a conduit."""
    conduit = db.query(Conduit).filter(
        Conduit.id == conduit_id,
        Conduit.project_id == project_id,
    ).first()
    
    if not conduit:
        raise HTTPException(status_code=404, detail="Conduit not found")
    
    db.delete(conduit)
    db.commit()
    
    return {"message": "Conduit deleted"}