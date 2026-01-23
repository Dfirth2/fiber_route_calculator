import math
from typing import List, Dict

class Point:
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y
    
    def distance_to(self, other: 'Point') -> float:
        """Calculate Euclidean distance to another point."""
        return math.sqrt((self.x - other.x)**2 + (self.y - other.y)**2)

def calculate_polyline_length_pdf_units(points: List[Dict]) -> float:
    """
    Calculate total length of a polyline in PDF units.
    
    Args:
        points: List of dictionaries with 'x' and 'y' keys
    
    Returns:
        Total length in PDF units
    """
    if len(points) < 2:
        return 0.0
    
    total_length = 0.0
    for i in range(len(points) - 1):
        p1 = Point(points[i]['x'], points[i]['y'])
        p2 = Point(points[i + 1]['x'], points[i + 1]['y'])
        total_length += p1.distance_to(p2)
    
    return total_length

def calculate_polyline_length_ft(points: List[Dict], scale_factor: float) -> float:
    """
    Calculate total length of a polyline in feet.
    
    Args:
        points: List of dictionaries with 'x' and 'y' keys (in PDF units)
        scale_factor: feet per PDF unit
    
    Returns:
        Total length in feet
    """
    length_pdf_units = calculate_polyline_length_pdf_units(points)
    return length_pdf_units * scale_factor

def calculate_two_point_scale(
    point_a: Dict,
    point_b: Dict,
    known_distance_ft: float
) -> float:
    """
    Calculate scale factor from two calibration points.
    
    Args:
        point_a: {x, y} in PDF units
        point_b: {x, y} in PDF units
        known_distance_ft: Real-world distance in feet
    
    Returns:
        Scale factor (feet per PDF unit)
    """
    p1 = Point(point_a['x'], point_a['y'])
    p2 = Point(point_b['x'], point_b['y'])
    
    distance_pdf_units = p1.distance_to(p2)
    
    if distance_pdf_units == 0:
        raise ValueError("Calibration points must be different")
    
    scale_factor = known_distance_ft / distance_pdf_units
    return scale_factor

def parse_manual_scale(scale_str: str) -> float:
    """
    Parse manual scale string like "1 inch = 50 feet" to scale factor.
    For internal use, we'll assume PDF units are in points (1/72 inch).
    
    Args:
        scale_str: String like "1 inch = 50 feet" or "1 in = 50 ft"
    
    Returns:
        Scale factor (feet per PDF unit/point)
    """
    # This is a simplified parser - can be enhanced
    # Assumes format: "X unit = Y feet"
    try:
        # Example: "1 inch = 50 feet"
        parts = scale_str.split("=")
        if len(parts) != 2:
            raise ValueError("Invalid scale format")
        
        left = parts[0].strip().split()
        right = parts[1].strip().split()
        
        left_value = float(left[0])
        left_unit = left[1].lower()
        
        right_value = float(right[0])
        
        # Convert left side to inches if needed
        inches = left_value
        if "foot" in left_unit or left_unit == "ft":
            inches = left_value * 12
        elif "yard" in left_unit or left_unit == "yd":
            inches = left_value * 36
        
        # 1 inch = 72 points (PDF units)
        # So 1 point = 1/72 inches
        # feet_per_point = (right_value / inches) / 72
        feet_per_inch = right_value / inches
        feet_per_point = feet_per_inch / 72
        
        return feet_per_point
    except Exception as e:
        raise ValueError(f"Could not parse scale string: {str(e)}")
