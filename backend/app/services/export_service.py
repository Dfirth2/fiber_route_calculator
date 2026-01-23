import csv
import json
from io import StringIO, BytesIO
from typing import List, Optional, Dict
from datetime import datetime

def generate_csv_report(
    project_name: str,
    total_length_ft: float,
    polylines: List[Dict],
    scale_calibrations: List[Dict],
    slack_factor: Optional[float] = None,
) -> str:
    """
    Generate CSV report of measurements.
    
    Args:
        project_name: Name of the project
        total_length_ft: Total fiber length in feet
        polylines: List of polyline data
        scale_calibrations: List of scale calibration data
        slack_factor: Optional slack factor (e.g., 0.05 for 5%)
    
    Returns:
        CSV string
    """
    output = StringIO()
    writer = csv.writer(output)
    
    # Header section
    writer.writerow(["Fiber Route Measurement Report"])
    writer.writerow([])
    writer.writerow(["Project Name", project_name])
    writer.writerow(["Report Date", datetime.now().strftime("%Y-%m-%d %H:%M:%S")])
    writer.writerow([])
    
    # Scale calibration section
    writer.writerow(["Scale Calibration Information"])
    writer.writerow(["Page", "Method", "Scale Factor", "Details"])
    
    for calib in scale_calibrations:
        method = calib.get("method", "Unknown")
        scale_factor = calib.get("scale_factor", 0)
        
        if method == "manual":
            details = calib.get("manual_scale_str", "")
        else:
            details = f"Two-point calibration: {calib.get('known_distance_ft', 0)} ft"
        
        writer.writerow([
            calib.get("page_number", ""),
            method,
            f"{scale_factor:.6f}",
            details,
        ])
    
    writer.writerow([])
    
    # Measurements section
    writer.writerow(["Path Measurements"])
    writer.writerow(["Page", "Path Name", "Segments", "Length (ft)"])
    
    for polyline in polylines:
        points = polyline.get("points", [])
        writer.writerow([
            polyline.get("page_number", ""),
            polyline.get("name", ""),
            len(points) - 1 if len(points) > 1 else 0,
            f"{polyline.get('length_ft', 0):.2f}",
        ])
    
    writer.writerow([])
    
    # Summary section
    writer.writerow(["Summary"])
    writer.writerow(["Total Fiber Length", f"{total_length_ft:.2f} ft"])
    writer.writerow(["Number of Paths", len(polylines)])
    
    if slack_factor:
        adjusted_length = total_length_ft * (1 + slack_factor)
        slack_pct = slack_factor * 100
        writer.writerow([f"Slack Factor (+{slack_pct}%)", f"{adjusted_length:.2f} ft"])
    
    return output.getvalue()

def generate_json_report(
    project_name: str,
    total_length_ft: float,
    polylines: List[Dict],
    scale_calibrations: List[Dict],
    slack_factor: Optional[float] = None,
) -> str:
    """
    Generate JSON report of measurements.
    
    Returns:
        JSON string
    """
    report = {
        "project_name": project_name,
        "generated_at": datetime.now().isoformat(),
        "scale_calibrations": scale_calibrations,
        "polylines": [
            {
                "name": p.get("name"),
                "page_number": p.get("page_number"),
                "point_count": len(p.get("points", [])),
                "length_ft": p.get("length_ft"),
            }
            for p in polylines
        ],
        "summary": {
            "total_length_ft": total_length_ft,
            "polyline_count": len(polylines),
        },
    }
    
    if slack_factor:
        adjusted_length = total_length_ft * (1 + slack_factor)
        report["summary"]["slack_factor"] = slack_factor
        report["summary"]["adjusted_length_ft"] = adjusted_length
    
    return json.dumps(report, indent=2)
