# Fiber Route Calculator - Angular Frontend

New Angular frontend replacing the React version.

## Setup

```bash
cd frontend-angular
npm install
npm start
```

The app will be available at `http://localhost:4200`

## Project Structure

```
src/
  app/
    components/          # Angular components
    core/
      services/         # API and state management
      models/           # TypeScript interfaces
    app.component.ts    # Root component
    app.routes.ts       # Routing configuration
```

## Key Services

- **ApiService**: HTTP communication with backend
- **StateService**: Application state management using RxJS BehaviorSubjects

## Components (To be implemented)

- ProjectList: Display all projects
- ProjectEditor: Main editor with PDF viewer, drawing canvas, markers
- PDFViewer: PDF.js integration
- DrawingCanvas: Canvas overlay for drawing routes and markers
- ScaleCalibration: Scale measurement UI
- MeasurementDisplay: Show measurements and calculations
