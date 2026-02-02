"""Cable configuration routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.models.database import Project, Marker
from app.models.cable_config import (
    CableConfiguration,
    TerminalConfig,
    CableConfig,
    TeatherSplicer
)
from app.models.cable_schemas import (
    CableConfigurationCreate,
    CableConfigurationResponse,
    TerminalConfigResponse,
    CableConfigResponse,
    TeatherSplicerResponse
)
from app.services.cable_service import (
    calculate_terminal_suggestion,
    validate_cable_type_size,
    validate_no_circular_teathers
)

router = APIRouter(prefix="/api/projects", tags=["cable-configuration"])


@router.post("/{project_id}/cable-configuration", response_model=CableConfigurationResponse)
def create_cable_configuration(
    project_id: int,
    config: CableConfigurationCreate,
    db: Session = Depends(get_db)
):
    """Create or update cable configuration for a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate terminal marker IDs exist
    for terminal in config.terminals:
        marker = db.query(Marker).filter(
            Marker.id == terminal.terminal_marker_id,
            Marker.project_id == project_id
        ).first()
        if not marker:
            raise HTTPException(
                status_code=404,
                detail=f"Terminal marker {terminal.terminal_marker_id} not found"
            )
    
    # Validate cable type/size combinations
    for cable in config.cables:
        if not validate_cable_type_size(cable.cable_type, cable.cable_size):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid cable type/size: {cable.cable_type}/{cable.cable_size}"
            )
    
    # Validate no circular teathers
    teather_data = [t.dict() for t in config.teathers]
    if not validate_no_circular_teathers(teather_data):
        raise HTTPException(status_code=400, detail="Circular teather reference detected")
    
    # Delete existing configuration if any
    existing = db.query(CableConfiguration).filter(CableConfiguration.project_id == project_id).first()
    if existing:
        db.delete(existing)
        db.commit()
    
    # Create new configuration
    db_config = CableConfiguration(
        project_id=project_id,
        name=config.name
    )
    db.add(db_config)
    db.flush()  # Get the ID
    
    # Add terminals
    for i, terminal in enumerate(config.terminals):
        db_terminal = TerminalConfig(
            cable_config_id=db_config.id,
            terminal_marker_id=terminal.terminal_marker_id,
            address=terminal.address,
            suggested_size=terminal.suggested_size,
            actual_size=terminal.actual_size,
            order=i
        )
        db.add(db_terminal)
    
    # Add cables
    for i, cable in enumerate(config.cables):
        db_cable = CableConfig(
            cable_config_id=db_config.id,
            cable_number=cable.cable_number,
            cable_type=cable.cable_type,
            cable_size=cable.cable_size,
            order=i
        )
        db.add(db_cable)
    
    db.flush()  # Get cable IDs
    
    # Add teathers
    for teather in config.teathers:
        # Verify cable IDs exist in this configuration
        from_cable = db.query(CableConfig).filter(
            CableConfig.id == teather.cable_id,
            CableConfig.cable_config_id == db_config.id
        ).first()
        to_cable = db.query(CableConfig).filter(
            CableConfig.id == teather.target_cable_id,
            CableConfig.cable_config_id == db_config.id
        ).first()
        
        if not from_cable or not to_cable:
            raise HTTPException(status_code=404, detail="Invalid teather cable reference")
        
        if teather.cable_id == teather.target_cable_id:
            raise HTTPException(status_code=400, detail="Teather cannot reference itself")
        
        db_teather = TeatherSplicer(
            cable_config_id=db_config.id,
            cable_id=teather.cable_id,
            target_cable_id=teather.target_cable_id,
            divert_count=teather.divert_count
        )
        db.add(db_teather)
    
    db.commit()
    db.refresh(db_config)
    
    return db_config


@router.get("/{project_id}/cable-configuration", response_model=CableConfigurationResponse)
def get_cable_configuration(
    project_id: int,
    db: Session = Depends(get_db)
):
    """Get cable configuration for a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    config = db.query(CableConfiguration).filter(CableConfiguration.project_id == project_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Cable configuration not found")
    
    return config


@router.get("/{project_id}/cable-counts")
def get_cable_counts(
    project_id: int,
    db: Session = Depends(get_db)
):
    """
    Get cable count summary for a project.
    Returns terminals with their assignment counts for initial cable builder view.
    """
    from app.models.database import Marker, Polyline
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Count only fiber polylines (exclude drop conduits by name)
    # Note: Fiber routes are named "Fiber Route ..." or "Route ..."; conduits include "Conduit"
    fiber_cable_count = db.query(Polyline).filter(
        Polyline.project_id == project_id,
        or_(
            Polyline.name.is_(None),
            ~Polyline.name.ilike('%conduit%')
        )
    ).count()
    
    # Get all terminals for this project, sorted by creation time
    terminals = db.query(Marker).filter(
        Marker.project_id == project_id,
        Marker.marker_type == 'terminal'
    ).order_by(Marker.created_at).all()
    
    # Helper function to generate labels (A, B, ..., Z, AA, AB, ...)
    def get_label(index: int) -> str:
        if index < 26:
            return chr(65 + index)  # A-Z
        first_char = chr(65 + (index - 26) // 26)
        second_char = chr(65 + (index - 26) % 26)
        return first_char + second_char
    
    # Count assignments for each terminal
    terminals_data = []
    for idx, terminal in enumerate(terminals):
        # Count direct assignments to this terminal (from MarkerLinks)
        assignment_count = len(terminal.links) if hasattr(terminal, 'links') else 0
        
        # Also count drop peds connected to this terminal via conduits
        if hasattr(terminal, 'conduits_from'):
            for conduit in terminal.conduits_from:
                if conduit.drop_ped and hasattr(conduit.drop_ped, 'links'):
                    # Add the number of assignments at the drop ped
                    assignment_count += len(conduit.drop_ped.links)
        
        suggested_size = calculate_terminal_suggestion(assignment_count)
        
        terminals_data.append({
            'id': terminal.id,
            'marker_id': terminal.id,
            'label': get_label(idx),
            'x': terminal.x,
            'y': terminal.y,
            'page_number': terminal.page_number,
            'assignment_count': assignment_count,
            'suggested_size': suggested_size,
            'address': '',  # Will be filled by user
            'created_at': terminal.created_at
        })
    
    return {
        'project_id': project_id,
        'terminals': terminals_data,
        'max_cables': fiber_cable_count
    }
