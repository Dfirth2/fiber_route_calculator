# Fiber Route Plat Designer
BY Dayne Firth II

A web application for measuring fiber routes from subdivision plats. Upload a PDF plat, calibrate the scale, trace fiber paths, and export accurate footage calculations for network design documentation.

## What this app does
- Upload subdivision plat PDFs and browse pages.
- Calibrate scale by clicking two points and entering the real-world distance.
- Draw fiber routes on top of the PDF with undo/clear and save per route.
- See segment-by-segment distances and total footage using the saved scale factor.
- Export measurements as CSV or JSON for handoff and reporting.

## Recent work done
- Fixed PDF.js worker loading so PDFs render in both dev and deployed builds.
- Added two-point scale calibration flow with persistence and restored points.
- Implemented pan/draw modes, undo and clear shortcuts, and save/calc buttons for routes.
- Added segment distance panel showing per-segment lengths and totals while drawing.
- Backend fixes for route saving (SQLAlchemy func import/usage) and updated deployment docs.


## Requirments
