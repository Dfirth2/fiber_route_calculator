from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO

from app.db.database import get_db
from app.models.database import Project, Polyline, ScaleCalibration
from app.services.export_service import generate_csv_report, generate_json_report

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
