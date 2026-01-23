"""
Test utilities for PDF handling and geometry calculations.
"""

import math
from app.services.geometry import (
    calculate_polyline_length_pdf_units,
    calculate_polyline_length_ft,
    calculate_two_point_scale,
)

def test_distance_calculation():
    """Test basic distance calculation."""
    points = [
        {"x": 0, "y": 0},
        {"x": 3, "y": 4},
    ]
    distance = calculate_polyline_length_pdf_units(points)
    assert distance == 5.0, f"Expected 5.0, got {distance}"
    print("✅ Distance calculation test passed")

def test_length_with_scale():
    """Test length calculation with scale factor."""
    points = [
        {"x": 0, "y": 0},
        {"x": 100, "y": 0},
    ]
    scale_factor = 0.5  # 0.5 feet per unit
    length = calculate_polyline_length_ft(points, scale_factor)
    assert length == 50.0, f"Expected 50.0, got {length}"
    print("✅ Length with scale test passed")

def test_two_point_scale():
    """Test two-point calibration."""
    point_a = {"x": 0, "y": 0}
    point_b = {"x": 72, "y": 0}  # 72 points = 1 inch
    known_distance_ft = 50  # 1 inch = 50 feet
    
    scale_factor = calculate_two_point_scale(point_a, point_b, known_distance_ft)
    expected = 50 / 72  # feet per point
    
    assert abs(scale_factor - expected) < 0.0001, f"Expected {expected}, got {scale_factor}"
    print("✅ Two-point scale test passed")

if __name__ == "__main__":
    test_distance_calculation()
    test_length_with_scale()
    test_two_point_scale()
    print("\n✅ All tests passed!")
