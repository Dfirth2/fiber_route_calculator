# Assign Tool - Service Area Mapping

## Overview
The **Assign tool** allows you to create visual arrows (assignments) from terminals or drop pedestals to service lots. These arrows help visualize which lots are assigned to be served from specific equipment points.

## Features
- **High Visibility Colors**: Arrows use bright orange (#ff6b35) by default to be clearly visible over PDF maps
- **Interactive Selection**: Click on terminals (green triangles) or drop pedestals (purple circles) to select them
- **Click to Assign**: Click on lot locations to create assignment arrows pointing to them
- **Persistence**: All assignments are saved to the database and persist across sessions

## Usage

### Enabling Assign Mode
1. In the PDF Viewer toolbar, select the **"Assign"** tool/mode
2. The drawing canvas will activate in assign mode

### Creating Assignments
1. **Select a Terminal/Drop**: Click on a terminal (green triangle) or drop ped (purple circle) in the map
   - Selected equipment will highlight in yellow
2. **Create Assignment**: Click on any lot location on the map
   - An arrow will be drawn from the selected equipment to that lot
   - The assignment is automatically saved

### Colors
- **Orange (#ff6b35)** - Default assignment arrow color (highly visible over PDFs)
- **Yellow highlight** - Selected terminal/drop ped

## Technical Implementation

### Frontend Components
- **DrawingCanvasComponent**: Handles canvas rendering of assignments
  - Detects marker selection (terminal/drop ped click detection)
  - Renders assignment arrows with arrowheads
  - Supports color customization per assignment

- **StateService**: Manages assignment state
  - `assignments$` - Observable stream of all assignments
  - `addAssignment()` - Add new assignment
  - `removeAssignment()` - Remove assignment
  - `setAssignments()` - Load assignments from backend
  - `clearAssignments()` - Clear all assignments

### Backend API

#### Create Assignment
```
POST /api/projects/{project_id}/assignments
Body: {
  "marker_id": <terminal/drop id>,
  "page_number": 1,
  "to_x": <lot x coordinate>,
  "to_y": <lot y coordinate>
}
```

#### Get Assignments
```
GET /api/projects/{project_id}/assignments
```
Returns array of all assignments for the project.

#### Update Assignment
```
PUT /api/projects/{project_id}/assignments/{assignment_id}
Body: {
  "marker_id": <terminal/drop id>,
  "page_number": 1,
  "to_x": <new x>,
  "to_y": <new y>
}
```

#### Delete Assignment
```
DELETE /api/projects/{project_id}/assignments/{assignment_id}
```

### Data Structure

**Assignment Interface**:
```typescript
export interface Assignment {
  id: number;
  project_id: number;
  from_marker_id: number;
  to_x: number;
  to_y: number;
  page_number: number;
  color?: string;  // Optional custom color
}
```

**Database Table** (MarkerLink):
- `id`: Unique identifier
- `marker_id`: ID of terminal/drop ped
- `to_x`, `to_y`: Target lot coordinates
- `page_number`: PDF page number
- `created_at`, `updated_at`: Timestamps

## Arrow Rendering
Arrows are drawn with:
- **Line**: 3px width in the specified color
- **Arrowhead**: Triangular arrowhead at destination point
- **High Contrast**: Orange color ensures visibility over PDF backgrounds

## Workflow Example
1. **Project Setup**: Create a project and upload PDF of subdivision plat
2. **Mark Equipment**: Use terminal/drop ped tools to mark equipment locations
3. **Assign Service Areas**: 
   - Switch to Assign tool
   - Click on a terminal
   - Click on lots it serves
   - Repeat for all equipment points
4. **Export**: Export the project with assignment visualization

## Future Enhancements
- Color picker for custom assignment colors per terminal
- Bulk assignment mode
- Assignment templates for common configurations
- Assignment analytics (lots per terminal, etc.)
