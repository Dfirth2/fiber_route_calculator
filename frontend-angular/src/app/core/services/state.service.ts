import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Project {
  id: number;
  name: string;
  pdf_filename: string;
  created_at: string;
  total_length_ft: number;
}

export interface Marker {
  id: number;
  project_id: number;
  page_number: number;
  x: number;
  y: number;
  marker_type: string;
}

export interface Polyline {
  id: number;
  project_id: number;
  page_number: number;
  name: string;
  points: { x: number; y: number }[];
  length_ft: number;
  type?: 'fiber' | 'conduit';
}

export interface Conduit {
  id: number;
  project_id: number;
  terminal_id: number;
  drop_ped_id: number;
  footage: number;
  page_number: number;
}

export interface ScaleCalibration {
  id: number;
  project_id: number;
  page_number: number;
  method: string;
  scale_factor: number;
  known_distance_ft?: number;
}

export interface MarkerLink {
  id: number;
  project_id: number;
  marker_id: number;
  to_x: number;
  to_y: number;
  page_number: number;
}

export interface Assignment {
  id: number;
  project_id: number;
  from_marker_id: number;
  to_x: number;
  to_y: number;
  page_number: number;
  color?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private projectSubject = new BehaviorSubject<Project | null>(null);
  private markersSubject = new BehaviorSubject<Marker[]>([]);
  private polylinesSubject = new BehaviorSubject<Polyline[]>([]);
  private conduitSubject = new BehaviorSubject<Conduit[]>([]);
  private markerLinksSubject = new BehaviorSubject<MarkerLink[]>([]);
  private assignmentsSubject = new BehaviorSubject<Assignment[]>([]);
  private scaleCalibrationSubject = new BehaviorSubject<ScaleCalibration | null>(null);

  project$ = this.projectSubject.asObservable();
  markers$ = this.markersSubject.asObservable();
  polylines$ = this.polylinesSubject.asObservable();
  conduits$ = this.conduitSubject.asObservable();
  markerLinks$ = this.markerLinksSubject.asObservable();
  assignments$ = this.assignmentsSubject.asObservable();
  scaleCalibration$ = this.scaleCalibrationSubject.asObservable();

  setProject(project: Project) {
    this.projectSubject.next(project);
  }

  setMarkers(markers: Marker[]) {
    this.markersSubject.next(markers);
  }

  addMarker(marker: Marker) {
    const current = this.markersSubject.value;
    this.markersSubject.next([...current, marker]);
  }

  setPolylines(polylines: Polyline[]) {
    this.polylinesSubject.next(polylines);
  }

  addPolyline(polyline: Polyline) {
    const current = this.polylinesSubject.value;
    this.polylinesSubject.next([...current, polyline]);
  }

  setConduits(conduits: Conduit[]) {
    this.conduitSubject.next(conduits);
  }

  addConduit(conduit: Conduit) {
    const current = this.conduitSubject.value;
    this.conduitSubject.next([...current, conduit]);
  }

  setMarkerLinks(links: MarkerLink[]) {
    this.markerLinksSubject.next(links);
  }

  addMarkerLink(link: MarkerLink) {
    const current = this.markerLinksSubject.value;
    this.markerLinksSubject.next([...current, link]);
  }

  setScaleCalibration(calibration: ScaleCalibration) {
    this.scaleCalibrationSubject.next(calibration);
  }

  setAssignments(assignments: Assignment[]) {
    this.assignmentsSubject.next(assignments);
  }

  addAssignment(assignment: Assignment) {
    const current = this.assignmentsSubject.value;
    this.assignmentsSubject.next([...current, assignment]);
  }

  removeAssignment(assignmentId: number) {
    const current = this.assignmentsSubject.value;
    this.assignmentsSubject.next(current.filter(a => a.id !== assignmentId));
  }

  clearAssignments() {
    this.assignmentsSubject.next([]);
  }
}
