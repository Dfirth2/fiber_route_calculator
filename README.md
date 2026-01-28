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

## Update 4
- **Assignment System**:
  - Implemented "Assign" tool to create directional arrows from terminals/drops to lot locations
  - Assignments stored in backend database with proper marker ID validation
  - Backend validates marker existence before creating assignments (prevents 404 errors)
  - Assignments persist and load correctly with database-backed marker IDs
  - Fixed race conditions between marker saving and assignment creation
  - Yellow highlight shows selected marker when creating assignments
  - Orange arrows render from markers to assigned lot positions
- **Drop Conduit Management**:
  - Separated drop conduits from fiber routes in UI
  - New "Drop Conduits" section in sidebar showing connection details
  - Displays what each conduit connects (e.g., "Terminal A → Drop Ped C — 45.2 ft")
  - Conduits track both source and destination markers with distance
  - Equipment menu now shows "Drop Conduit" instead of generic "Conduit"
  - Conduit metadata properly tracks fromId, fromType, toId, toType, and lengthFt
- **Erase Mode**:
  - Added comprehensive erase functionality for all drawable elements
  - Click on assignments (arrows), markers, fiber routes, or conduits to delete
  - Smart detection with reasonable click radius for easier selection
  - Visual feedback with red button highlight and "not-allowed" cursor
  - Works with both local storage and backend-persisted data
  - Shows success/error toasts with appropriate colors
- **UI/UX Improvements**:
  - Toast notifications now color-coded: green for success, red for errors, blue for info
  - Toolbar stats now show "Fiber Routes: X (YYY ft)" and "Drop Conduits: X (YYY ft)"
  - Sidebar renamed "Fiber Segments" to "Fiber Cable" for clarity
  - Consistent labeling: "Drop Ped" used throughout instead of inconsistent "Drop"
  - Helper messages show mode-specific instructions (calibrate, assign, erase)
- **Code Quality**:
  - Added proper TypeScript typing for all new features
  - Implemented event emitters for conduit changes
  - Proper separation of concerns between fiber routes and conduits
  - Helper methods for geometric calculations (distance to line segment)
  - Cleaned up duplicate code and improved maintainability

## Update 5
- **Conduit Persistence System**:
  - Fixed critical marker ID synchronization bug between PDF viewer and project editor
  - Replaced ID-based marker lookup with coordinate-based lookup for reliability
  - Conduit metadata now stores coordinates (fromX, fromY, toX, toY) alongside IDs
  - Conduits properly save to database with correct marker references
  - Conduits persist and reload correctly after page refresh
  - Resolved race condition where local IDs didn't match database IDs
  - Conduit relationships now track which drops connect to terminals for assignment aggregation
- **Polyline Persistence**:
  - Fixed conduit polylines not displaying after reload
  - Polylines now emit change event when conduits are drawn (previously only stored locally)
  - Backend correctly distinguishes between fiber routes and conduits via polyline type field
  - Loaded polylines automatically get type field inferred from name ("Fiber" vs "Conduit")
  - All polylines (fiber and conduit) properly sync and render on canvas after project reload
- **Calibration Dialog**:
  - Replaced browser prompt() with professional modal dialog
  - Dialog validates input to only accept numeric values
  - Shows error message "Please enter a valid positive number" if validation fails
  - Dialog remains open if input is invalid, allowing user to correct and retry
  - Fixed modal positioning to center on screen (changed from absolute to fixed)
  - User can submit with Enter key or Cancel button
  - Calibration points are properly reset on cancel
- **Data Synchronization**:
  - Added `[syncedConduits]` input to PDF viewer component
  - Project editor passes conduit metadata to PDF viewer for rendering
  - ngOnChanges handler properly clones conduit data to avoid reference issues
  - Polylines, terminals, drops, and conduits all sync between components correctly
  - Project reload now displays all saved markers, polylines, conduits, and conduit lines
- **Type System**:
  - Updated conduit metadata TypeScript interface with optional coordinate fields
  - Proper typing for polyline objects with type field ('fiber' | 'conduit')
  - Added FormsModule import for two-way binding in calibration dialog
  - Type safety maintained throughout persistence workflow
- **Infrastructure**:
  - Backend PDF deletion already implemented (removed from /tmp/fiber_uploads on project delete)
  - Polyline save endpoint correctly persists both fiber routes and conduits
  - Conduit endpoint validates terminal and drop pedestal existence (404 prevention)
  - All endpoints properly cascade delete related data when project is deleted

## Update 6 - Production Deployment & Interaction Fixes
- **CORS and API Configuration**:
  - Fixed 404 errors when accessing PDF endpoint through Tailscale hostname
  - Updated frontend API URL construction to use nginx proxy (`/api`) in production
  - Added Tailscale hostname to CORS_ORIGINS in backend configuration
  - Frontend now correctly uses relative paths when not on localhost
  - PDF URLs properly constructed for both development and production environments
  - Removed hardcoded port 8000 references in production (uses nginx on port 80)
- **PDF Pan/Zoom Interaction**:
  - Fixed PDF snapping to top-left corner when switching between tools
  - Removed `panOffset` reset in `setMode()` function to maintain PDF position
  - PDF position now preserved when switching from pan to calibrate/equipment/fiber modes
  - Users can zoom to area of interest and switch tools without losing position
- **Erase Functionality**:
  - Fixed erase mode unable to detect items after panning
  - Moved mouse event handlers from outer container to transformed wrapper div
  - Click coordinates now properly aligned with canvas content accounting for pan transform
  - Erase works correctly regardless of zoom level or pan position
- **Marker Deletion**:
  - Fixed 404 errors when attempting to delete markers
  - Corrected `syncedTerminalsList` and `syncedDropsList` to use actual database IDs
  - Previously used array indices as marker IDs, causing database lookup failures
  - Now properly passes marker ID, coordinates, and marker_type from database
  - Delete operations successfully remove markers from backend and update UI
- **Code Architecture**:
  - Improved coordinate transformation handling in mouse event processing
  - Better separation between canvas coordinate space and screen space
  - Mouse handlers attached to correct DOM elements for transform calculations
  - Enhanced reliability of click detection for all interactive elements

