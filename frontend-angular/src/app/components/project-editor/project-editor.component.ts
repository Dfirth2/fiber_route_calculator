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
    <div *ngIf="projectId" class="flex flex-col h-full overflow-y-scroll">
      <div class="bg-white border-b shadow p-3 flex justify-between items-center">
        <div class="flex items-center gap-3">
          <button (click)="goHome()" class="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium">
            ← Home
          </button>
          <h2 class="text-lg font-semibold">Project Editor</h2>
        </div>
        <div class="flex items-center gap-2">
          <button (click)="saveProject()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">
            Save Project
          </button>
          <button (click)="exportPdf()" class="px-3 py-2 rounded border border-gray-300 hover:bg-gray-100 font-medium text-sm">Annotated PDF</button>
          <button (click)="exportCsv()" class="px-3 py-2 rounded border border-gray-300 hover:bg-gray-100 font-medium text-sm">Materials CSV</button>
        </div>
      </div>
      <div class="grid grid-cols-4 gap-4 flex-1">
        <div class="col-span-4 flex flex-col relative">
        <app-pdf-viewer 
          [pdfUrl]="pdfUrl"
          [projectId]="projectId"
          [syncedTerminals]="syncedTerminalsList"
          [syncedDrops]="syncedDropsList"
          [syncedPolylines]="syncedPolylinesList"
          [syncedConduits]="syncedConduitsList"
          (canvasReady)="onCanvasReady($event)"
          (polylinesChanged)="onPolylinesChanged($event)"
          (terminalsChanged)="onTerminalsChanged($event)"
          (dropsChanged)="onDropsChanged($event)"
          (conduitsChanged)="onConduitsChanged($event)"
        ></app-pdf-viewer>
        <div *ngIf="pdfCanvas && viewport" class="absolute inset-0">
          <app-drawing-canvas 
            [pdfCanvas]="pdfCanvas"
            [viewport]="viewport"
            [isActive]="markerMode === 'terminal' || markerMode === 'dropPed'"
            [projectId]="projectId"
          ></app-drawing-canvas>
        </div>
        
        <!-- Floating Toggle Button -->
        <button 
          (click)="sidebarOpen = !sidebarOpen"
          class="absolute top-3 right-4 z-30 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm"
          title="Toggle sidebar">
          {{ sidebarOpen ? '✕' : '☰' }}
        </button>
      </div>

      <!-- Floating Sidebar -->
      <div 
        *ngIf="sidebarOpen"
        class="fixed top-16 right-4 w-80 bg-white border rounded shadow-lg z-30 max-h-[calc(100vh-5rem)] overflow-y-auto p-4 space-y-4"
      >
        <div class="flex justify-between items-center mb-4 pb-2 border-b">
          <h2 class="text-lg font-bold text-gray-800">Project Details</h2>
          <div class="flex gap-2">
            <button 
              (click)="showProjectDetailsModal = true"
              class="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
            >
              Edit Project Properties
            </button>
            <button 
              (click)="sidebarOpen = false"
              class="text-lg text-gray-400 hover:text-gray-600 font-bold"
              title="Close sidebar"
            >
              ✕
            </button>
          </div>
        </div>
        
        <div class="space-y-2 mb-4 text-sm text-gray-700">
          <div *ngIf="projectNumber" class="flex justify-between items-center">
            <span class="font-medium">Project #:</span>
            <span class="text-gray-600">{{ projectNumber }}</span>
          </div>
          <div *ngIf="devlogNumber" class="flex justify-between items-center">
            <span class="font-medium">DevLog #:</span>
            <span class="text-gray-600">{{ devlogNumber }}</span>
          </div>
          <div *ngIf="ponCableName" class="flex justify-between items-center">
            <span class="font-medium">PON Cable:</span>
            <span class="text-gray-600">{{ ponCableName }}</span>
          </div>
        </div>
        
        <div class="space-y-2">
          <button (click)="expandedSections['terminals'] = !expandedSections['terminals']" class="w-full flex justify-between items-center font-semibold text-sm text-gray-800 hover:bg-gray-100 p-2 rounded">
            <span>Terminals ({{ terminals.length }})</span>
            <span class="text-lg">{{ expandedSections['terminals'] ? '−' : '+' }}</span>
          </button>
          <div *ngIf="expandedSections['terminals']" class="space-y-2">
            <div *ngIf="terminals.length; else noTerminals" class="space-y-2">
              <div *ngFor="let t of terminals; let i = index" class="bg-gray-50 p-2 rounded border-l-4 border-green-500">
                <div class="flex justify-between items-center text-sm">
                  <span class="font-medium">Terminal {{ getLabel(i) }}</span>
                  <span *ngIf="getTerminalAssignmentCount(t.id) > 0" class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">{{ getTerminalAssignmentCount(t.id) }} assign</span>
                </div>
                <div *ngIf="getConnectedDrops(t.id).length > 0" class="mt-2 ml-2 border-l-2 border-gray-300 pl-2 space-y-1">
                  <div class="text-xs text-gray-600 font-semibold">Connected:</div>
                  <div *ngFor="let drop of getConnectedDrops(t.id); let di = index" class="text-xs text-gray-700">
                    <span>→ Drop Ped {{ getLabel(drops.indexOf(drop)) }}</span>
                    <span *ngIf="getDropAssignmentCount(drop.id) > 0" class="text-xs bg-blue-100 text-blue-800 px-1 rounded">{{ getDropAssignmentCount(drop.id) }}</span>
                  </div>
                </div>
              </div>
            </div>
            <ng-template #noTerminals><div class="text-xs text-gray-500">None placed</div></ng-template>
          </div>
        </div>

        <div class="space-y-2">
          <button (click)="expandedSections['drops'] = !expandedSections['drops']" class="w-full flex justify-between items-center font-semibold text-sm text-gray-800 hover:bg-gray-100 p-2 rounded">
            <span>Drop Peds ({{ drops.length }})</span>
            <span class="text-lg">{{ expandedSections['drops'] ? '−' : '+' }}</span>
          </button>
          <div *ngIf="expandedSections['drops']" class="space-y-2">
            <div *ngIf="drops.length; else noDrops" class="space-y-2">
              <div *ngFor="let d of drops; let i = index" class="bg-gray-50 p-2 rounded border-l-4 border-purple-500">
                <div class="flex justify-between items-center text-sm">
                  <span class="font-medium">Drop Ped {{ getLabel(i) }}</span>
                  <span *ngIf="getDropAssignmentCount(d.id) > 0" class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{{ getDropAssignmentCount(d.id) }} assign</span>
                </div>
              </div>
            </div>
            <ng-template #noDrops><div class="text-xs text-gray-500">None placed</div></ng-template>
          </div>
        </div>

        <div class="space-y-2">
          <button (click)="expandedSections['fiber'] = !expandedSections['fiber']" class="w-full flex justify-between items-center font-semibold text-sm text-gray-800 hover:bg-gray-100 p-2 rounded">
            <span>Fiber Cable ({{ fiberSegments.length }})</span>
            <span class="text-lg">{{ expandedSections['fiber'] ? '−' : '+' }}</span>
          </button>
          <div *ngIf="expandedSections['fiber']" class="space-y-1">
            <ul class="space-y-1 text-sm text-gray-700" *ngIf="fiberSegments.length; else noFiber">
              <li *ngFor="let seg of fiberSegments" class="bg-gray-50 p-2 rounded">
                <span>{{ seg.name || 'Route' }} – page {{ seg.page_number }} – {{ seg.length_ft ? seg.length_ft.toFixed(1) : '0.0' }} ft</span>
              </li>
            </ul>
            <ng-template #noFiber><div class="text-xs text-gray-500">No fiber drawn</div></ng-template>
          </div>
        </div>

        <div class="space-y-2">
          <button (click)="expandedSections['conduits'] = !expandedSections['conduits']" class="w-full flex justify-between items-center font-semibold text-sm text-gray-800 hover:bg-gray-100 p-2 rounded">
            <span>Drop Conduits ({{ dropConduits.length }})</span>
            <span class="text-lg">{{ expandedSections['conduits'] ? '−' : '+' }}</span>
          </button>
          <div *ngIf="expandedSections['conduits']" class="space-y-1">
            <ul class="space-y-1 text-sm text-gray-700" *ngIf="dropConduits.length; else noConduits">
              <li *ngFor="let c of dropConduits" class="bg-gray-50 p-2 rounded">
                <span>{{ c.from }} → {{ c.to }} — {{ c.lengthFt.toFixed(1) }} ft</span>
              </li>
            </ul>
            <ng-template #noConduits><div class="text-xs text-gray-500">No conduits</div></ng-template>
          </div>
        </div>


      </div>

      <!-- Project Details Modal -->
      <div *ngIf="showProjectDetailsModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-lg p-6 w-96">
          <h3 class="text-xl font-bold text-gray-800 mb-4">Edit Project Details</h3>
          
          <div class="space-y-4">
            <div>
              <label class="text-sm font-medium text-gray-700 block mb-1">Project #:</label>
              <input 
                type="text" 
                [(ngModel)]="projectNumber"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter project number"
              />
            </div>
            
            <div>
              <label class="text-sm font-medium text-gray-700 block mb-1">DevLog #:</label>
              <input 
                type="text" 
                [(ngModel)]="devlogNumber"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter devlog number"
              />
            </div>
            
            <div>
              <label class="text-sm font-medium text-gray-700 block mb-1">PON Cable Name:</label>
              <input 
                type="text" 
                [(ngModel)]="ponCableName"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter PON cable name"
              />
            </div>
          </div>
          
          <div class="flex justify-end gap-2 mt-6">
            <button 
              (click)="showProjectDetailsModal = false"
              class="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button 
              (click)="saveProjectDetails()"
              class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
            >
              Save
            </button>
          </div>
        </div>
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
  dropConduits: { index: number; from: string; to: string; lengthFt: number }[] = [];
  conduitMetadata: { fromId: number; fromType: 'terminal' | 'drop'; fromX?: number; fromY?: number; toId: number; toType: 'terminal' | 'drop'; toX?: number; toY?: number; lengthFt: number; pageNumber: number }[] = [];
  conduitRelationships: { terminalId: number; dropPedIds: number[] }[] = []; // Tracks which drops connect to each terminal
  assignments: any[] = []; // Store assignments for counting
  projectNumber: string = '';
  devlogNumber: string = '';
  ponCableName: string = '';
  showProjectDetailsModal: boolean = false;
  sidebarOpen: boolean = false;
  expandedSections: { [key: string]: boolean } = {
    terminals: false,
    drops: false,
    fiber: false,
    conduits: false
  };
  String = String; // Make String accessible in templates

  /**
   * Build relationship map from conduit metadata
   * Creates links showing which drops are connected to which terminals
   */
  buildRelationshipMap() {
    this.conduitRelationships = [];
    
    // Group terminals and their connected drops
    this.terminals.forEach(terminal => {
      const connectedDropIds: number[] = [];
      
      // Find all conduits that start from this terminal
      const dropConduitMetadata = (this.stateService as any).conduitMetadata || [];
      dropConduitMetadata.forEach((meta: any) => {
        if (meta.fromType === 'terminal' && meta.fromId === terminal.id && meta.toType === 'drop') {
          connectedDropIds.push(meta.toId);
        }
      });
      
      if (connectedDropIds.length > 0) {
        this.conduitRelationships.push({
          terminalId: terminal.id,
          dropPedIds: connectedDropIds
        });
      }
    });
  }

  /**
   * Get count of assignments for a terminal (direct + from connected drops)
   */
  getTerminalAssignmentCount(terminalId: number): number {
    let count = 0;
    // Count direct assignments to this terminal
    count += (this.assignments || []).filter((a: any) => a.from_marker_id === terminalId).length;
    
    // Count assignments to connected drops
    const relationship = this.conduitRelationships.find(r => r.terminalId === terminalId);
    if (relationship) {
      relationship.dropPedIds.forEach(dropId => {
        count += (this.assignments || []).filter((a: any) => a.from_marker_id === dropId).length;
      });
    }
    return count;
  }

  /**
   * Get count of assignments for a drop ped
   */
  getDropAssignmentCount(dropId: number): number {
    return (this.assignments || []).filter((a: any) => a.from_marker_id === dropId).length;
  }

  /**
   * Get drops connected to a terminal via conduits
   */
  getConnectedDrops(terminalId: number): any[] {
    const relationship = this.conduitRelationships.find(r => r.terminalId === terminalId);
    if (!relationship) return [];
    return this.drops.filter(d => relationship.dropPedIds.includes(d.id));
  }

  /**
   * Convert zero-based index to label: A, B, ..., Z, AA, AB, ..., AZ, BA, ...
   */
  getLabel(index: number): string {
    if (index < 26) {
      return String.fromCharCode(65 + index); // A-Z
    }
    // AA, AB, ..., AZ, BA, ...
    const firstChar = String.fromCharCode(65 + Math.floor((index - 26) / 26));
    const secondChar = String.fromCharCode(65 + ((index - 26) % 26));
    return firstChar + secondChar;
  }

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private stateService: StateService
  ) {
    this.stateService.markers$.subscribe(m => this.markers = m);
    this.stateService.polylines$.subscribe(p => this.polylines = p);
    this.stateService.conduits$.subscribe(c => {
      this.conduits = c;
      this.buildRelationshipMap(); // Rebuild relationships when conduits change
    });
    this.stateService.markerLinks$.subscribe(l => this.markerLinks = l);
    this.stateService.assignments$.subscribe(a => {
      this.assignments = a;
    });
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
        this.projectNumber = project.project_number || '';
        this.devlogNumber = project.devlog_number || '';
        this.ponCableName = project.pon_cable_name || '';
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
      // Add type field based on name for proper rendering
      this.polylines = polylines.map((p: any) => ({
        ...p,
        type: p.name?.includes('Conduit') ? 'conduit' : 'fiber'
      }));
      this.stateService.setPolylines(this.polylines);
    });
    this.apiService.getConduits(this.projectId).subscribe((conduits) => {
      this.conduits = conduits;
      this.stateService.setConduits(conduits);
      
      // Transform database conduits to metadata format for relationship building
      this.conduitMetadata = conduits.map((c: any) => {
        // Find the terminal and drop markers to get their coordinates
        const terminalMarker = this.markers.find(m => m.id === c.terminal_id);
        const dropMarker = this.markers.find(m => m.id === c.drop_ped_id);
        
        return {
          fromId: c.terminal_id,
          fromType: 'terminal',
          fromX: terminalMarker?.x,
          fromY: terminalMarker?.y,
          toId: c.drop_ped_id,
          toType: 'drop',
          toX: dropMarker?.x,
          toY: dropMarker?.y,
          lengthFt: c.footage,
          pageNumber: c.page_number
        };
      });
      
      // Rebuild drop conduits display list
      this.onConduitsChanged(this.conduitMetadata);
      
      // Build relationships from loaded conduits
      this.buildRelationshipMap();
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
    this.polylines = polylines.map((p, idx) => ({
      id: this.polylines.find(pl => pl.length_ft === p.lengthFt && pl.name?.includes(p.type === 'fiber' ? 'Fiber' : 'Conduit'))?.id || -idx - 1,
      project_id: this.projectId || 0,
      page_number: 1,
      name: p.type === 'fiber' ? `Fiber Route ${idx + 1}` : `Drop Conduit ${idx + 1}`,
      points: p.points,
      length_ft: p.lengthFt,
      type: p.type as 'fiber' | 'conduit'
    })) as any;
  }

  onTerminalsChanged(terminals: any[]) {
    // Update markers with the local terminal data from pdf-viewer
    // Build map of existing terminals by position for accurate matching
    const terminalMarkers = terminals.map((t) => {
      // Find existing terminal at same position
      const existingTerminal = this.markers.find(m => 
        m.marker_type === 'terminal' && m.x === t.x && m.y === t.y
      );
      return {
        id: existingTerminal?.id || t.id || Math.floor(Math.random() * -1000000), // Use existing, pdf-viewer's, or generate new
        project_id: this.projectId || 0,
        page_number: 1,
        x: t.x,
        y: t.y,
        marker_type: 'terminal'
      };
    });
    
    // Get existing drops to preserve them
    const existingDrops = this.markers.filter(m => m.marker_type === 'dropPed' || m.marker_type === 'drop');
    
    // Merge terminals and drops
    this.markers = [...terminalMarkers, ...existingDrops];
  }

  onDropsChanged(drops: any[]) {
    // Update markers with the local drop data from pdf-viewer
    // Build map of existing drops by position for accurate matching
    const dropMarkers = drops.map((d) => {
      // Find existing drop at same position
      const existingDrop = this.markers.find(m => 
        (m.marker_type === 'dropPed' || m.marker_type === 'drop') && m.x === d.x && m.y === d.y
      );
      return {
        id: existingDrop?.id || d.id || -(1000000 + Math.floor(Math.random() * 999999)), // Use existing, pdf-viewer's, or generate new
        project_id: this.projectId || 0,
        page_number: 1,
        x: d.x,
        y: d.y,
        marker_type: 'dropPed'
      };
    });
    
    // Get existing terminals to preserve them
    const existingTerminals = this.markers.filter(m => m.marker_type === 'terminal');
    
    // Merge terminals and drops
    this.markers = [...existingTerminals, ...dropMarkers];
  }

  onConduitsChanged(conduits: any[]) {
    // Store the raw metadata for saving later
    this.conduitMetadata = conduits;
    console.log('Conduits changed, metadata:', this.conduitMetadata);
    
    // Update dropConduits with formatted conduit data
    const epsilon = 0.01;
    this.dropConduits = conduits.map((meta: any, index: number) => {
      // Find markers by coordinates if available, otherwise by ID
      let fromMarker = null;
      let toMarker = null;
      
      if (meta.fromX !== undefined && meta.fromY !== undefined) {
        fromMarker = this.markers.find(m =>
          Math.abs(m.x - (meta.fromX || 0)) < epsilon &&
          Math.abs(m.y - (meta.fromY || 0)) < epsilon
        );
      }
      
      if (meta.toX !== undefined && meta.toY !== undefined) {
        toMarker = this.markers.find(m =>
          Math.abs(m.x - (meta.toX || 0)) < epsilon &&
          Math.abs(m.y - (meta.toY || 0)) < epsilon
        );
      }
      
      // Fallback to ID lookup
      if (!fromMarker) {
        fromMarker = this.markers.find(m => m.id === meta.fromId);
      }
      if (!toMarker) {
        toMarker = this.markers.find(m => m.id === meta.toId);
      }
      
      // Get labels based on marker type
      const fromLabel = fromMarker 
        ? `${fromMarker.marker_type === 'terminal' ? 'Terminal' : 'Drop Ped'} "${this.getLabel(this.markers.indexOf(fromMarker))}"`
        : 'Unknown';
      const toLabel = toMarker
        ? `Drop Ped "${this.getLabel(this.markers.indexOf(toMarker))}"`
        : 'Unknown';
      
      return {
        index: index,
        from: fromLabel,
        to: toLabel,
        lengthFt: meta.lengthFt
      };
    });
  }

  saveProjectDetails() {
    if (!this.projectId) return;
    
    console.log('Saving project details:', {
      projectNumber: this.projectNumber,
      devlogNumber: this.devlogNumber,
      ponCableName: this.ponCableName
    });
    
    this.apiService.updateProject(this.projectId, {
      project_number: this.projectNumber,
      devlog_number: this.devlogNumber,
      pon_cable_name: this.ponCableName
    }).subscribe(
      (response) => {
        console.log('Project details saved successfully:', response);
        this.showProjectDetailsModal = false;
      },
      (error) => {
        console.error('Failed to update project details', error);
      }
    );
  }

  setMarkerMode(mode: string) {
    this.markerMode = this.markerMode === mode ? null : mode;
  }

  saveProject() {
    if (!this.projectId) return;

    let saveCount = 0;
    let errorCount = 0;
    const newMarkers = this.markers.filter(m => m.id < 0);
    const newPolylines = this.polylines.filter(p => p.id < 0);
    const totalItems = newMarkers.length + newPolylines.length + this.conduitMetadata.length;

    console.log('Save Project called:', {
      newMarkers: newMarkers.length,
      newPolylines: newPolylines.length,
      conduits: this.conduitMetadata.length,
      conduitMetadata: this.conduitMetadata,
      totalItems
    });

    if (totalItems === 0) {
      alert('No new changes to save');
      return;
    }

    // Save new markers (terminals and drops)
    newMarkers.forEach(marker => {
      this.apiService.addMarker(this.projectId || 0, {
        x: marker.x,
        y: marker.y,
        marker_type: marker.marker_type,
        page_number: marker.page_number
      }).subscribe(
        (savedMarker: any) => {
          const oldId = marker.id;
          marker.id = savedMarker.id;
          
          // Update conduit metadata with new marker IDs
          this.conduitMetadata.forEach(meta => {
            if (meta.fromId === oldId) meta.fromId = savedMarker.id;
            if (meta.toId === oldId) meta.toId = savedMarker.id;
          });
          
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
    });

    // Save new polylines (fiber routes)
    newPolylines.forEach(polyline => {
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
    });

    // Save conduits (drop conduit relationships)
    // Look up markers by position since conduit metadata stores coordinates
    this.conduitMetadata.forEach((meta, idx) => {
      const epsilon = 0.01;
      
      // Try to find markers by their stored coordinates
      let fromMarker = null;
      let toMarker = null;
      
      // First try to find by coordinates if available
      if (meta.fromX !== undefined && meta.fromY !== undefined) {
        fromMarker = this.markers.find(m => 
          Math.abs(m.x - (meta.fromX || 0)) < epsilon && 
          Math.abs(m.y - (meta.fromY || 0)) < epsilon
        );
      }
      
      if (meta.toX !== undefined && meta.toY !== undefined) {
        toMarker = this.markers.find(m => 
          Math.abs(m.x - (meta.toX || 0)) < epsilon && 
          Math.abs(m.y - (meta.toY || 0)) < epsilon
        );
      }
      
      // Fallback to ID if coordinates not available
      if (!fromMarker && meta.fromId) {
        fromMarker = this.markers.find(m => m.id === meta.fromId);
      }
      if (!toMarker && meta.toId) {
        toMarker = this.markers.find(m => m.id === meta.toId);
      }
      
      if (!fromMarker || !toMarker) {
        console.warn(`Skipping conduit ${idx}: Markers not found`, {
          meta,
          fromMarkerExists: !!fromMarker,
          toMarkerExists: !!toMarker,
          availableMarkers: this.markers.map(m => ({id: m.id, x: m.x, y: m.y, type: m.marker_type}))
        });
        errorCount++;
        if (saveCount + errorCount === totalItems) {
          this.showSaveResults(saveCount, errorCount);
        }
        return;
      }
      
      console.log(`Saving conduit ${idx}:`, {
        fromId: fromMarker.id,
        toId: toMarker.id,
        lengthFt: meta.lengthFt,
        pageNumber: meta.pageNumber
      });
      
      this.apiService.addConduit(this.projectId || 0, {
        page_number: meta.pageNumber || 1,
        terminal_id: fromMarker.id,
        drop_ped_id: toMarker.id,
        footage: meta.lengthFt
      }).subscribe(
        (savedConduit: any) => {
          console.log('Conduit saved successfully:', savedConduit);
          saveCount++;
          if (saveCount + errorCount === totalItems) {
            this.showSaveResults(saveCount, errorCount);
          }
        },
        (error: any) => {
          console.error('Failed to save conduit:', error);
          errorCount++;
          if (saveCount + errorCount === totalItems) {
            this.showSaveResults(saveCount, errorCount);
          }
        }
      );
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

  get syncedConduitsList(): any[] {
    return this.conduitMetadata;
  }

  get fiberSegments(): Polyline[] {
    return this.polylines.filter(p => !p.type || p.type === 'fiber');
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

  removeDropConduit(index: number) {
    // For now, just remove from the local display array
    // In a full implementation, this would also remove from backend
    this.dropConduits = this.dropConduits.filter(c => c.index !== index);
  }

  onCalibrationChanged(calibration: any) {
    console.log('Calibration saved:', calibration);
  }

  exportPdf() {
    if (!this.projectId) return;
    this.apiService.exportPdf(this.projectId, 1, this.viewport?.pageWidth, this.viewport?.pageHeight).subscribe(
      (blob: Blob) => {
        this.downloadFile(blob, `project_${this.projectId}_annotated.pdf`);
      }
    );
  }

  exportCsv() {
    if (!this.projectId) return;
    this.apiService.exportCsv(this.projectId).subscribe(
      (blob: Blob) => {
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
