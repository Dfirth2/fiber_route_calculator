import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { StateService, Marker, Polyline, Conduit, MarkerLink } from '../../core/services/state.service';
import { PDFViewerComponent } from '../pdf-viewer/pdf-viewer.component';
import { DrawingCanvasComponent } from '../drawing-canvas/drawing-canvas.component';

@Component({
  selector: 'app-project-editor',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    PDFViewerComponent,
    DrawingCanvasComponent
  ],
  template: `
    <div *ngIf="projectId" class="flex flex-col h-full">
      <div class="bg-white border-b shadow p-3 flex justify-between items-center">
        <div class="flex items-center gap-3">
          <button (click)="goHome()" class="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium">
            ← Home
          </button>
          <h2 class="text-lg font-semibold">Project Editor</h2>
        </div>
        <button (click)="saveProject()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">
          Save Project
        </button>
      </div>
      <div class="grid grid-cols-4 gap-4 flex-1 overflow-hidden">
        <div class="col-span-3 flex flex-col relative">
        <app-pdf-viewer 
          [pdfUrl]="pdfUrl"
          [projectId]="projectId"
          [syncedTerminals]="syncedTerminalsList"
          [syncedDrops]="syncedDropsList"
          [syncedPolylines]="syncedPolylinesList"
          (canvasReady)="onCanvasReady($event)"
          (polylinesChanged)="onPolylinesChanged($event)"
          (terminalsChanged)="onTerminalsChanged($event)"
          (dropsChanged)="onDropsChanged($event)"
        ></app-pdf-viewer>
        <div *ngIf="pdfCanvas && viewport" class="absolute inset-0">
          <app-drawing-canvas 
            [pdfCanvas]="pdfCanvas"
            [viewport]="viewport"
            [isActive]="markerMode === 'terminal' || markerMode === 'dropPed'"
            [projectId]="projectId"
          ></app-drawing-canvas>
        </div>
      </div>

      <aside class="col-span-1 bg-white border rounded p-4 space-y-4 overflow-y-auto">
        <div class="space-y-2">
          <h3 class="font-semibold text-sm">Terminals ({{ terminals.length }})</h3>
          <ul class="space-y-1 text-sm text-gray-700" *ngIf="terminals.length; else noTerminals">
            <li *ngFor="let t of terminals; let i = index" class="flex justify-between items-center bg-gray-50 p-2 rounded">
              <span>Terminal {{ String.fromCharCode(65 + i) }}</span>
              <button (click)="removeTerminal(t)" class="text-xs text-red-600 hover:text-red-800">Remove</button>
            </li>
          </ul>
          <ng-template #noTerminals><div class="text-xs text-gray-500">None placed</div></ng-template>
        </div>

        <div class="space-y-2">
          <h3 class="font-semibold text-sm">Drop Peds ({{ drops.length }})</h3>
          <ul class="space-y-1 text-sm text-gray-700" *ngIf="drops.length; else noDrops">
            <li *ngFor="let d of drops; let i = index" class="flex justify-between items-center bg-gray-50 p-2 rounded">
              <span>Drop Ped {{ String.fromCharCode(65 + i) }}</span>
              <button (click)="removeDrop(d)" class="text-xs text-red-600 hover:text-red-800">Remove</button>
            </li>
          </ul>
          <ng-template #noDrops><div class="text-xs text-gray-500">None placed</div></ng-template>
        </div>

        <div class="space-y-2">
          <h3 class="font-semibold text-sm">Fiber Segments ({{ fiberSegments.length }})</h3>
          <ul class="space-y-1 text-sm text-gray-700" *ngIf="fiberSegments.length; else noFiber">
            <li *ngFor="let seg of fiberSegments" class="flex justify-between items-center bg-gray-50 p-2 rounded">
              <span>{{ seg.name || 'Route' }} – page {{ seg.page_number }} – {{ seg.length_ft ? seg.length_ft.toFixed(1) : '0.0' }} ft</span>
              <button (click)="removeFiber(seg)" class="text-xs text-red-600 hover:text-red-800">Remove</button>
            </li>
          </ul>
          <ng-template #noFiber><div class="text-xs text-gray-500">No fiber drawn</div></ng-template>
        </div>

        <div class="space-y-2">
          <h3 class="font-semibold text-sm">Links & Conduits ({{ conduits.length }})</h3>
          <ul class="space-y-1 text-sm text-gray-700" *ngIf="conduits.length; else noConduits">
            <li *ngFor="let c of conduits" class="flex justify-between items-center bg-gray-50 p-2 rounded">
              <span>Terminal {{ c.terminal_id }} → Drop {{ c.drop_ped_id }} — {{ c.footage ? c.footage.toFixed(1) : '0.0' }} ft (page {{ c.page_number }})</span>
              <button (click)="removeConduit(c)" class="text-xs text-red-600 hover:text-red-800">Remove</button>
            </li>
          </ul>
          <ng-template #noConduits><div class="text-xs text-gray-500">No conduits linked</div></ng-template>
        </div>

        <div class="space-y-2">
          <h3 class="font-semibold text-sm">Exports</h3>
          <div class="flex flex-wrap gap-2">
            <button (click)="exportPdf()" class="px-3 py-2 rounded border hover:bg-gray-100">Annotated PDF</button>
            <button (click)="exportCsv()" class="px-3 py-2 rounded border hover:bg-gray-100">Materials CSV</button>
          </div>
        </div>
      </aside>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      height: 100%;
    }
  `]
})
export class ProjectEditorComponent implements OnInit {
  projectId: number | null = null;
  pdfUrl: string = '';
  pdfCanvas: HTMLCanvasElement | null = null;
  viewport: any = null;
  markerMode: string | null = null;
  markers: Marker[] = [];
  polylines: Polyline[] = [];
  conduits: Conduit[] = [];
  markerLinks: MarkerLink[] = [];
  String = String; // Make String accessible in templates

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private stateService: StateService
  ) {
    this.stateService.markers$.subscribe(m => this.markers = m);
    this.stateService.polylines$.subscribe(p => this.polylines = p);
    this.stateService.conduits$.subscribe(c => this.conduits = c);
    this.stateService.markerLinks$.subscribe(l => this.markerLinks = l);
  }

  goHome() {
    window.location.href = '/';
  }

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.projectId = parseInt(params['id']);
      if (this.projectId) {
        this.loadProject();
      }
    });
  }

  loadProject() {
    if (!this.projectId) return;
    this.apiService.getProject(this.projectId).subscribe(
      (project) => {
        this.stateService.setProject(project);
        this.pdfUrl = `${window.location.protocol}//${window.location.hostname}:8000/api/projects/${this.projectId}/pdf`;
        this.loadProjectData();
      },
      (error) => console.error('Failed to load project', error)
    );
  }

  loadProjectData() {
    if (!this.projectId) return;
    this.apiService.getMarkers(this.projectId).subscribe((markers) => {
      this.markers = markers;
      this.stateService.setMarkers(markers);
    });
    this.apiService.getPolylines(this.projectId).subscribe((polylines) => {
      this.polylines = polylines;
      this.stateService.setPolylines(polylines);
    });
    this.apiService.getConduits(this.projectId).subscribe((conduits) => {
      this.conduits = conduits;
      this.stateService.setConduits(conduits);
    });
    this.apiService.getMarkerLinks(this.projectId).subscribe((links) => {
      this.markerLinks = links;
      this.stateService.setMarkerLinks(links);
    });
  }

  onCanvasReady(event: any) {
    this.pdfCanvas = event.canvas;
    this.viewport = event.viewport;
  }

  onPolylinesChanged(polylines: any[]) {
    // Update polylines with the local drawing data from pdf-viewer
    const fiberPolylines = polylines.filter(p => p.type === 'fiber').map((p, idx) => ({
      id: this.polylines[idx]?.id || -idx - 1, // Keep existing ID or use negative for new
      project_id: this.projectId || 0,
      page_number: 1,
      name: `Fiber Route ${idx + 1}`,
      points: p.points,
      length_ft: p.lengthFt
    }));
    
    this.polylines = fiberPolylines;
  }

  onTerminalsChanged(terminals: any[]) {
    // Update markers with the local terminal data from pdf-viewer
    const existingTerminals = this.markers.filter(m => m.marker_type === 'terminal');
    const terminalMarkers = terminals.map((t, idx) => ({
      id: existingTerminals[idx]?.id || -idx - 1, // Keep existing ID or use negative for new
      project_id: this.projectId || 0,
      page_number: 1,
      x: t.x,
      y: t.y,
      marker_type: 'terminal'
    }));
    
    // Keep only terminals, remove drops from this list
    this.markers = terminalMarkers;
  }

  onDropsChanged(drops: any[]) {
    // Update markers with the local drop data from pdf-viewer
    const existingDrops = this.markers.filter(m => m.marker_type === 'dropPed' || m.marker_type === 'drop');
    const dropMarkers = drops.map((d, idx) => ({
      id: existingDrops[idx]?.id || -(1000 + idx), // Keep existing ID or use negative for new
      project_id: this.projectId || 0,
      page_number: 1,
      x: d.x,
      y: d.y,
      marker_type: 'dropPed'
    }));
    
    this.markers = [...this.markers.filter(m => m.marker_type === 'terminal'), ...dropMarkers];
  }

  setMarkerMode(mode: string) {
    this.markerMode = this.markerMode === mode ? null : mode;
  }

  saveProject() {
    if (!this.projectId) return;

    let saveCount = 0;
    let errorCount = 0;
    const totalItems = this.markers.filter(m => m.id < 0).length + this.polylines.filter(p => p.id < 0).length;

    if (totalItems === 0) {
      alert('No new changes to save');
      return;
    }

    // Save new markers (terminals and drops)
    this.markers.forEach(marker => {
      if (marker.id < 0) {
        this.apiService.addMarker(this.projectId || 0, {
          x: marker.x,
          y: marker.y,
          marker_type: marker.marker_type,
          page_number: marker.page_number
        }).subscribe(
          (savedMarker: any) => {
            marker.id = savedMarker.id;
            saveCount++;
            if (saveCount + errorCount === totalItems) {
              this.showSaveResults(saveCount, errorCount);
            }
          },
          (error: any) => {
            console.error('Failed to save marker:', error);
            errorCount++;
            if (saveCount + errorCount === totalItems) {
              this.showSaveResults(saveCount, errorCount);
            }
          }
        );
      }
    });

    // Save new polylines (fiber routes)
    this.polylines.forEach(polyline => {
      if (polyline.id < 0) {
        this.apiService.addPolyline(this.projectId || 0, {
          name: polyline.name,
          points: polyline.points,
          page_number: polyline.page_number
        }).subscribe(
          (savedPolyline: any) => {
            polyline.id = savedPolyline.id;
            polyline.length_ft = savedPolyline.length_ft; // Update with calculated length from backend
            saveCount++;
            if (saveCount + errorCount === totalItems) {
              this.showSaveResults(saveCount, errorCount);
            }
          },
          (error: any) => {
            console.error('Failed to save polyline:', error);
            errorCount++;
            if (saveCount + errorCount === totalItems) {
              this.showSaveResults(saveCount, errorCount);
            }
          }
        );
      }
    });
  }

  private showSaveResults(successCount: number, errorCount: number) {
    if (errorCount === 0) {
      alert(`Successfully saved ${successCount} item(s)`);
    } else {
      alert(`Saved ${successCount} item(s), ${errorCount} failed. Check console for errors.`);
    }
  }

  get terminals(): Marker[] {
    return this.markers.filter(m => m.marker_type === 'terminal');
  }

  get drops(): Marker[] {
    return this.markers.filter(m => m.marker_type === 'drop' || m.marker_type === 'dropPed');
  }

  get syncedTerminalsList(): any[] {
    return this.terminals.map((t, idx) => ({x: t.x, y: t.y, id: idx}));
  }

  get syncedDropsList(): any[] {
    return this.drops.map((d, idx) => ({x: d.x, y: d.y, id: idx}));
  }

  get syncedPolylinesList(): Polyline[] {
    return this.polylines;
  }

  get fiberSegments(): Polyline[] {
    return this.polylines;
  }

  removeTerminal(terminal: Marker) {
    if (terminal.id && terminal.id > 0) {
      this.apiService.deleteMarker(this.projectId || 0, terminal.id).subscribe(
        () => {
          this.markers = this.markers.filter(m => m !== terminal);
        },
        (error) => console.error('Failed to delete terminal:', error)
      );
    } else {
      this.markers = this.markers.filter(m => m !== terminal);
    }
  }

  removeDrop(drop: Marker) {
    if (drop.id && drop.id > 0) {
      this.apiService.deleteMarker(this.projectId || 0, drop.id).subscribe(
        () => {
          this.markers = this.markers.filter(m => m !== drop);
        },
        (error) => console.error('Failed to delete drop:', error)
      );
    } else {
      this.markers = this.markers.filter(m => m !== drop);
    }
  }

  removeFiber(fiber: Polyline) {
    if (confirm(`Delete fiber cable "${fiber.name || 'Route'}" (${fiber.length_ft?.toFixed(1) || '0.0'} ft)? This cannot be undone.`)) {
      if (fiber.id && fiber.id > 0) {
        this.apiService.deletePolyline(this.projectId || 0, fiber.id).subscribe(
          () => {
            this.polylines = this.polylines.filter(p => p !== fiber);
          },
          (error) => console.error('Failed to delete fiber:', error)
        );
      } else {
        this.polylines = this.polylines.filter(p => p !== fiber);
      }
    }
  }

  removeConduit(conduit: Conduit) {
    if (conduit.id && conduit.id > 0) {
      this.apiService.deleteConduit(this.projectId || 0, conduit.id).subscribe(
        () => {
          this.conduits = this.conduits.filter(c => c !== conduit);
        },
        (error) => console.error('Failed to delete conduit:', error)
      );
    } else {
      this.conduits = this.conduits.filter(c => c !== conduit);
    }
  }

  onCalibrationChanged(calibration: any) {
    console.log('Calibration saved:', calibration);
  }

  exportPdf() {
    if (!this.projectId) return;
    this.apiService.exportPdf(this.projectId, 1, this.viewport?.pageWidth, this.viewport?.pageHeight).subscribe(
      (blob) => {
        this.downloadFile(blob, `project_${this.projectId}_annotated.pdf`);
      }
    );
  }

  exportCsv() {
    if (!this.projectId) return;
    this.apiService.exportCsv(this.projectId).subscribe(
      (blob) => {
        this.downloadFile(blob, `project_${this.projectId}_report.csv`);
      }
    );
  }

  private downloadFile(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }
}
