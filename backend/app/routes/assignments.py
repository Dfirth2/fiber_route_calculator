from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.database import Project, Marker, MarkerLink
from app.models.schemas import MarkerLinkCreate, MarkerLinkResponse
from typing import List

router = APIRouter(prefix="/api/projects", tags=["assignments"])

@router.post("/{project_id}/assignments", response_model=MarkerLinkResponse)
def create_assignment(
    project_id: int,
    assignment: MarkerLinkCreate,
    db: Session = Depends(get_db)
):
    """Create an assignment (arrow) from a terminal/drop to a lot"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Verify marker exists
    marker = db.query(Marker).filter(
        Marker.id == assignment.marker_id,
        Marker.project_id == project_id
    ).first()
    if not marker:
        raise HTTPException(status_code=404, detail="Marker not found")
    
    link = MarkerLink(
        marker_id=assignment.marker_id,
        page_number=assignment.page_number,
        to_x=assignment.to_x,
        to_y=assignment.to_y
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link

@router.get("/{project_id}/assignments", response_model=List[MarkerLinkResponse])
def get_assignments(project_id: int, db: Session = Depends(get_db)):
    """Get all assignments for a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    links = db.query(MarkerLink).join(Marker).filter(
        Marker.project_id == project_id
    ).all()
    return links

@router.delete("/{project_id}/assignments/{assignment_id}")
def delete_assignment(
    project_id: int,
    assignment_id: int,
    db: Session = Depends(get_db)
):
    """Delete an assignment"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    link = db.query(MarkerLink).join(Marker).filter(
        MarkerLink.id == assignment_id,
        Marker.project_id == project_id
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    db.delete(link)
    db.commit()
    return {"status": "deleted"}

@router.put("/{project_id}/assignments/{assignment_id}", response_model=MarkerLinkResponse)
def update_assignment(
    project_id: int,
    assignment_id: int,
    assignment: MarkerLinkCreate,
    db: Session = Depends(get_db)
):
    """Update an assignment"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    link = db.query(MarkerLink).join(Marker).filter(
        MarkerLink.id == assignment_id,
        Marker.project_id == project_id
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    link.to_x = assignment.to_x
    link.to_y = assignment.to_y
    link.page_number = assignment.page_number
    db.commit()
    db.refresh(link)
    return link
