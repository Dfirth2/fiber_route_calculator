# Fiber Route Plat Designer
BY dfirth2

A web application for measuring fiber routes from subdivision plats. Upload a PDF plat, calibrate the scale, trace fiber paths, and export accurate footage calculations for network design documentation.

## What this app does
- Upload subdivision plat PDFs and browse pages.
- Calibrate scale by clicking two points and entering the real-world distance.
- Draw fiber routes on top of the PDF with undo/clear and save per route.
- See segment-by-segment distances and total footage using the saved scale factor.
- Export measurements as CSV or JSON for handoff and reporting.

## Intial update
- Fixed PDF.js worker loading so PDFs render in both dev and deployed builds.
- Added two-point scale calibration flow with persistence and restored points.
- Implemented pan/draw modes, undo and clear shortcuts, and save/calc buttons for routes.
- Added segment distance panel showing per-segment lengths and totals while drawing.
- Backend fixes for route saving (SQLAlchemy func import/usage) and updated deployment docs.

## Update 1
- Unit Testing

## Update 2
- Added terminals, Drops peds, conduits, Assigning Lots to Terminals and pedestals
- Added Exporting to PDF
- Fixed critical coordinate alignment issues for markers and PDF export
- Resolved zoom handling - markers now stay in correct position when zooming in/out
- Fixed PDF rotation support (handles 270° rotated PDFs correctly)
- Implemented proper coordinate transformation between canvas space and PDF space
- Frontend now passes page dimensions to backend for accurate overlay rendering
- All markers, routes, conduits, and annotations now export at exact positions

## Update 3
- **Frontend Migration**: Converted from React to Angular 21.1.1
  - Angular standalone components with TypeScript 5.2.0
  - Integrated Tailwind CSS for consistent styling
  - Updated module resolution to "bundler" for Angular 21 ESM compatibility
  - Successfully compiling and serving on port 3000 (mapped from Angular dev server on port 4200)
- **Backend Updates**: 
  - Migrated from deprecated PyPDF2 to pypdf 5.1.0
  - Updated SQLAlchemy to >=2.0.25 with proper declarative_base imports
  - Updated pydantic to >=2.10.0 with ConfigDict for settings
  - Updated Pillow to >=11.0.0 for Python 3.13 compatibility
  - Fixed timezone-aware datetime defaults for database models
  - Added pytest.ini to filter third-party deprecation warnings
  - All tests passing with zero warnings on Python 3.13
  - Added dual database support: SQLite for development, PostgreSQL for production
  - Environment-based configuration with automatic database selection
- **Project Management Enhancements**:
  - Projects now display in clean table layout with name, footage, and actions
  - Project name is clickable link to editor
  - Auto-navigation to editor after project creation
  - Auto-refresh project list when returning from editor
  - Delete confirmation with loading overlay and table refresh
  - Loading states for all async operations
- **Calibration Improvements**:
  - Calibration now strictly project-specific (stored in database only)
  - Removed localStorage fallback to prevent cross-project contamination
  - Each project requires its own calibration
  - Mode automatically switches to 'pan' after successful calibration
  - Clear user prompts when calibration is required
- **Infrastructure**:
  - Updated docker-compose.yml to use frontend-angular instead of React frontend
  - Fixed Angular Docker configuration with proper dev server binding (--host 0.0.0.0)
  - Angular app successfully compiles with no TypeScript errors
  - Refactored large inline templates to separate HTML files for better maintainability

## Requirments

