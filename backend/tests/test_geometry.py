from app.services.geometry import (
    calculate_polyline_length_pdf_units,
    calculate_polyline_length_ft,
    calculate_two_point_scale,
)


def test_calculate_polyline_length_pdf_units():
    points = [
        {"x": 0, "y": 0},
        {"x": 3, "y": 4},
        {"x": 6, "y": 8},
    ]
    assert calculate_polyline_length_pdf_units(points) == 10.0


def test_calculate_polyline_length_ft():
    points = [
        {"x": 0, "y": 0},
        {"x": 100, "y": 0},
    ]
    feet = calculate_polyline_length_ft(points, scale_factor=0.5)
    assert feet == 50.0


def test_calculate_two_point_scale():
    scale = calculate_two_point_scale(
        {"x": 0, "y": 0},
        {"x": 0, "y": 200},
        known_distance_ft=100,
    )
    assert scale == 0.5
