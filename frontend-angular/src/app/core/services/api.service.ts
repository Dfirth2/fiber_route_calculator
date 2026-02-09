import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl: string;

  constructor(private http: HttpClient) {
    // Build API URL dynamically based on current location
    // Use relative path for production (reverse proxy) and absolute path for local development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Local development - backend on port 8000
      this.apiUrl = `${window.location.protocol}//${window.location.hostname}:8000/api`;
    } else {
      // Production - use relative path (requests go through reverse proxy on same port)
      this.apiUrl = '/api';
    }
  }

  // Projects
  getProjects(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/projects/`);
  }

  getProject(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/projects/${id}/`);
  }

  updateProject(id: number, updates: any): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/projects/${id}/`, updates);
  }

  createProject(name: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('pdf_file', file);
    return this.http.post<any>(`${this.apiUrl}/projects/`, formData);
  }

  deleteProject(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/projects/${id}/`);
  }

  // Markers
  getMarkers(projectId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/projects/${projectId}/markers`);
  }

  addMarker(projectId: number, marker: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/projects/${projectId}/markers`, marker);
  }

  updateMarker(projectId: number, markerId: number, marker: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/projects/${projectId}/markers/${markerId}`, marker);
  }

  deleteMarker(projectId: number, markerId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/projects/${projectId}/markers/${markerId}`);
  }

  // Polylines
  getPolylines(projectId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/projects/${projectId}/polylines`);
  }

  addPolyline(projectId: number, polyline: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/projects/${projectId}/polylines`, polyline);
  }

  updatePolyline(projectId: number, polylineId: number, polyline: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/projects/${projectId}/polylines/${polylineId}`, polyline);
  }

  deletePolyline(projectId: number, polylineId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/projects/${projectId}/polylines/${polylineId}`);
  }

  // Scale Calibrations
  getScaleCalibrations(projectId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/projects/${projectId}/scale-calibrations`);
  }

  saveScaleCalibration(projectId: number, calibration: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/projects/${projectId}/scale-calibrations`, calibration);
  }

  // Conduits
  getConduits(projectId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/projects/${projectId}/conduits`);
  }

  addConduit(projectId: number, conduit: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/projects/${projectId}/conduits`, conduit);
  }

  updateConduit(projectId: number, conduitId: number, conduit: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/projects/${projectId}/conduits/${conduitId}`, conduit);
  }

  deleteConduit(projectId: number, conduitId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/projects/${projectId}/conduits/${conduitId}`);
  }

  // Marker Links
  getMarkerLinks(projectId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/projects/${projectId}/marker-links`);
  }

  addMarkerLink(projectId: number, link: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/projects/${projectId}/marker-links`, link);
  }

  // Assignments (arrows from terminals/drops to lots)
  getAssignments(projectId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/projects/${projectId}/assignments`);
  }

  createAssignment(projectId: number, assignment: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/projects/${projectId}/assignments`, assignment);
  }

  updateAssignment(projectId: number, assignmentId: number, assignment: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/projects/${projectId}/assignments/${assignmentId}`, assignment);
  }

  deleteAssignment(projectId: number, assignmentId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/projects/${projectId}/assignments/${assignmentId}`);
  }

  // PDF
  getPdf(projectId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/projects/${projectId}/pdf`, { responseType: 'blob' });
  }

  // Exports
  exportCsv(projectId: number, slackFactor?: number): Observable<Blob> {
    let params = new HttpParams();
    if (slackFactor !== undefined) {
      params = params.set('slack_factor', slackFactor.toString());
    }
    return this.http.get(`${this.apiUrl}/exports/${projectId}/csv`, {
      params,
      responseType: 'blob'
    });
  }

  exportJson(projectId: number, slackFactor?: number): Observable<Blob> {
    let params = new HttpParams();
    if (slackFactor !== undefined) {
      params = params.set('slack_factor', slackFactor.toString());
    }
    return this.http.get(`${this.apiUrl}/exports/${projectId}/json`, {
      params,
      responseType: 'blob'
    });
  }

  exportPdf(projectId: number, pageNumber?: number, pageWidth?: number, pageHeight?: number, rotation?: number): Observable<Blob> {
    let params = new HttpParams();
    if (pageNumber !== undefined) {
      params = params.set('page_number', pageNumber.toString());
    }
    if (pageWidth !== undefined) {
      params = params.set('page_width', pageWidth.toString());
    }
    if (pageHeight !== undefined) {
      params = params.set('page_height', pageHeight.toString());
    }
    if (rotation !== undefined) {
      params = params.set('rotation', rotation.toString());
    }
    return this.http.get(`${this.apiUrl}/exports/${projectId}/pdf`, {
      params,
      responseType: 'blob'
    });
  }

  // Cable Configuration
  getCableCounts(projectId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/projects/${projectId}/cable-counts`);
  }

  getCableConfiguration(projectId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/projects/${projectId}/cable-configuration`);
  }

  saveCableConfiguration(projectId: number, config: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/projects/${projectId}/cable-configuration`, config);
  }
}
