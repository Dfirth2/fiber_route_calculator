# Assign Tool - Service Area Mapping Guide

## Overview

The **Assign Tool** allows you to create visual assignments mapping service areas from terminals and drop pedestals to specific lots or service addresses on your project map. These assignments are displayed as colored arrows on the PDF canvas with directional arrowheads for clarity.

## Features

- **Marker Selection**: Click on any terminal or drop pedestal to select it
- **Service Area Mapping**: Create arrows from selected equipment to service areas
- **Visual Feedback**: 
  - Yellow highlight (#fbbf24) shows the selected source marker
  - Orange arrows (#ff6b35) indicate assignments with high visibility
  - Directional arrowheads show service flow direction
- **Persistent Storage**: All assignments are saved to the backend database
- **Real-time Updates**: Assignments update immediately across the application

## How to Use

### Step 1: Calibrate the PDF
Before using the Assign Tool, you must first calibrate the PDF scale:
1. Click the **Calibration** dropdown
2. Select **Calibrate**
3. Click two points on a known measurement (use a scale ruler on your PDF)
4. Enter the real distance in feet
5. The scale is now set for your project

### Step 2: Add Equipment Markers
1. Open the **Equipment** dropdown
2. Select **Terminal** to add terminal locations, or **Drop Pedestal** to add drop locations
3. Click on the PDF to place markers at each equipment location
4. Repeat until all terminals and drops are marked

### Step 3: Use the Assign Tool
1. Click the **Assign** button in the toolbar to enter assign mode
2. The cursor will change to a crosshair
3. **First click**: Click on a terminal or drop pedestal to select it
   - The selected marker will highlight in yellow
   - A status message confirms your selection
4. **Second click**: Click on the lot or service area you want to serve
   - An orange arrow will appear from the equipment to the clicked point
   - The assignment is automatically saved to the database
5. Repeat for each equipment-to-service-area assignment

### Step 4: Review Assignments
- Assignments are displayed as orange arrows on the PDF
- The toolbar shows the count of assignments created
- Each arrow points from the equipment location to the assigned service area

## Visual Elements

### Markers
- **Terminals**: Green triangles (pointing upward)
- **Drops**: Purple circles

### Assignments
- **Arrow Color**: Orange (#ff6b35) for high visibility over PDF backgrounds
- **Arrow Style**: Solid 3px line with triangular arrowhead pointing toward target
- **Selected Marker Highlight**: Yellow circle (#fbbf24) around the source equipment

## API Integration

### Endpoints

The Assign Tool uses the following API endpoints:

#### Get Assignments
```
GET /api/projects/{project_id}/assignments
```
Returns all assignments for a project.

#### Create Assignment
```
POST /api/projects/{project_id}/assignments
Content-Type: application/json

{
  "from_marker_id": 0,
  "to_x": 100.5,
  "to_y": 200.3,
  "page_number": 1,
  "color": "#ff6b35"
}
```
Creates a new assignment from a marker to a coordinate.

#### Update Assignment
```
PUT /api/projects/{project_id}/assignments/{assignment_id}
Content-Type: application/json

{
  "to_x": 150.5,
  "to_y": 250.3,
  "color": "#ff6b35"
}
```
Updates an assignment's target location or color.

#### Delete Assignment
```
DELETE /api/projects/{project_id}/assignments/{assignment_id}
```
Removes an assignment.

## Data Structure

### Assignment Interface (TypeScript)
```typescript
interface Assignment {
  id: number;
  project_id: number;
  from_marker_id: number;
  to_x: number;
  to_y: number;
  page_number: number;
  color?: string;
}
```

### Marker Position Encoding
- Terminal markers are encoded with IDs 0 to (terminal_count - 1)
- Drop markers are encoded with IDs starting from terminal_count
- For example: if you have 5 terminals, the first drop has ID 5

## Color Scheme

| Element | Color | RGB | Purpose |
|---------|-------|-----|---------|
| Assignment Arrow | Orange | #ff6b35 | High visibility, stands out on PDFs |
| Selected Marker | Yellow | #fbbf24 | High contrast, clearly visible selection |
| Terminal Marker | Green | #10b981 | Distinct from other elements |
| Drop Marker | Purple | #a855f7 | Distinct from terminals |

## Workflow Example

### Scenario: Mapping a Residential Subdivision
1. **Upload PDF**: Add your subdivision plat PDF
2. **Calibrate**: Use the scale ruler on the plat (e.g., 100 feet = 2 inches)
3. **Mark Terminals**: Click Equipment → Terminal, then click 3 terminal locations on the map
4. **Mark Drops**: Click Equipment → Drop Pedestal, then click 8 drop locations
5. **Assign Service Areas**: 
   - Click Assign tool
   - Click Terminal A, then click Lot 1 (orange arrow appears)
   - Click Terminal A, then click Lot 2 (another arrow from Terminal A to Lot 2)
   - Click Terminal B, then click Lots 3-4
   - Click Terminal C, then click Lots 5-8
   - Use Drop Pedestals for remaining lot assignments
6. **Review**: All assignments are now visible and saved to the database

## Keyboard Shortcuts

- **Escape**: Cancel current assignment and deselect marker
- **Pan Mode**: Click the **Pan** button to switch away from assign mode

## State Management

### Observable Streams

The assign tool uses RxJS observables for state management:

```typescript
// Subscribe to assignment changes
stateService.assignments$.subscribe(assignments => {
  console.log('Assignments updated:', assignments);
});
```

### State Methods

```typescript
// Set all assignments (typically on load)
stateService.setAssignments(assignments);

// Add a new assignment
stateService.addAssignment(assignment);

// Remove an assignment
stateService.removeAssignment(assignmentId);

// Clear all assignments
stateService.clearAssignments();
```

## Troubleshooting

### "Cannot assign a marker to itself" message
This means you clicked on the same marker twice. Select a different marker or service area.

### Arrows don't appear
1. Ensure you're in assign mode (Assign button should be highlighted in blue)
2. Check that calibration is set (required for equipment mode)
3. Verify that both terminals/drops and assignments are loaded

### Assignment not saving
Check the browser console for API errors. Ensure:
- Backend API is running on port 8000
- Project ID is valid
- Database has the assignments table (MarkerLink table)

### Performance issues with many assignments
If performance degrades with 50+ assignments:
1. Consider grouping related assignments by service areas
2. Use conduit mode instead for route representation if applicable
3. Consider creating multiple projects instead of one large project

## Future Enhancements

Potential improvements for future versions:
- Color customization for assignments by service provider or area
- Assignment filtering by marker type or page number
- Bulk operations (select multiple markers, create assignments to all)
- Assignment deletion by clicking the arrow
- Assignment editing to change target location
- Import/export assignments as CSV or GeoJSON
- Distance calculation for each assignment
- Heat maps showing service area coverage

## Backend Integration

### Database Schema

Assignments use the existing `MarkerLink` table:

```sql
CREATE TABLE marker_link (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  marker_id INTEGER NOT NULL,
  to_x FLOAT NOT NULL,
  to_y FLOAT NOT NULL,
  page_number INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES project(id),
  FOREIGN KEY (marker_id) REFERENCES marker(id)
);
```

### Related Code Files

- **Frontend**: 
  - [pdf-viewer.component.ts](frontend-angular/src/app/components/pdf-viewer/pdf-viewer.component.ts) - Main UI component
  - [state.service.ts](frontend-angular/src/app/core/services/state.service.ts) - State management
  - [api.service.ts](frontend-angular/src/app/core/services/api.service.ts) - API client

- **Backend**:
  - [projects.py](backend/app/routes/projects.py) - Existing marker-links endpoints (reused for assignments)
  - [models/database.py](backend/app/models/database.py) - MarkerLink model
  - [models/schemas.py](backend/app/models/schemas.py) - Data schemas

## Support & Questions

For issues or questions about the Assign Tool:
1. Check the troubleshooting section above
2. Review the workflow example for typical usage
3. Examine the API documentation for custom integrations
4. Check the console logs for error messages
