from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO
import os

from app.db.database import get_db
from app.models.database import Project, Polyline, ScaleCalibration, Marker, MarkerLink, Conduit
from app.services.export_service import generate_csv_report, generate_json_report
from app.services.pdf_overlay import overlay_drawings_on_pdf
from app.config import settings

router = APIRouter(prefix="/api/exports", tags=["exports"])

@router.get("/{project_id}/csv")
def export_csv(
    project_id: int,
    slack_factor: float = Query(None, description="Slack factor (e.g., 0.05 for 5%)"),
    db: Session = Depends(get_db),
):
    """Export project measurements as CSV."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    polylines = db.query(Polyline).filter(Polyline.project_id == project_id).all()
    scale_calibrations = db.query(ScaleCalibration).filter(
        ScaleCalibration.project_id == project_id
    ).all()
    
    polyline_data = [
        {
            "name": p.name,
            "page_number": p.page_number,
            "points": p.points,
            "length_ft": p.length_ft,
        }
        for p in polylines
    ]
    
    scale_calib_data = [
        {
            "page_number": sc.page_number,
            "method": sc.method,
            "scale_factor": sc.scale_factor,
            "manual_scale_str": sc.manual_scale_str,
            "known_distance_ft": sc.known_distance_ft,
        }
        for sc in scale_calibrations
    ]
    
    csv_content = generate_csv_report(
        project_name=project.name,
        total_length_ft=project.total_length_ft,
        polylines=polyline_data,
        scale_calibrations=scale_calib_data,
        slack_factor=slack_factor,
    )
    
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={project.name}_report.csv"},
    )

@router.get("/{project_id}/json")
def export_json(
    project_id: int,
    slack_factor: float = Query(None, description="Slack factor (e.g., 0.05 for 5%)"),
    db: Session = Depends(get_db),
):
    """Export project measurements as JSON."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    polylines = db.query(Polyline).filter(Polyline.project_id == project_id).all()
    scale_calibrations = db.query(ScaleCalibration).filter(
        ScaleCalibration.project_id == project_id
    ).all()
    
    polyline_data = [
        {
            "name": p.name,
            "page_number": p.page_number,
            "points": p.points,
            "length_ft": p.length_ft,
        }
        for p in polylines
    ]
    
    scale_calib_data = [
        {
            "page_number": sc.page_number,
            "method": sc.method,
            "scale_factor": sc.scale_factor,
            "manual_scale_str": sc.manual_scale_str,
            "known_distance_ft": sc.known_distance_ft,
        }
        for sc in scale_calibrations
    ]
    
    json_content = generate_json_report(
        project_name=project.name,
        total_length_ft=project.total_length_ft,
        polylines=polyline_data,
        scale_calibrations=scale_calib_data,
        slack_factor=slack_factor,
    )
    
    return StreamingResponse(
        iter([json_content]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={project.name}_report.json"},
    )

@router.get("/{project_id}/pdf")
def export_pdf_with_overlays(
    project_id: int,
    page_number: int = Query(1, description="PDF page to export"),
    page_width: float = Query(None, description="Rendered page width from frontend"),
    page_height: float = Query(None, description="Rendered page height from frontend"),
    db: Session = Depends(get_db),
):
    """Export PDF with all drawn routes, markers, and annotations overlaid."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get the actual PDF file path from the project
    pdf_path = os.path.join(settings.UPLOAD_DIR, project.pdf_filename)
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="Project PDF not found")
    
    # Get all drawn content for this project
    polylines = db.query(Polyline).filter(Polyline.project_id == project_id).all()
    markers = db.query(Marker).filter(Marker.project_id == project_id).all()
    marker_links = db.query(MarkerLink).join(Marker).filter(Marker.project_id == project_id).all()
    conduits = db.query(Conduit).filter(Conduit.project_id == project_id).all()
    
    # Filter for the current page
    polyline_data = [
        {
            "name": p.name,
            "page_number": p.page_number,
            "points": p.points,
            "length_ft": p.length_ft,
        }
        for p in polylines
        if p.page_number == page_number
    ]
    
    marker_data = [
        {
            "id": m.id,
            "x": m.x,
            "y": m.y,
            "type": m.marker_type,
            "page_number": m.page_number,
        }
        for m in markers
        if m.page_number == page_number
    ]
    
    link_data = [
        {
            "markerId": ml.marker_id,
            "to": {"x": ml.to_x, "y": ml.to_y},
            "page_number": ml.page_number,
        }
        for ml in marker_links
        if ml.page_number == page_number
    ]
    
    conduit_data = [
        {
            "terminalId": c.terminal_id,
            "dropPedId": c.drop_ped_id,
            "footage": c.footage,
            "page_number": c.page_number,
        }
        for c in conduits
        if c.page_number == page_number
    ]
    
    # Create PDF with overlays
    try:
        pdf_bytes = overlay_drawings_on_pdf(
            pdf_path,
            polylines=polyline_data,
            markers=marker_data,
            marker_links=link_data,
            conduits=conduit_data,
            page_number=page_number,
            page_width=page_width,
            page_height=page_height,
        )
        
        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={project.name}_page_{page_number}_annotated.pdf"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")
