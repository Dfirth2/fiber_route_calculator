import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, takeUntil } from 'rxjs';
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
            Save Now
          </button>
          <button (click)="exportPdf()" class="px-3 py-2 rounded border border-gray-300 hover:bg-gray-100 font-medium text-sm">Annotated PDF</button>
          <button (click)="buildCableCounts()" class="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 font-medium text-sm">Build Cable Counts</button>
        </div>
      </div>
      <div class="grid grid-cols-4 gap-4 flex-1">
        <div class="col-span-4 flex flex-col relative">
        <app-pdf-viewer 
          [pdfUrl]="pdfUrl"
          [projectId]="projectId"
          [syncedTerminals]="syncedTerminalsList"
          [syncedDrops]="syncedDropsList"
          [syncedHandholes]="syncedHandholesList"
          [syncedPolylines]="syncedPolylinesList"
          [syncedConduits]="syncedConduitsList"
          (canvasReady)="onCanvasReady($event)"
          (polylinesChanged)="onPolylinesChanged($event)"
          (terminalsChanged)="onTerminalsChanged($event)"
          (dropsChanged)="onDropsChanged($event)"
          (handholesChanged)="onHandholesChanged($event)"
          (conduitsChanged)="onConduitsChanged($event)"
          (currentPageChanged)="onCurrentPageChanged($event)"
          (viewportChanged)="onViewportChanged($event)"
          (rotationChanged)="onRotationChanged($event)"
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
            <span>Terminals ({{ syncedTerminalsList.length }})</span>
            <span class="text-lg">{{ expandedSections['terminals'] ? '−' : '+' }}</span>
          </button>
          <div *ngIf="expandedSections['terminals']" class="space-y-2">
            <div *ngIf="syncedTerminalsList.length; else noTerminals" class="space-y-2">
              <div *ngFor="let t of syncedTerminalsList; let i = index" class="bg-gray-50 p-2 rounded border-l-4 border-green-500">
                <div class="flex justify-between items-center text-sm">
                  <span class="font-medium">Terminal {{ getLabel(i) }}</span>
                  <span *ngIf="getTerminalAssignmentCount(t.id) > 0" class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">{{ getTerminalAssignmentCount(t.id) }} assigned</span>
                </div>
              </div>
            </div>
            <ng-template #noTerminals><div class="text-xs text-gray-500">None placed</div></ng-template>
          </div>
        </div>

        <div class="space-y-2">
          <button (click)="expandedSections['drops'] = !expandedSections['drops']" class="w-full flex justify-between items-center font-semibold text-sm text-gray-800 hover:bg-gray-100 p-2 rounded">
            <span>Drop Peds ({{ syncedDropsList.length }})</span>
            <span class="text-lg">{{ expandedSections['drops'] ? '−' : '+' }}</span>
          </button>
          <div *ngIf="expandedSections['drops']" class="space-y-2">
            <div *ngIf="syncedDropsList.length; else noDrops" class="space-y-2">
              <div *ngFor="let d of syncedDropsList; let i = index" class="bg-gray-50 p-2 rounded border-l-4 border-purple-500">
                <div class="flex justify-between items-center text-sm">
                  <span class="font-medium">Drop Ped {{ getLabel(i) }}</span>
                </div>
              </div>
            </div>
            <ng-template #noDrops><div class="text-xs text-gray-500">None placed</div></ng-template>
          </div>
        </div>

        <div class="space-y-2">
          <button (click)="expandedSections['fiber'] = !expandedSections['fiber']" class="w-full flex justify-between items-center font-semibold text-sm text-gray-800 hover:bg-gray-100 p-2 rounded">
            <span>Fiber Cable ({{ fiberSegments.length }}) – {{ totalFiberLength.toFixed(1) }} ft</span>
            <span class="text-lg">{{ expandedSections['fiber'] ? '−' : '+' }}</span>
          </button>
          <div *ngIf="expandedSections['fiber']" class="space-y-1">
            <ul class="space-y-1 text-sm text-gray-700" *ngIf="fiberSegments.length; else noFiber">
              <li *ngFor="let seg of fiberSegments" class="bg-gray-50 p-2 rounded flex items-center gap-2">
                <span class="flex-shrink-0 bg-green-600 text-white font-bold rounded-full w-6 h-6 flex items-center justify-center text-xs">{{ seg.globalIndex }}</span>
                <span class="flex-1">{{ seg.name || 'Route' }} – page {{ seg.page_number }} – {{ seg.length_ft ? seg.length_ft.toFixed(1) : '0.0' }} ft</span>
              </li>
            </ul>
            <ng-template #noFiber><div class="text-xs text-gray-500">No fiber drawn</div></ng-template>
          </div>
        </div>

        <div class="space-y-2">
          <button (click)="expandedSections['conduits'] = !expandedSections['conduits']" class="w-full flex justify-between items-center font-semibold text-sm text-gray-800 hover:bg-gray-100 p-2 rounded">
            <span>Drop Conduits ({{ filteredDropConduits.length }}) – {{ totalConduitLength.toFixed(1) }} ft</span>
            <span class="text-lg">{{ expandedSections['conduits'] ? '−' : '+' }}</span>
          </button>
          <div *ngIf="expandedSections['conduits']" class="space-y-1">
            <ul class="space-y-1 text-sm text-gray-700" *ngIf="filteredDropConduits.length; else noConduits">
              <li *ngFor="let c of filteredDropConduits" class="bg-gray-50 p-2 rounded">
                <span>{{ c.from }} → {{ c.to }} — {{ c.lengthFt.toFixed(1) }} ft</span>
              </li>
            </ul>
            <ng-template #noConduits><div class="text-xs text-gray-500">No conduits</div></ng-template>
          </div>
        </div>

        <div class="space-y-2">
          <div class="font-semibold text-sm text-gray-800 hover:bg-gray-100 p-2 rounded flex justify-between items-center">
            <span>Handholes ({{ syncedHandholesList.length }})</span>
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

      <!-- PDF Export Filename Modal -->
      <div *ngIf="showPdfExportModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-lg p-6 w-96">
          <h3 class="text-xl font-bold text-gray-800 mb-4">Export PDF</h3>
          
          <div class="space-y-4">
            <div>
              <label class="text-sm font-medium text-gray-700 block mb-1">Filename:</label>
              <input 
                type="text" 
                [(ngModel)]="pdfExportFilename"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter PDF filename"
                (keyup.enter)="confirmPdfExport()"
              />
              <p class="text-xs text-gray-500 mt-1">The .pdf extension will be added automatically</p>
            </div>
          </div>
          
          <div class="flex justify-end gap-2 mt-6">
            <button 
              (click)="showPdfExportModal = false"
              class="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button 
              (click)="confirmPdfExport()"
              [disabled]="!pdfExportFilename.trim()"
              class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export
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
export class ProjectEditorComponent implements OnInit, OnDestroy {
  projectId: number | null = null;
  pdfUrl: string = '';
  pdfCanvas: HTMLCanvasElement | null = null;
  viewport: any = null;
  pdfRotation: number = 0;
  markerMode: string | null = null;
  markers: Marker[] = [];
  polylines: Polyline[] = [];
  conduits: Conduit[] = [];
  markerLinks: MarkerLink[] = [];
  dropConduits: { index: number; from: string; to: string; lengthFt: number; pageNumber?: number }[] = [];
  conduitMetadata: { id?: number; fromId: number; fromType: 'terminal' | 'drop'; fromX?: number; fromY?: number; toId: number; toType: 'terminal' | 'drop'; toX?: number; toY?: number; lengthFt: number; pageNumber: number }[] = [];
  conduitRelationships: { terminalId: number; dropPedIds: number[] }[] = []; // Tracks which drops connect to each terminal
  assignments: any[] = []; // Store assignments for counting
  
  // Track original database state for dirty checking
  private originalMarkers: Marker[] = [];
  private originalPolylines: Polyline[] = [];
  private originalConduits: Conduit[] = [];
  private isLoadingProject: boolean = false;
  private pendingProjectLoads: number = 0;
  private isSaving: boolean = false;
  private pendingExport: boolean = false;
  private autoSave$ = new Subject<void>();
  private destroy$ = new Subject<void>();
  
  projectName: string = '';
  projectNumber: string = '';
  devlogNumber: string = '';
  ponCableName: string = '';
  showProjectDetailsModal: boolean = false;
  showPdfExportModal: boolean = false;
  pdfExportFilename: string = '';
  sidebarOpen: boolean = false;
  currentPdfPage: number = 1; // Track current page being viewed
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
      this.conduitMetadata.forEach((meta: any) => {
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
    private router: Router,
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
    this.autoSave$
      .pipe(debounceTime(1200), takeUntil(this.destroy$))
      .subscribe(() => this.saveProjectInternal(false));

    this.route.params.subscribe((params) => {
      this.projectId = parseInt(params['id']);
      if (this.projectId) {
        this.loadProject();
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProject() {
    if (!this.projectId) return;
    this.apiService.getProject(this.projectId).subscribe(
      (project) => {
        this.stateService.setProject(project);
        this.projectName = project.name || '';
        this.projectNumber = project.project_number || '';
        this.devlogNumber = project.devlog_number || '';
        this.ponCableName = project.pon_cable_name || '';
        // Use proper API URL construction - relative path for production, absolute for dev
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          this.pdfUrl = `${window.location.protocol}//${window.location.hostname}:8000/api/projects/${this.projectId}/pdf`;
        } else {
          this.pdfUrl = `/api/projects/${this.projectId}/pdf`;
        }
        this.loadProjectData();
      },
      (error) => console.error('Failed to load project', error)
    );
  }

  loadProjectData() {
    if (!this.projectId) return;

    this.isLoadingProject = true;
    this.pendingProjectLoads = 3;
    const markLoadComplete = () => {
      this.pendingProjectLoads = Math.max(0, this.pendingProjectLoads - 1);
      if (this.pendingProjectLoads === 0) {
        this.isLoadingProject = false;
      }
    };
    
    const projectId = this.projectId; // Capture for type safety
    
    // Load markers first, then load conduits (to ensure marker coordinates are available)
    this.apiService.getMarkers(projectId).subscribe({
      next: (markers) => {
        this.markers = markers;
        this.originalMarkers = JSON.parse(JSON.stringify(markers)); // Deep copy for dirty checking
        this.stateService.setMarkers(markers);
        
        // Now that markers are loaded, load conduits which need marker coordinates
        this.apiService.getConduits(projectId).subscribe({
          next: (conduits) => {
            this.conduits = conduits;
            this.originalConduits = JSON.parse(JSON.stringify(conduits)); // Deep copy for dirty checking
            this.stateService.setConduits(conduits);
            
            // Transform database conduits to metadata format for relationship building
            this.conduitMetadata = conduits.map((c: any) => {
              // Find the terminal and drop markers to get their coordinates
              const terminalMarker = this.markers.find(m => m.id === c.terminal_id);
              const dropMarker = this.markers.find(m => m.id === c.drop_ped_id);
              
              return {
                id: c.id,  // Track database ID to avoid re-saving
                fromId: c.terminal_id,
                fromType: 'terminal' as 'terminal' | 'drop',
                fromX: terminalMarker?.x,
                fromY: terminalMarker?.y,
                toId: c.drop_ped_id,
                toType: 'drop' as 'terminal' | 'drop',
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
            markLoadComplete();
          },
          error: (error) => {
            console.error('Failed to load conduits', error);
            markLoadComplete();
          }
        });
      },
      error: (error) => {
        console.error('Failed to load markers', error);
        markLoadComplete();
      }
    });
    
    // Load polylines independently (doesn't depend on markers)
    this.apiService.getPolylines(this.projectId).subscribe({
      next: (polylines) => {
        // Add type field based on name for proper rendering
        this.polylines = polylines.map((p: any) => ({
          ...p,
          type: p.name?.includes('Conduit') ? 'conduit' : 'fiber'
        }));
        this.originalPolylines = JSON.parse(JSON.stringify(this.polylines)); // Deep copy for dirty checking
        this.stateService.setPolylines(this.polylines);
        markLoadComplete();
      },
      error: (error) => {
        console.error('Failed to load polylines', error);
        markLoadComplete();
      }
    });
    
    // Load marker links independently
    this.apiService.getMarkerLinks(this.projectId).subscribe({
      next: (links) => {
        this.markerLinks = links;
        this.stateService.setMarkerLinks(links);
        markLoadComplete();
      },
      error: (error) => {
        console.error('Failed to load marker links', error);
        markLoadComplete();
      }
    });
  }

  onCanvasReady(event: any) {
    this.pdfCanvas = event.canvas;
    this.viewport = event.viewport;
  }

  onViewportChanged(viewport: any) {
    this.viewport = viewport;
    console.log('Viewport updated:', viewport);
  }

  onRotationChanged(rotation: number) {
    this.pdfRotation = rotation;
    console.log('Rotation updated:', rotation);
  }

  onCurrentPageChanged(page: number) {
    this.currentPdfPage = page;
    console.log('Current PDF page changed to:', page);
  }

  onPolylinesChanged(polylines: any[]) {
    // Update polylines with the local drawing data from pdf-viewer
    // Use separate counters for fiber routes and drop conduits
    let fiberCount = 0;
    let conduitCount = 0;
    let newPolylineId = -1;
    
    this.polylines = polylines.map((p, idx) => {
      const isFiber = p.type === 'fiber';
      const counter = isFiber ? ++fiberCount : ++conduitCount;
      
      // Check if this polyline already exists in our list by comparing points
      const existingPolyline = this.polylines.find(pl => 
        pl.points === p.points || 
        (Array.isArray(pl.points) && Array.isArray(p.points) && 
         JSON.stringify(pl.points) === JSON.stringify(p.points))
      );
      
      if (existingPolyline && existingPolyline.id) {
        // Polyline already exists, keep its ID
        return {
          ...existingPolyline,
          length_ft: p.lengthFt,
          page_number: p.pageNumber || existingPolyline.page_number,
          type: p.type
        };
      } else {
        // New polyline, assign negative ID
        return {
          id: newPolylineId--,
          project_id: this.projectId || 0,
          page_number: p.pageNumber || 1,
          name: isFiber ? `Fiber Route ${counter}` : `Drop Conduit ${counter}`,
          points: p.points,
          length_ft: p.lengthFt,
          type: p.type as 'fiber' | 'conduit'
        };
      }
    }) as any;

    this.scheduleAutoSave();
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
        page_number: this.currentPdfPage,
        x: t.x,
        y: t.y,
        marker_type: 'terminal'
      };
    });
    
    // Preserve markers from OTHER pages and non-terminal markers from current page
    const markersFromOtherPages = this.markers.filter(m => m.page_number !== this.currentPdfPage);
    const currentPageNonTerminals = this.markers.filter(m => 
      m.page_number === this.currentPdfPage && m.marker_type !== 'terminal'
    );
    
    // Merge: markers from other pages + current page non-terminals + new terminals
    this.markers = [...markersFromOtherPages, ...currentPageNonTerminals, ...terminalMarkers];

    this.scheduleAutoSave();
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
        page_number: this.currentPdfPage,
        x: d.x,
        y: d.y,
        marker_type: 'dropPed'
      };
    });
    
    // Preserve markers from OTHER pages and non-drop markers from current page
    const markersFromOtherPages = this.markers.filter(m => m.page_number !== this.currentPdfPage);
    const currentPageNonDrops = this.markers.filter(m => 
      m.page_number === this.currentPdfPage && m.marker_type !== 'dropPed' && m.marker_type !== 'drop'
    );
    
    // Merge: markers from other pages + current page non-drops + new drops
    this.markers = [...markersFromOtherPages, ...currentPageNonDrops, ...dropMarkers];

    this.scheduleAutoSave();
  }

  onHandholesChanged(handholes: any[]) {
    // Update markers with the local handhole data from pdf-viewer
    // Build map of existing handholes by position for accurate matching
    const handholeMarkers = handholes.map((h) => {
      // Find existing handhole at same position
      const existingHandhole = this.markers.find(m => 
        m.marker_type === 'handhole' && m.x === h.x && m.y === h.y
      );
      return {
        id: existingHandhole?.id || h.id || -(2000000 + Math.floor(Math.random() * 999999)), // Use existing, pdf-viewer's, or generate new
        project_id: this.projectId || 0,
        page_number: this.currentPdfPage,
        x: h.x,
        y: h.y,
        marker_type: 'handhole'
      };
    });
    
    // Preserve markers from OTHER pages and non-handhole markers from current page
    const markersFromOtherPages = this.markers.filter(m => m.page_number !== this.currentPdfPage);
    const currentPageNonHandholes = this.markers.filter(m => 
      m.page_number === this.currentPdfPage && m.marker_type !== 'handhole'
    );
    
    // Merge: markers from other pages + current page non-handholes + new handholes
    this.markers = [...markersFromOtherPages, ...currentPageNonHandholes, ...handholeMarkers];

    this.scheduleAutoSave();
  }

  onConduitsChanged(conduits: any[]) {
    // Preserve conduits from other pages, only update current page conduits
    const conduitsFromOtherPages = this.conduitMetadata.filter(c => !c.pageNumber || c.pageNumber !== this.currentPdfPage);
    // New conduits from the viewer don't have an ID - assign negative IDs to track them as new
    const newConduitCounter = Math.min(...this.conduitMetadata.filter(c => !c.id || c.id < 0).map(c => c.id || 0), -1) - 1;
    const currentPageConduits = conduits.map((c, idx) => ({
      id: c.id !== undefined ? c.id : newConduitCounter - idx,  // Negative ID for new conduits
      ...c,
      pageNumber: this.currentPdfPage
    }));
    const epsilon = 0.01;
    const resolveMarker = (meta: any, isFrom: boolean) => {
      const x = isFrom ? meta.fromX : meta.toX;
      const y = isFrom ? meta.fromY : meta.toY;
      const id = isFrom ? meta.fromId : meta.toId;

      if (x !== undefined && y !== undefined) {
        const matchByCoord = this.markers.find(m =>
          Math.abs(m.x - x) < epsilon &&
          Math.abs(m.y - y) < epsilon
        );
        if (matchByCoord) return matchByCoord;
      }

      if (id !== undefined) {
        return this.markers.find(m => m.id === id);
      }

      return null;
    };

    const validCurrentPageConduits = currentPageConduits.filter((meta) => {
      const fromMarker = resolveMarker(meta, true);
      const toMarker = resolveMarker(meta, false);
      return !!fromMarker && !!toMarker;
    });

    this.conduitMetadata = [...conduitsFromOtherPages, ...validCurrentPageConduits];
    console.log('Conduits changed, metadata:', this.conduitMetadata);
    
    // Rebuild relationship map to update assignment counts
    this.buildRelationshipMap();
    
    // Update dropConduits with formatted conduit data - include ALL current page conduits, not just valid ones
    this.dropConduits = currentPageConduits.map((meta: any, index: number) => {
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
      
      // Get labels based on marker type and position in their respective arrays
      const fromLabel = fromMarker 
        ? `${fromMarker.marker_type === 'terminal' ? 'Terminal' : 'Drop Ped'} "${this.getLabel(
            fromMarker.marker_type === 'terminal' 
              ? this.terminals.indexOf(fromMarker)
              : this.drops.indexOf(fromMarker)
          )}"`
        : 'Unknown';
      const toLabel = toMarker
        ? `Drop Ped "${this.getLabel(this.drops.indexOf(toMarker))}"`
        : 'Unknown';
      
      return {
        index: index,
        from: fromLabel,
        to: toLabel,
        lengthFt: meta.lengthFt,
        pageNumber: meta.pageNumber
      };
    });

    this.scheduleAutoSave();
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

  /**
   * Get markers that need to be saved (new or modified)
   */
  private getChangedMarkers(): Marker[] {
    return this.markers.filter(m => {
      // New markers (negative ID)
      if (m.id < 0) return true;
      
      // Check if marker was modified
      const originalMarker = this.originalMarkers.find(om => om.id === m.id);
      if (!originalMarker) return true; // Marker not in original, should be new but has positive ID (shouldn't happen)
      
      // Compare marker properties
      return m.x !== originalMarker.x || 
             m.y !== originalMarker.y || 
             m.marker_type !== originalMarker.marker_type ||
             m.page_number !== originalMarker.page_number;
    });
  }

  /**
   * Get markers that were deleted (in original but not in current)
   */
  private getDeletedMarkerIds(): number[] {
    return this.originalMarkers
      .filter(om => om.id > 0 && !this.markers.find(m => m.id === om.id))
      .map(om => om.id);
  }

  /**
   * Get polylines that need to be saved (new or modified)
   */
  private getChangedPolylines(): Polyline[] {
    return this.polylines.filter(p => {
      // Skip conduit-type polylines - they're stored separately in Conduit table
      if (p.type === 'conduit') return false;
      
      // New polylines (negative ID)
      if (p.id < 0) return true;
      
      // Check if polyline was modified
      const originalPolyline = this.originalPolylines.find(op => op.id === p.id);
      if (!originalPolyline) return true;
      
      // Compare polyline properties
      return p.name !== originalPolyline.name || 
             p.page_number !== originalPolyline.page_number ||
             JSON.stringify(p.points) !== JSON.stringify(originalPolyline.points);
    });
  }

  /**
   * Get polylines that were deleted
   */
  private getDeletedPolylineIds(): number[] {
    return this.originalPolylines
      .filter(op => {
        // Skip conduit-type polylines - they're managed separately
        if (op.type === 'conduit') return false;
        return op.id > 0 && !this.polylines.find(p => p.id === op.id);
      })
      .map(op => op.id);
  }

  /**
   * Get conduits that need to be saved (new or modified)
   */
  private getChangedConduits(): any[] {
    return this.conduitMetadata.filter(c => {
      // New conduits (no ID or negative ID)
      if (!c.id || c.id < 0) return true;
      
      // Check if conduit was modified
      const originalConduit = this.originalConduits.find(oc => oc.id === c.id);
      if (!originalConduit) return true;
      
      // Compare conduit properties
      return c.fromId !== originalConduit.terminal_id ||
             c.toId !== originalConduit.drop_ped_id ||
             c.lengthFt !== originalConduit.footage ||
             c.pageNumber !== originalConduit.page_number;
    });
  }

  /**
   * Get conduits that were deleted
   */
  private getDeletedConduitIds(): number[] {
    return this.originalConduits
      .filter(oc => oc.id > 0 && !this.conduitMetadata.find(c => c.id === oc.id))
      .map(oc => oc.id);
  }

  private scheduleAutoSave() {
    if (!this.projectId || this.isLoadingProject) return;
    this.autoSave$.next();
  }

  private syncOriginalState() {
    this.originalMarkers = JSON.parse(JSON.stringify(this.markers));
    this.originalPolylines = JSON.parse(JSON.stringify(this.polylines));
    this.originalConduits = JSON.parse(JSON.stringify(
      this.conduitMetadata.map((meta: any) => ({
        id: meta.id,
        project_id: this.projectId || 0,
        terminal_id: meta.fromId,
        drop_ped_id: meta.toId,
        footage: meta.lengthFt,
        page_number: meta.pageNumber
      }))
    ));
  }

  saveProject() {
    this.saveProjectInternal(true);
  }

  private saveProjectInternal(showAlerts: boolean, onSuccess?: () => void) {
    if (!this.projectId) return;
    if (this.isSaving) {
      if (onSuccess) {
        this.pendingExport = true;
      }
      return;
    }

    let saveCount = 0;
    let errorCount = 0;

    const changedMarkers = this.getChangedMarkers();
    const changedPolylines = this.getChangedPolylines();
    const changedConduits = this.getChangedConduits();
    const deletedMarkerIds = this.getDeletedMarkerIds();
    const deletedPolylineIds = this.getDeletedPolylineIds();
    const deletedConduitIds = this.getDeletedConduitIds();

    const newMarkers = changedMarkers.filter(m => m.id < 0);
    const modifiedMarkers = changedMarkers.filter(m => m.id > 0);
    const newPolylines = changedPolylines.filter(p => p.id < 0);
    const modifiedPolylines = changedPolylines.filter(p => p.id > 0);
    const newConduits = changedConduits.filter(c => !c.id || c.id < 0);
    const modifiedConduits = changedConduits.filter(c => c.id && c.id > 0);

    const totalItems = newMarkers.length + modifiedMarkers.length + deletedMarkerIds.length +
      newPolylines.length + modifiedPolylines.length + deletedPolylineIds.length +
      newConduits.length + modifiedConduits.length + deletedConduitIds.length;

    console.log('Save Project called with dirty checking:', {
      newMarkers: newMarkers.length,
      modifiedMarkers: modifiedMarkers.length,
      deletedMarkers: deletedMarkerIds.length,
      newPolylines: newPolylines.length,
      modifiedPolylines: modifiedPolylines.length,
      deletedPolylines: deletedPolylineIds.length,
      newConduits: newConduits.length,
      modifiedConduits: modifiedConduits.length,
      deletedConduits: deletedConduitIds.length,
      totalItems
    });

    if (totalItems === 0) {
      if (showAlerts) {
        alert('No changes to save');
      }
      if (onSuccess) {
        onSuccess();
      }
      return;
    }

    this.isSaving = true;

    const finalizeSave = () => {
      if (saveCount + errorCount !== totalItems) return;

      this.isSaving = false;
      if (errorCount === 0) {
        this.syncOriginalState();
        if (onSuccess) {
          onSuccess();
        }
        if (this.pendingExport) {
          this.pendingExport = false;
          this.performPdfExport();
        }
      }

      if (showAlerts) {
        this.showSaveResults(saveCount, errorCount);
      }
    };

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

          this.conduitMetadata.forEach(meta => {
            if (meta.fromId === oldId) meta.fromId = savedMarker.id;
            if (meta.toId === oldId) meta.toId = savedMarker.id;
          });

          saveCount++;
          finalizeSave();
        },
        (error: any) => {
          console.error('Failed to save marker:', error);
          errorCount++;
          finalizeSave();
        }
      );
    });

    modifiedMarkers.forEach(marker => {
      this.apiService.updateMarker(this.projectId || 0, marker.id, {
        x: marker.x,
        y: marker.y,
        marker_type: marker.marker_type,
        page_number: marker.page_number
      }).subscribe(
        () => {
          saveCount++;
          finalizeSave();
        },
        (error: any) => {
          console.error('Failed to update marker:', error);
          errorCount++;
          finalizeSave();
        }
      );
    });

    deletedMarkerIds.forEach(markerId => {
      this.apiService.deleteMarker(this.projectId || 0, markerId).subscribe(
        () => {
          saveCount++;
          finalizeSave();
        },
        (error: any) => {
          // 404 on delete means it's already gone, which is fine
          if (error.status === 404) {
            console.warn(`Marker ${markerId} already deleted`);
            saveCount++;
          } else {
            console.error('Failed to delete marker:', error);
            errorCount++;
          }
          finalizeSave();
        }
      );
    });

    newPolylines.forEach(polyline => {
      this.apiService.addPolyline(this.projectId || 0, {
        name: polyline.name,
        points: polyline.points,
        page_number: polyline.page_number
      }).subscribe(
        (savedPolyline: any) => {
          polyline.id = savedPolyline.id;
          polyline.length_ft = savedPolyline.length_ft;
          saveCount++;
          finalizeSave();
        },
        (error: any) => {
          console.error('Failed to save polyline:', error);
          errorCount++;
          finalizeSave();
        }
      );
    });

    modifiedPolylines.forEach(polyline => {
      this.apiService.updatePolyline(this.projectId || 0, polyline.id, {
        name: polyline.name,
        points: polyline.points,
        page_number: polyline.page_number
      }).subscribe(
        (updatedPolyline: any) => {
          polyline.length_ft = updatedPolyline.length_ft;
          saveCount++;
          finalizeSave();
        },
        (error: any) => {
          console.error('Failed to update polyline:', error);
          errorCount++;
          finalizeSave();
        }
      );
    });

    deletedPolylineIds.forEach(polylineId => {
      this.apiService.deletePolyline(this.projectId || 0, polylineId).subscribe(
        () => {
          saveCount++;
          finalizeSave();
        },
        (error: any) => {
          // 404 on delete means it's already gone, which is fine
          if (error.status === 404) {
            console.warn(`Polyline ${polylineId} already deleted`);
            saveCount++;
          } else {
            console.error('Failed to delete polyline:', error);
            errorCount++;
          }
          finalizeSave();
        }
      );
    });

    newConduits.forEach((meta, idx) => {
      const fromMarker = this.markers.find(m => m.id === meta.fromId);
      const toMarker = this.markers.find(m => m.id === meta.toId);

      if (!fromMarker || !toMarker) {
        console.warn(`Skipping conduit ${idx}: Markers not found`);
        errorCount++;
        finalizeSave();
        return;
      }

      this.apiService.addConduit(this.projectId || 0, {
        page_number: meta.pageNumber || 1,
        terminal_id: fromMarker.id,
        drop_ped_id: toMarker.id,
        footage: meta.lengthFt
      }).subscribe(
        (savedConduit: any) => {
          meta.id = savedConduit.id;
          saveCount++;
          finalizeSave();
        },
        (error: any) => {
          console.error('Failed to save conduit:', error);
          errorCount++;
          finalizeSave();
        }
      );
    });

    modifiedConduits.forEach((meta, idx) => {
      if (!meta.id) return;
      const fromMarker = this.markers.find(m => m.id === meta.fromId);
      const toMarker = this.markers.find(m => m.id === meta.toId);

      if (!fromMarker || !toMarker) {
        console.warn(`Skipping conduit ${idx}: Markers not found`);
        errorCount++;
        finalizeSave();
        return;
      }

      this.apiService.updateConduit(this.projectId || 0, meta.id, {
        page_number: meta.pageNumber || 1,
        terminal_id: fromMarker.id,
        drop_ped_id: toMarker.id,
        footage: meta.lengthFt
      }).subscribe(
        () => {
          saveCount++;
          finalizeSave();
        },
        (error: any) => {
          console.error('Failed to update conduit:', error);
          errorCount++;
          finalizeSave();
        }
      );
    });

    deletedConduitIds.forEach(conduitId => {
      this.apiService.deleteConduit(this.projectId || 0, conduitId).subscribe(
        () => {
          saveCount++;
          finalizeSave();
        },
        (error: any) => {
          // 404 on delete means it's already gone, which is fine
          if (error.status === 404) {
            console.warn(`Conduit ${conduitId} already deleted`);
            saveCount++;
          } else {
            console.error('Failed to delete conduit:', error);
            errorCount++;
          }
          finalizeSave();
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

  get handholes(): Marker[] {
    return this.markers.filter(m => m.marker_type === 'handhole');
  }

  get syncedTerminalsList(): any[] {
    // Filter to only show terminals from the current page
    return this.terminals
      .filter(t => !t.page_number || t.page_number === this.currentPdfPage)
      .map((t) => ({x: t.x, y: t.y, id: t.id, marker_type: t.marker_type}));
  }

  get syncedDropsList(): any[] {
    // Filter to only show drops from the current page
    return this.drops
      .filter(d => !d.page_number || d.page_number === this.currentPdfPage)
      .map((d) => ({x: d.x, y: d.y, id: d.id, marker_type: d.marker_type}));
  }

  get syncedHandholesList(): any[] {
    // Filter to only show handholes from the current page
    return this.handholes
      .filter(h => !h.page_number || h.page_number === this.currentPdfPage)
      .map((h) => ({x: h.x, y: h.y, id: h.id, marker_type: h.marker_type}));
  }

  get syncedPolylinesList(): any[] {
    // Return ALL polylines (not filtered by page) so pdf-viewer can manage them across pages
    // pdf-viewer will handle page filtering during rendering
    return this.polylines.map(p => ({
      points: p.points,
      lengthFt: p.length_ft,  // Transform from snake_case to camelCase for pdf-viewer
      type: p.type,
      pageNumber: p.page_number
    }));
  }

  get syncedConduitsList(): any[] {
    // Return ALL conduits (not filtered by page) so pdf-viewer can manage them across pages
    return this.conduitMetadata;
  }

  get fiberSegments(): (Polyline & { globalIndex: number })[] {
    // Get all fiber polylines sorted by page and id for consistent global numbering
    const allFiberPolylines = this.polylines
      .filter(p => p.type === 'fiber')
      .sort((a, b) => {
        if (a.page_number !== b.page_number) return (a.page_number || 0) - (b.page_number || 0);
        return (a.id || 0) - (b.id || 0);
      });
    
    // Assign global indices
    const withGlobalIndices = allFiberPolylines.map((p, idx) => ({
      ...p,
      globalIndex: idx + 1
    }));
    
    // Filter to current page only
    return withGlobalIndices.filter(p => !p.page_number || p.page_number === this.currentPdfPage);
  }

  get totalFiberLength(): number {
    return this.fiberSegments.reduce((total, seg) => total + (seg.length_ft || 0), 0);
  }

  get filteredDropConduits(): { index: number; from: string; to: string; lengthFt: number; pageNumber?: number }[] {
    return this.dropConduits.filter(c => !c.pageNumber || c.pageNumber === this.currentPdfPage);
  }

  get totalConduitLength(): number {
    return this.filteredDropConduits.reduce((total, conduit) => total + (conduit.lengthFt || 0), 0);
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
    
    // Set default filename to project name
    this.pdfExportFilename = this.projectName || `project_${this.projectId}`;
    
    // Show the filename modal
    this.showPdfExportModal = true;
  }

  confirmPdfExport() {
    if (!this.projectId || !this.pdfExportFilename.trim()) return;
    
    this.showPdfExportModal = false;
    
    // Check if there are unsaved changes
    const newMarkers = this.markers.filter(m => m.id < 0);
    const newPolylines = this.polylines.filter(p => p.id < 0);
    
    // Check for unsaved conduits (those with markers that exist but might not be saved yet)
    const unsavedConduits = this.conduitMetadata.filter(c => {
      const fromMarker = this.markers.find(m => m.id === c.fromId);
      const toMarker = this.markers.find(m => m.id === c.toId);
      // Conduit is unsaved if markers don't exist or have negative IDs
      return !fromMarker || !toMarker || fromMarker.id < 0 || toMarker.id < 0;
    });
    
    const hasUnsavedChanges = newMarkers.length > 0 || newPolylines.length > 0 || unsavedConduits.length > 0;
    
    if (hasUnsavedChanges) {
      // Save first, then export
      console.log('Saving project before export...', {
        newMarkers: newMarkers.length,
        newPolylines: newPolylines.length,
        unsavedConduits: unsavedConduits.length
      });
      this.saveProjectBeforeExport();
    } else {
      // No unsaved changes, export directly
      this.performPdfExport();
    }
  }

  private saveProjectBeforeExport() {
    if (!this.projectId) return;

    if (this.isSaving) {
      this.pendingExport = true;
      return;
    }

    this.saveProjectInternal(false, () => this.performPdfExport());
  }

  private performPdfExport() {
    if (!this.projectId) return;
    console.log('Exporting PDF...');
    // Use custom filename from modal
    const filename = this.pdfExportFilename.trim();
    const finalFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    
    // Send the actual viewport dimensions (which include rotation)
    const pageWidth = this.viewport?.width;
    const pageHeight = this.viewport?.height;
    console.log('Viewport object:', this.viewport);
    console.log(`Exporting with viewport dimensions: ${pageWidth} x ${pageHeight}`);
    
    this.apiService.exportPdf(this.projectId, undefined, pageWidth, pageHeight, this.pdfRotation).subscribe(
      (blob: Blob) => {
        this.downloadFile(blob, finalFilename);
      },
      (error: any) => {
        console.error('Failed to export PDF:', error);
        alert('Failed to export PDF. Please try again.');
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

  buildCableCounts() {
    if (!this.projectId) return;
    window.open(`/projects/${this.projectId}/cable-builder`, '_blank');
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
