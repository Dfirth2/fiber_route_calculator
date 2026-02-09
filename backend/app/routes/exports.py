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
    
    # Sanitize project name for filename
    safe_project_name = "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in project.name)
    
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={safe_project_name}_report.csv"},
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
    
    # Sanitize project name for filename
    safe_project_name = "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in project.name)
    
    return StreamingResponse(
        iter([json_content]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={safe_project_name}_report.json"},
    )

@router.get("/{project_id}/pdf")
def export_pdf_with_overlays(
    project_id: int,
    page_number: int = Query(None, description="Specific page to export (default: all pages)"),
    page_width: float = Query(None, description="Rendered page width from frontend"),
    page_height: float = Query(None, description="Rendered page height from frontend"),
    rotation: int = Query(0, description="PDF rotation in degrees (0, 90, 180, 270)"),
    db: Session = Depends(get_db),
):
    """Export PDF with all drawn routes, markers, and annotations overlaid on all pages."""
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
    
    # Filter out any polylines that are actually conduits (legacy data)
    # Real fiber routes shouldn't have "Conduit" in the name
    fiber_polylines = [p for p in polylines if "Conduit" not in (p.name or "")]
    
    # Sort polylines by page_number and id for consistent global numbering
    sorted_polylines = sorted(fiber_polylines, key=lambda p: (p.page_number, p.id))
    
    # Organize data by page number with global cable numbers
    all_data = {
        "polylines": [
            {
                "name": p.name,
                "page_number": p.page_number,
                "points": p.points,
                "length_ft": p.length_ft,
                "type": "fiber",  # All polylines in DB are fiber routes (conduits are separate)
                "global_index": idx + 1,  # Global cable number across all pages
            }
            for idx, p in enumerate(sorted_polylines)
        ],
        "markers": [
            {
                "id": m.id,
                "x": m.x,
                "y": m.y,
                "type": m.marker_type,
                "page_number": m.page_number,
            }
            for m in markers
        ],
        "marker_links": [
            {
                "markerId": ml.marker_id,
                "to": {"x": ml.to_x, "y": ml.to_y},
                "page_number": ml.page_number,
            }
            for ml in marker_links
        ],
        "conduits": [
            {
                "terminalId": c.terminal_id,
                "dropPedId": c.drop_ped_id,
                "footage": c.footage,
                "page_number": c.page_number,
            }
            for c in conduits
        ],
    }
    
    print(f"PDF Export: {len(polylines)} polylines, {len(markers)} markers, {len(conduits)} conduits")
    for idx, p in enumerate(polylines):
        print(f"  Polyline {idx}: page={p.page_number}, type=fiber, points={len(p.points)}")
    
    # Create PDF with overlays on all pages
    try:
        pdf_bytes = overlay_drawings_on_pdf(
            pdf_path,
            all_data=all_data,
            single_page=page_number,
            page_width=page_width,
            page_height=page_height,
            rotation=rotation,
        )
        
        # Sanitize project name for filename (replace spaces and special chars)
        safe_project_name = "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in project.name)
        filename = f"{safe_project_name}_annotated.pdf" if page_number is None else f"{safe_project_name}_page_{page_number}_annotated.pdf"
        
        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")
