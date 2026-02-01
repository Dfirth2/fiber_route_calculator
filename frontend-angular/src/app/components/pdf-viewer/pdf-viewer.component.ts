import { Component, Input, OnChanges, OnInit, SimpleChanges, ViewChild, ElementRef, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as pdfjsLib from 'pdfjs-dist';
import { ApiService } from '../../core/services/api.service';
import { StateService, Assignment } from '../../core/services/state.service';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs';

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pdf-viewer.component.html',
  styles: [`
    :host {
      display: flex;
      height: 100%;
      width: 100%;
    }
  `]
})
export class PDFViewerComponent implements OnInit, OnChanges {
  @ViewChild('pdfCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('wrapper') wrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('overlayCanvas') overlayRef!: ElementRef<HTMLCanvasElement>;
  @Input() pdfUrl: string = '';
  @Input() projectId: number | null = null;
  @Input() syncedTerminals: any[] = [];
  @Input() syncedDrops: any[] = [];
  @Input() syncedHandholes: any[] = [];
  @Input() syncedPolylines: any[] = [];
  @Input() syncedConduits: any[] = [];

  pdf: any = null;
  currentPage = 1;
  zoom = 1;
  panOffset = { x: 0, y: 0 };
  isPanning = false;
  Math = Math;

  mode: 'pan' | 'calibrate' | 'fiber' | 'conduit' | 'terminal' | 'drop' | 'handhole' | 'assign' | 'erase' = 'pan';
  calibrationPoints: { x: number; y: number }[] = [];
  scaleFeetPerPixel: number | null = null;
  drawingPath: { x: number; y: number }[] = [];
  hoverPoint: { x: number; y: number } | null = null;
  polylines: any[] = [];
  conduitMetadata: { fromId: number; fromType: 'terminal' | 'drop'; fromX?: number; fromY?: number; toId: number; toType: 'terminal' | 'drop'; toX?: number; toY?: number; lengthFt: number; pageNumber?: number }[] = [];
  totalLengthFeet = 0;
  totalConduitFeet = 0;
  terminals: { id: number; x: number; y: number }[] = [];
  drops: { id: number; x: number; y: number }[] = [];
  handholes: { id: number; x: number; y: number }[] = [];
  selectedEndpoint: { point: { x: number; y: number }; type: 'terminal' | 'drop' } | null = null;
  assignments: Assignment[] = [];
  selectedMarkerForAssign: { id: number; x: number; y: number; type: 'terminal' | 'drop' | 'handhole' } | null = null;
  toastMessage: string | null = null;
  toastType: 'success' | 'error' | 'info' = 'info';
  showEquipmentMenu = false;
  showCalibrationMenu = false;
  showCalibrationDialog = false;
  calibrationInput: string = '';
  calibrationError: string = '';
  private assignmentsSubscribed = false;
  private toastTimer: any = null;
  private polylinesInitialized = false;
  private conduitsInitialized = false;

  private renderTask: any = null;
  private lastMouse = { x: 0, y: 0 };
  private overlayCtx: CanvasRenderingContext2D | null = null;

  @Output() polylinesChanged = new EventEmitter<any[]>();
  @Output() terminalsChanged = new EventEmitter<any[]>();
  @Output() dropsChanged = new EventEmitter<any[]>();
  @Output() handholesChanged = new EventEmitter<any[]>();
  @Output() conduitsChanged = new EventEmitter<any[]>();
  @Output() currentPageChanged = new EventEmitter<number>();
  @Output() viewportChanged = new EventEmitter<any>();

  constructor(private apiService: ApiService, private stateService: StateService) {}

  async ngOnInit() {
    if (this.pdfUrl) {
      await this.loadPdf();
      // Calibration is now loaded in loadPdf after currentPage is set
      if (this.projectId) {
        this.loadAssignments();
        this.ensureAssignmentsSubscription();
      } else {
        this.loadDrawingData();
      }
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['pdfUrl'] && !changes['pdfUrl'].firstChange && this.pdfUrl) {
      this.loadPdf();
    }
    if (changes['projectId'] && this.projectId) {
      this.loadCalibrationFromBackend();
      // Don't load markers here - parent component handles this via synced inputs
      this.loadAssignments();
      this.ensureAssignmentsSubscription();
    }
    // Always sync terminals from parent (whether projectId exists or not)
    if (changes['syncedTerminals'] && this.syncedTerminals) {
      this.terminals = this.syncedTerminals.map(t => ({...t})); // Clone to avoid reference issues
      if (!this.projectId) {
        this.saveDrawingData();
      }
      this.redrawOverlay();
    }
    // Always sync drops from parent (whether projectId exists or not)
    if (changes['syncedDrops'] && this.syncedDrops) {
      this.drops = this.syncedDrops.map(d => ({...d})); // Clone to avoid reference issues
      if (!this.projectId) {
        this.saveDrawingData();
      }
      this.redrawOverlay();
    }
    // Always sync handholes from parent (whether projectId exists or not)
    if (changes['syncedHandholes'] && this.syncedHandholes) {
      this.handholes = this.syncedHandholes.map(h => ({...h})); // Clone to avoid reference issues
      if (!this.projectId) {
        this.saveDrawingData();
      }
      this.redrawOverlay();
    }
    if (changes['syncedPolylines'] && this.syncedPolylines) {
      // Sync from parent in these cases:
      // 1. Local mode (no projectId) - always sync
      // 2. Backend mode and we haven't loaded data yet (empty local array)
      // 3. Backend mode and incoming data is non-empty (real data from backend)
      const shouldSync = !this.projectId || 
                         this.polylines.length === 0 || 
                         (this.syncedPolylines.length > 0 && !this.polylinesInitialized);
      
      if (shouldSync) {
        if (!this.projectId) {
          // Local mode: only sync current page polylines
          const polylinesFromOtherPages = this.polylines.filter(p => !p.pageNumber || p.pageNumber !== this.currentPage);
          const currentPagePolylines = this.syncedPolylines;
          this.polylines = [...polylinesFromOtherPages, ...currentPagePolylines];
          this.saveDrawingData();
        } else {
          // Backend mode: parent sends ALL polylines, replace entire array
          this.polylines = [...this.syncedPolylines];
          if (this.syncedPolylines.length > 0) {
            this.polylinesInitialized = true; // Mark as initialized after receiving real data
          }
        }
        this.redrawOverlay();
      }
    }
    if (changes['syncedConduits'] && this.syncedConduits) {
      // Sync from parent in these cases:
      // 1. Local mode (no projectId) - always sync
      // 2. Backend mode and we haven't loaded data yet (empty local array)
      // 3. Backend mode and incoming data is non-empty (real data from backend)
      const shouldSync = !this.projectId || 
                         this.conduitMetadata.length === 0 || 
                         (this.syncedConduits.length > 0 && !this.conduitsInitialized);
      
      if (shouldSync) {
        if (!this.projectId) {
          // Local mode: only sync current page conduits
          const conduitsFromOtherPages = this.conduitMetadata.filter(c => !c.pageNumber || c.pageNumber !== this.currentPage);
          const currentPageConduits = this.syncedConduits.map(c => ({...c}));
          this.conduitMetadata = [...conduitsFromOtherPages, ...currentPageConduits];
          this.saveDrawingData();
        } else {
          // Backend mode: parent sends ALL conduits, replace entire array
          this.conduitMetadata = this.syncedConduits.map(c => ({...c}));
          if (this.syncedConduits.length > 0) {
            this.conduitsInitialized = true; // Mark as initialized after receiving real data
          }
        }
        this.redrawOverlay();
      }
    }
  }

  async loadPdf() {
    if (!this.pdfUrl) return;
    try {
      const response = await fetch(this.pdfUrl);
      if (!response.ok) {
        console.error('Failed to fetch PDF:', response.status, response.statusText);
        return;
      }
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      const typedArray = new Uint8Array(buffer);
      this.pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
      this.currentPage = 1;
      this.panOffset = { x: 0, y: 0 };
      await this.renderPage();
      // Load calibration and markers after PDF and page are ready
      if (this.projectId) {
        this.loadCalibrationFromBackend();
        this.loadMarkersFromBackend();
      } else {
        this.loadDrawingData();
      }
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  }

  async renderPage() {
    if (!this.pdf || !this.canvasRef) return;

    // Cancel any ongoing render task
    if (this.renderTask) {
      try {
        this.renderTask.cancel();
      } catch (err) {
        // Ignore errors from cancellation
      }
    }

    try {
      const page = await this.pdf.getPage(this.currentPage);
      const viewport = page.getViewport({ scale: this.zoom });

      const canvas = this.canvasRef.nativeElement;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Emit viewport for export
      this.viewportChanged.emit(viewport);

      // keep overlay in sync
      if (this.overlayRef) {
        const overlay = this.overlayRef.nativeElement;
        overlay.width = viewport.width;
        overlay.height = viewport.height;
        this.overlayCtx = overlay.getContext('2d');
        this.redrawOverlay();
      }

      const renderContext = { canvasContext: context, viewport };
      this.renderTask = page.render(renderContext);
      await this.renderTask.promise;
      this.renderTask = null; // Clear the task reference after successful render
    } catch (error: any) {
      // RenderingCancelledException is expected when rapid navigation occurs
      if (error?.name !== 'RenderingCancelledException') {
        console.error('Render error:', error);
      }
    }
  }

  onMouseDown(event: MouseEvent) {
    if (this.mode === 'pan') {
      this.isPanning = true;
      this.lastMouse = { x: event.clientX, y: event.clientY };
      return;
    }

    if (!this.overlayRef) return;
    const rect = this.overlayRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const pdfPoint = { x: x / this.zoom, y: y / this.zoom };

    if (this.mode === 'erase') {
      this.handleEraseClick(pdfPoint);
      return;
    }

    if (this.mode === 'terminal') {
      this.isPanning = false;
      this.lastMouse = { x: 0, y: 0 }; // Reset lastMouse to prevent stale coordinates
      const marker = { x: pdfPoint.x, y: pdfPoint.y };
      if (this.projectId) {
        this.saveMarkerToBackend(marker, 'terminal');
      } else {
        const maxId = this.terminals.length > 0 ? Math.max(...this.terminals.map(t => t.id)) : 0;
        this.terminals.push({ id: maxId + 1, x: pdfPoint.x, y: pdfPoint.y });
        this.terminalsChanged.emit(this.terminals);
        this.saveDrawingData();
        this.redrawOverlay();
      }
      return;
    }

    if (this.mode === 'drop') {
      this.isPanning = false;
      this.lastMouse = { x: 0, y: 0 }; // Reset lastMouse to prevent stale coordinates
      const marker = { x: pdfPoint.x, y: pdfPoint.y };
      if (this.projectId) {
        this.saveMarkerToBackend(marker, 'dropPed');
      } else {
        const maxId = this.drops.length > 0 ? Math.max(...this.drops.map(d => d.id)) : 0;
        this.drops.push({ id: maxId + 1, x: pdfPoint.x, y: pdfPoint.y });
        this.dropsChanged.emit(this.drops);
        this.saveDrawingData();
        this.redrawOverlay();
      }
      return;
    }

    if (this.mode === 'handhole') {
      this.isPanning = false;
      this.lastMouse = { x: 0, y: 0 }; // Reset lastMouse to prevent stale coordinates
      const marker = { x: pdfPoint.x, y: pdfPoint.y };
      if (this.projectId) {
        this.saveMarkerToBackend(marker, 'handhole');
      } else {
        const maxId = this.handholes.length > 0 ? Math.max(...this.handholes.map(h => h.id)) : 0;
        this.handholes.push({ id: maxId + 1, x: pdfPoint.x, y: pdfPoint.y });
        this.handholesChanged.emit(this.handholes);
        this.saveDrawingData();
        this.redrawOverlay();
      }
      return;
    }

    if (this.mode === 'calibrate') {
      this.calibrationPoints.push(pdfPoint);
      if (this.calibrationPoints.length === 2) {
        this.finishCalibration();
      }
      this.redrawOverlay();
      return;
    }

    if (this.mode === 'fiber') {
      this.isPanning = false;
      this.hoverPoint = null;
      
      // On double-click, finalize the fiber route without adding another point
      if (event.detail >= 2) {
        this.commitDrawingPath();
        return;
      }
      
      // Single click: add point to path
      if (this.drawingPath.length === 0) {
        this.drawingPath = [pdfPoint];
      } else {
        this.drawingPath = [...this.drawingPath, pdfPoint];
      }
      this.redrawOverlay();
      return;
    }

    if (this.mode === 'conduit') {
      this.isPanning = false;
      const start = this.findNearestEndpoint(pdfPoint);
      if (!this.selectedEndpoint) {
        // First click: must be a terminal
        if (!start || start.type !== 'terminal') {
          this.showToast('Pick a terminal first', 2200, 'error');
          this.selectedEndpoint = null;
          this.redrawOverlay();
          return;
        }
        // Check if terminal already has 2 conduits
        const terminalId = this.findMarkerByPoint(start.point, 'terminal')?.id;
        const attachedConduits = this.conduitMetadata.filter(c => c.fromId === terminalId || c.toId === terminalId).length;
        if (attachedConduits >= 2) {
          this.showToast('A terminal can have a maximum of two conduits', 2500, 'error');
          this.selectedEndpoint = null;
          this.redrawOverlay();
          return;
        }
        this.selectedEndpoint = start;
        this.redrawOverlay();
        return;
      }

      // Second click: must be a drop pedestal
      const end = this.findNearestEndpoint(pdfPoint, 'drop');
      if (!end || end.type !== 'drop') {
        this.showToast('You must select a drop pedestal as the second point', 2500, 'error');
        this.selectedEndpoint = null;
        this.redrawOverlay();
        return;
      }

      const path = [this.selectedEndpoint.point, end.point];
      const lengthFt = this.measurePath(path);
      this.polylines.push({ points: path, lengthFt, type: 'conduit', pageNumber: this.currentPage });
      
      // Store metadata about what this conduit connects
      const fromMarker = this.findMarkerByPoint(this.selectedEndpoint.point, this.selectedEndpoint.type);
      const toMarker = this.findMarkerByPoint(end.point, end.type);
      if (fromMarker && toMarker) {
        this.conduitMetadata.push({
          fromId: fromMarker.id,
          fromType: this.selectedEndpoint.type,
          fromX: fromMarker.x,  // Store coordinates for lookup
          fromY: fromMarker.y,
          toId: toMarker.id,
          toType: end.type,
          toX: toMarker.x,  // Store coordinates for lookup
          toY: toMarker.y,
          lengthFt: lengthFt,
          pageNumber: this.currentPage
        });
      }
      
      this.totalConduitFeet = this.polylines.filter(p => p.type === 'conduit').reduce((sum, p) => sum + p.lengthFt, 0);
      this.conduitsChanged.emit(this.conduitMetadata);
      this.polylinesChanged.emit(this.polylines);
      this.selectedEndpoint = null;
      this.redrawOverlay();
      return;
    }

    if (this.mode === 'assign') {
      this.isPanning = false;
      
      // Find if clicking on a marker (terminal or drop)
      const markerAtPoint = this.findMarkerAtPoint(pdfPoint);
      
      if (!this.selectedMarkerForAssign) {
        // First click: select a marker
        if (markerAtPoint) {
          this.selectedMarkerForAssign = markerAtPoint;
          this.redrawOverlay();
        } else {
          this.showToast('Click on a terminal or drop pedestal to start an assignment');
        }
        return;
      }
      
      // Second click: create assignment to the target point (can be anywhere)
      if (markerAtPoint && markerAtPoint.id === this.selectedMarkerForAssign.id) {
        this.showToast('Cannot assign a marker to itself');
        return;
      }

      // Ensure marker is synced with backend (has a DB-backed ID we still have loaded)
      if (!this.isMarkerSynced(this.selectedMarkerForAssign.id)) {
        this.showToast('Marker is still saving. Please wait a moment and try again.');
        return;
      }
      
      // Create assignment from selected marker to clicked point
      const assignment: Assignment = {
        id: 0,
        project_id: this.projectId || 0,
        from_marker_id: this.selectedMarkerForAssign.id,
        to_x: pdfPoint.x,
        to_y: pdfPoint.y,
        page_number: this.currentPage,
        color: '#ff6b35', // Orange color for visibility
      };
      
      this.createAssignment(assignment);
      this.selectedMarkerForAssign = null;
      this.redrawOverlay();
      return;
    }

    // if we reach here, click is ignored (not in a valid mode)
  }

  onMouseMove(event: MouseEvent) {
    // CRITICAL: Only allow panning if we're EXPLICITLY in pan mode AND actively panning
    // Prevent ANY pan calculations if not in pan mode
    if (this.mode !== 'pan' || !this.isPanning) {
      // If we're not in pan mode or not actively panning, ensure pan state is clean
      this.isPanning = false;
      
      // Handle fiber drawing hover preview
      if (this.mode === 'fiber' && this.drawingPath.length > 0 && this.overlayRef) {
        const rect = this.overlayRef.nativeElement.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        this.hoverPoint = { x: x / this.zoom, y: y / this.zoom };
        this.redrawOverlay();
      }
      return;
    }

    // Safe to pan - we're definitely in pan mode and actively panning
    const dx = event.clientX - this.lastMouse.x;
    const dy = event.clientY - this.lastMouse.y;
    this.panOffset.x += dx;
    this.panOffset.y += dy;
    this.lastMouse = { x: event.clientX, y: event.clientY };
  }

  onMouseUp() {
    // Always reset panning state on mouse up
    this.isPanning = false;
    
    if (this.mode === 'pan') {
      return;
    }

    if (this.mode === 'fiber' || this.mode === 'conduit') {
      // Mouse up ends panning only; path commit happens on double-click (fiber) or second click (conduit)
      return;
    }
  }

  getTransform(): string {
    return `translate(${this.panOffset.x}px, ${this.panOffset.y}px)`;
  }

  zoomIn() {
    this.zoom = Math.min(3, this.zoom * 1.2);
    this.renderPage();
  }

  zoomOut() {
    this.zoom = Math.max(0.5, this.zoom / 1.2);
    this.renderPage();
  }

  setMode(next: 'pan' | 'calibrate' | 'fiber' | 'conduit' | 'terminal' | 'drop' | 'handhole' | 'assign' | 'erase') {
    // Require calibration before using drawing tools
    if (!this.scaleFeetPerPixel && next !== 'calibrate' && next !== 'pan' && next !== 'erase') {
      this.showToast('Please calibrate the scale first');
      return;
    }
    this.mode = next;
    this.isPanning = false;
    this.lastMouse = { x: 0, y: 0 }; // Reset mouse position to prevent stale pan data
    // Keep panOffset preserved to maintain PDF position when switching modes
    // Clear drawing path only when switching to incompatible modes (not when switching to/from pan)
    if (next !== 'fiber' && next !== 'conduit' && next !== 'pan') {
      this.drawingPath = [];
      this.hoverPoint = null;
    }
    if (next !== 'conduit' && next !== 'pan') {
      this.selectedEndpoint = null;
    }
    if (next !== 'calibrate') {
      this.calibrationPoints = [];
    }
    this.redrawOverlay();
  }

  cancelDrawing() {
    this.drawingPath = [];
    this.hoverPoint = null;
    this.selectedEndpoint = null;
    this.calibrationPoints = [];
    this.mode = 'pan';
    this.showToast('Drawing cancelled');
    this.redrawOverlay();
  }

  clearCalibration() {
    const key = this.getCalibrationKey();
    localStorage.removeItem(key);
    // Also clear old drawing data when calibration is reset
    localStorage.removeItem(this.getStorageKey('polylines'));
    localStorage.removeItem(this.getStorageKey('terminals'));
    localStorage.removeItem(this.getStorageKey('drops'));
    this.scaleFeetPerPixel = null;
    this.showToast('Calibration and drawings cleared');
    this.redrawOverlay();
  }

  private getCalibrationKey(): string {
    // Use project ID as the unique key to prevent cross-project pollution
    return `pdf_calibration_project_${this.projectId}_page_${this.currentPage}`;
  }

  private loadCalibration() {
    const key = this.getCalibrationKey();
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        this.scaleFeetPerPixel = parseFloat(saved);
        this.showToast('Calibration loaded from saved data', 2200, 'success');
        this.redrawOverlay();
      } catch (e) {
        console.error('Failed to load calibration:', e);
      }
    }
  }

  private loadCalibrationFromBackend() {
    if (!this.projectId) return;
    
    this.apiService.getScaleCalibrations(this.projectId).subscribe(
      (calibrations) => {
        console.log('Received calibrations from backend:', calibrations);
        
        // Ensure we have an array
        if (!Array.isArray(calibrations)) {
          console.error('Calibrations response is not an array:', calibrations);
          this.scaleFeetPerPixel = null;
          return;
        }
        
        // First try to find calibration for current page
        let pageCalibration = calibrations.find(c => c.page_number === this.currentPage);
        
        if (pageCalibration && pageCalibration.scale_factor) {
          this.scaleFeetPerPixel = pageCalibration.scale_factor;
          console.log('Calibration loaded for page', this.currentPage, ':', this.scaleFeetPerPixel);
          this.showToast(`Page ${this.currentPage} calibration loaded`, 2200, 'success');
          this.redrawOverlay();
        } else {
          console.warn('No calibration found for page', this.currentPage);
          this.scaleFeetPerPixel = null;
          this.showToast(`Page ${this.currentPage} not calibrated. Please calibrate the scale.`, 3000, 'info');
        }
      },
      (error) => {
        console.error('Failed to load calibration from backend:', error);
        this.scaleFeetPerPixel = null;
      }
    );
  }

  private saveCalibration() {
    if (this.scaleFeetPerPixel !== null && this.projectId) {
      // Save to backend API only - no localStorage to avoid cross-project issues
      this.apiService.saveScaleCalibration(this.projectId, {
        method: 'two_point',
        scale_factor: this.scaleFeetPerPixel,
        page_number: this.currentPage,
        point_a: this.calibrationPoints[0] || null,
        point_b: this.calibrationPoints[1] || null
      }).subscribe(
        () => {
          console.log('Calibration saved to backend for project', this.projectId);
          this.showToast('Calibration saved!', 2200, 'success');
        },
        (error) => {
          console.error('Failed to save calibration:', error);
          this.showToast('Failed to save calibration', 2000, 'error');
        }
      );
    }
  }

  private finishCalibration() {
    if (this.calibrationPoints.length !== 2) return;
    this.showCalibrationDialog = true;
    this.calibrationInput = '';
    this.calibrationError = '';
  }

  onCalibrationSubmit() {
    const feet = parseFloat(this.calibrationInput);
    if (isNaN(feet) || feet <= 0) {
      this.calibrationError = 'Please enter a valid positive number';
      return;
    }
    
    const [p1, p2] = this.calibrationPoints;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distPx = Math.sqrt(dx * dx + dy * dy);
    
    if (distPx > 0) {
      this.scaleFeetPerPixel = feet / distPx;
      this.saveCalibration();
      this.showToast('Calibration saved', 2200, 'success');
      this.mode = 'pan';
    }
    
    this.calibrationPoints = [];
    this.showCalibrationDialog = false;
    this.redrawOverlay();
  }

  onCalibrationCancel() {
    this.calibrationPoints = [];
    this.showCalibrationDialog = false;
    this.calibrationInput = '';
    this.calibrationError = '';
    this.redrawOverlay();
  }

  private measurePath(path: { x: number; y: number }[]): number {
    let px = 0;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x;
      const dy = path[i].y - path[i - 1].y;
      px += Math.sqrt(dx * dx + dy * dy);
    }
    if (this.scaleFeetPerPixel) {
      return px * this.scaleFeetPerPixel;
    }
    return 0;
  }

  private commitDrawingPath() {
    if ((this.mode === 'fiber' || this.mode === 'conduit') && this.drawingPath.length > 1) {
      const lengthFt = this.measurePath(this.drawingPath);
      const drawingMode = this.mode;
      this.polylines.push({ points: [...this.drawingPath], lengthFt, type: this.mode, pageNumber: this.currentPage });
      this.totalLengthFeet = this.polylines.filter(p => p.type === 'fiber').reduce((sum, p) => sum + p.lengthFt, 0);
      this.totalConduitFeet = this.polylines.filter(p => p.type === 'conduit').reduce((sum, p) => sum + p.lengthFt, 0);
      
      if (drawingMode === 'fiber') {
        this.showToast(`Fiber route saved: ${lengthFt.toFixed(1)} ft`, 2200, 'success');
        this.polylinesChanged.emit(this.polylines);
        this.mode = 'pan';
      }
    }
    this.drawingPath = [];
    this.hoverPoint = null;
    this.redrawOverlay();
  }

  saveFiber() {
    if (this.drawingPath.length < 2) {
      this.showToast('Need at least 2 points to save fiber', 2200, 'error');
      return;
    }
    const lengthFt = this.measurePath(this.drawingPath);
    const polyline = { points: [...this.drawingPath], lengthFt, type: 'fiber' as const, pageNumber: this.currentPage };
    this.polylines.push(polyline);
    this.totalLengthFeet = this.polylines.filter(p => p.type === 'fiber').reduce((sum, p) => sum + p.lengthFt, 0);
    this.polylinesChanged.emit(this.polylines);
    this.saveDrawingData();
    this.showToast(`Fiber route saved: ${lengthFt.toFixed(1)} ft`, 2200, 'success');
    this.drawingPath = [];
    this.hoverPoint = null;
    this.mode = 'pan';
    this.redrawOverlay();
  }

  private redrawOverlay() {
    if (!this.overlayCtx || !this.overlayRef) return;
    const ctx = this.overlayCtx;
    const overlay = this.overlayRef.nativeElement;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // calibration points
    ctx.fillStyle = '#f97316';
    this.calibrationPoints.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x * this.zoom, p.y * this.zoom, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw handholes first so everything else appears on top
    this.handholes.forEach((pt, idx) => this.drawHandhole(pt, idx));

    // polylines (filter by current page)
    this.polylines
      .filter(line => !line.pageNumber || line.pageNumber === this.currentPage)
      .forEach((line, idx) => {
        if (line.points.length < 2) return;
        ctx.strokeStyle = line.type !== 'conduit' ? '#22c55e' : '#9333ea';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(line.points[0].x * this.zoom, line.points[0].y * this.zoom);
        for (let i = 1; i < line.points.length; i++) {
          ctx.lineTo(line.points[i].x * this.zoom, line.points[i].y * this.zoom);
        }
        ctx.stroke();
        
        // Add labels for fiber routes (not conduits) at 25% and 75% points
        if (line.type !== 'conduit' && line.points.length >= 2) {
          // Count which fiber route this is (skip conduits in numbering)
          const fiberRouteIndex = this.polylines
            .filter(p => !p.pageNumber || p.pageNumber === this.currentPage)
            .slice(0, idx + 1)
            .filter(p => p.type !== 'conduit').length - 1;
          
          // Calculate total route length and segment lengths
          const segmentLengths: number[] = [];
          let totalLength = 0;
          for (let i = 0; i < line.points.length - 1; i++) {
            const dx = line.points[i + 1].x - line.points[i].x;
            const dy = line.points[i + 1].y - line.points[i].y;
            const segLength = Math.sqrt(dx * dx + dy * dy);
            segmentLengths.push(segLength);
            totalLength += segLength;
          }
          
          // For short routes (< 100 pixels), use single label at midpoint
          // For longer routes, use labels at 25% and 75%
          const positions = totalLength < 100 ? [0.5] : [0.25, 0.75];
          
          positions.forEach(position => {
            const targetDist = totalLength * position;
            
            // Find which segment contains this distance
            let accumulatedDist = 0;
            let segmentIdx = 0;
            let localT = 0;
            
            for (let i = 0; i < segmentLengths.length; i++) {
              if (accumulatedDist + segmentLengths[i] >= targetDist) {
                segmentIdx = i;
                localT = (targetDist - accumulatedDist) / segmentLengths[i];
                break;
              }
              accumulatedDist += segmentLengths[i];
            }
            
            // Interpolate position along the segment
            const point = line.points[segmentIdx];
            const nextPoint = line.points[segmentIdx + 1];
            const labelX = (point.x + (nextPoint.x - point.x) * localT) * this.zoom;
            const labelY = (point.y + (nextPoint.y - point.y) * localT) * this.zoom;
            
            // Draw label background circle
            ctx.fillStyle = '#22c55e';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(labelX, labelY, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Draw label number
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((fiberRouteIndex + 1).toString(), labelX, labelY);
          });
        }
      });

    // current drawing
    if (this.drawingPath.length > 0) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(this.drawingPath[0].x * this.zoom, this.drawingPath[0].y * this.zoom);
      for (let i = 1; i < this.drawingPath.length; i++) {
        ctx.lineTo(this.drawingPath[i].x * this.zoom, this.drawingPath[i].y * this.zoom);
      }

      // preview to hover point while placing vertices
      if (this.hoverPoint) {
        ctx.lineTo(this.hoverPoint.x * this.zoom, this.hoverPoint.y * this.zoom);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // selected terminal highlight
    if (this.selectedEndpoint) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.selectedEndpoint.point.x * this.zoom, this.selectedEndpoint.point.y * this.zoom, 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    // assignments (arrows from markers to lots)
    this.assignments.forEach(assignment => {
      this.drawAssignmentArrow(assignment);
    });

    // selected marker for assign mode
    if (this.selectedMarkerForAssign) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.selectedMarkerForAssign.x * this.zoom, this.selectedMarkerForAssign.y * this.zoom, 18, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw terminals and drops last so they're always on top
    this.terminals.forEach((pt, idx) => this.drawTerminal(pt, idx));
    this.drops.forEach((pt, idx) => this.drawDrop(pt, '#a855f7', idx));
  }

  private findMarkerByPoint(point: { x: number; y: number }, type: 'terminal' | 'drop'): { id: number; x: number; y: number } | null {
    const epsilon = 0.01;
    if (type === 'terminal') {
      return this.terminals.find(t => Math.abs(t.x - point.x) < epsilon && Math.abs(t.y - point.y) < epsilon) || null;
    } else {
      return this.drops.find(d => Math.abs(d.x - point.x) < epsilon && Math.abs(d.y - point.y) < epsilon) || null;
    }
  }

  private handleEraseClick(pdfPoint: { x: number; y: number }) {
    const clickRadius = 15 / this.zoom;

    // Check if clicking on an assignment arrow
    const assignment = this.findAssignmentAtPoint(pdfPoint, clickRadius);
    if (assignment) {
      this.deleteAssignment(assignment.id);
      return;
    }

    // Check if clicking on a marker
    const marker = this.findMarkerAtPoint(pdfPoint);
    if (marker) {
      this.deleteMarker(marker);
      return;
    }

    // Check if clicking on a polyline (fiber or conduit)
    const polylineIndex = this.findPolylineAtPoint(pdfPoint, clickRadius);
    if (polylineIndex !== -1) {
      this.deletePolyline(polylineIndex);
      return;
    }

    this.showToast('Nothing found to erase at this location');
  }

  private findAssignmentAtPoint(point: { x: number; y: number }, radius: number): Assignment | null {
    for (const assignment of this.assignments) {
      const fromMarkerPos = this.getMarkerPosition(assignment.from_marker_id);
      if (!fromMarkerPos) continue;

      const fromPoint = { x: fromMarkerPos.x, y: fromMarkerPos.y };
      const toPoint = { x: assignment.to_x * this.zoom, y: assignment.to_y * this.zoom };
      const clickPoint = { x: point.x * this.zoom, y: point.y * this.zoom };

      // Check if click is near the line segment
      const distance = this.distanceToLineSegment(clickPoint, fromPoint, toPoint);
      if (distance <= radius * this.zoom) {
        return assignment;
      }
    }
    return null;
  }

  private distanceToLineSegment(point: { x: number; y: number }, lineStart: { x: number; y: number }, lineEnd: { x: number; y: number }): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      // Line segment is a point
      const px = point.x - lineStart.x;
      const py = point.y - lineStart.y;
      return Math.sqrt(px * px + py * py);
    }

    // Calculate projection of point onto line segment
    let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;
    const distX = point.x - projX;
    const distY = point.y - projY;

    return Math.sqrt(distX * distX + distY * distY);
  }

  private findPolylineAtPoint(point: { x: number; y: number }, radius: number): number {
    for (let i = 0; i < this.polylines.length; i++) {
      const polyline = this.polylines[i];
      if (polyline.points.length < 2) continue;

      for (let j = 1; j < polyline.points.length; j++) {
        const p1 = { x: polyline.points[j - 1].x * this.zoom, y: polyline.points[j - 1].y * this.zoom };
        const p2 = { x: polyline.points[j].x * this.zoom, y: polyline.points[j].y * this.zoom };
        const clickPoint = { x: point.x * this.zoom, y: point.y * this.zoom };

        const distance = this.distanceToLineSegment(clickPoint, p1, p2);
        if (distance <= radius * this.zoom) {
          return i;
        }
      }
    }
    return -1;
  }

  private deleteAssignment(assignmentId: number) {
    if (!this.projectId) {
      this.assignments = this.assignments.filter(a => a.id !== assignmentId);
      this.stateService.setAssignments(this.assignments);
      this.showToast('Assignment deleted', 2200, 'success');
      this.redrawOverlay();
      return;
    }

    this.apiService.deleteAssignment(this.projectId, assignmentId).subscribe({
      next: () => {
        this.stateService.removeAssignment(assignmentId);
        this.showToast('Assignment deleted', 2200, 'success');
        this.redrawOverlay();
      },
      error: (error) => {
        console.error('Error deleting assignment:', error);
        this.showToast('Failed to delete assignment', 2200, 'error');
      }
    });
  }

  private deleteMarker(marker: { id: number; x: number; y: number; type: 'terminal' | 'drop' | 'handhole' }) {
    if (!this.projectId) {
      if (marker.type === 'terminal') {
        this.terminals = this.terminals.filter(t => t.id !== marker.id);
        this.terminalsChanged.emit(this.terminals);
      } else if (marker.type === 'drop') {
        this.drops = this.drops.filter(d => d.id !== marker.id);
        this.dropsChanged.emit(this.drops);
      } else {
        this.handholes = this.handholes.filter(h => h.id !== marker.id);
        this.handholesChanged.emit(this.handholes);
      }
      this.saveDrawingData();
      const markerType = marker.type === 'terminal' ? 'Terminal' : marker.type === 'drop' ? 'Drop Ped' : 'Handhole';
      this.showToast(`${markerType} deleted`, 2200, 'success');
      this.redrawOverlay();
      return;
    }

    this.apiService.deleteMarker(this.projectId, marker.id).subscribe({
      next: () => {
        if (marker.type === 'terminal') {
          this.terminals = this.terminals.filter(t => t.id !== marker.id);
          this.terminalsChanged.emit(this.terminals);
        } else if (marker.type === 'drop') {
          this.drops = this.drops.filter(d => d.id !== marker.id);
          this.dropsChanged.emit(this.drops);
        } else {
          this.handholes = this.handholes.filter(h => h.id !== marker.id);
          this.handholesChanged.emit(this.handholes);
        }
        const markerType = marker.type === 'terminal' ? 'Terminal' : marker.type === 'drop' ? 'Drop Ped' : 'Handhole';
        this.showToast(`${markerType} deleted`, 2200, 'success');
        this.redrawOverlay();
      },
      error: (error) => {
        console.error('Error deleting marker:', error);
        this.showToast('Failed to delete marker', 2200, 'error');
      }
    });
  }

  private deletePolyline(index: number) {
    const polyline = this.polylines[index];
    const isConduit = polyline.type === 'conduit';

    this.polylines.splice(index, 1);
    
    // Update totals
    this.totalLengthFeet = this.polylines.filter(p => p.type === 'fiber').reduce((sum, p) => sum + p.lengthFt, 0);
    this.totalConduitFeet = this.polylines.filter(p => p.type === 'conduit').reduce((sum, p) => sum + p.lengthFt, 0);

    // Remove from conduit metadata if it's a conduit
    if (isConduit && this.conduitMetadata.length > index) {
      this.conduitMetadata.splice(index, 1);
      this.conduitsChanged.emit(this.conduitMetadata);
    }

    this.polylinesChanged.emit(this.polylines);
    this.showToast(`${isConduit ? 'Conduit' : 'Fiber route'} deleted`, 2200, 'success');
    this.redrawOverlay();
  }

  get fiberRoutes() {
    return this.polylines.filter(p => p.type === 'fiber' && (!p.page_number || p.page_number === this.currentPage));
  }

  get dropConduits() {
    return this.conduitMetadata
      .filter(meta => !meta.pageNumber || meta.pageNumber === this.currentPage)
      .map((meta, index) => {
        const fromLabel = meta.fromType === 'terminal' 
          ? `Terminal ${this.getLabel(this.terminals.findIndex(t => t.id === meta.fromId))}`
          : `Drop Ped ${this.getLabel(this.drops.findIndex(d => d.id === meta.fromId))}`;
        const toLabel = `Drop Ped ${this.getLabel(this.drops.findIndex(d => d.id === meta.toId))}`;
        return {
          index: index,
          from: fromLabel,
          to: toLabel,
          lengthFt: meta.lengthFt,
          pageNumber: meta.pageNumber
        };
      });
  }

  get currentPageFiberLength(): number {
    return this.fiberRoutes.reduce((sum, p) => sum + (p.length_ft || 0), 0);
  }

  get currentPageConduitLength(): number {
    return this.dropConduits.reduce((sum, c) => sum + (c.lengthFt || 0), 0);
  }

  get currentPageTerminals(): any[] {
    return this.terminals;
  }

  get currentPageDrops(): any[] {
    return this.drops;
  }
  private findNearestEndpoint(target: { x: number; y: number }, requiredType?: 'drop'): { point: { x: number; y: number }; type: 'terminal' | 'drop' } | null {
    const hitRadius = 12 / this.zoom;
    const candidates: { point: { x: number; y: number }; type: 'terminal' | 'drop' }[] = [];
    if (!requiredType || requiredType === 'drop') {
      this.drops.forEach(p => candidates.push({ point: { x: p.x, y: p.y }, type: 'drop' }));
    }
    if (!requiredType) {
      this.terminals.forEach(p => candidates.push({ point: { x: p.x, y: p.y }, type: 'terminal' }));
    }
    let closest: { point: { x: number; y: number }; type: 'terminal' | 'drop' } | null = null;
    let best = Number.MAX_VALUE;
    candidates.forEach(c => {
      const dx = c.point.x - target.x;
      const dy = c.point.y - target.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < best && dist <= hitRadius) {
        best = dist;
        closest = c;
      }
    });
    return closest;
  }

  private showToast(message: string, duration: number = 2200, type: 'success' | 'error' | 'info' = 'info') {
    this.toastMessage = message;
    this.toastType = type;
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => {
      this.toastMessage = null;
    }, duration);
  }

  private drawTerminal(pt: { x: number; y: number }, index: number) {
    if (!this.overlayCtx) return;
    const size = 15;
    const height = size * Math.sqrt(3);
    const centerX = pt.x * this.zoom;
    const centerY = pt.y * this.zoom;
    this.overlayCtx.fillStyle = '#10b981';
    this.overlayCtx.strokeStyle = '#ffffff';
    this.overlayCtx.lineWidth = 2;
    this.overlayCtx.beginPath();
    this.overlayCtx.moveTo(centerX, centerY - (2 * height / 3));
    this.overlayCtx.lineTo(centerX - size, centerY + (height / 3));
    this.overlayCtx.lineTo(centerX + size, centerY + (height / 3));
    this.overlayCtx.closePath();
    this.overlayCtx.fill();
    this.overlayCtx.stroke();
    
    // Draw letter identifier
    const letter = this.getLabel(index);
    this.overlayCtx.fillStyle = '#ffffff';
    this.overlayCtx.font = 'bold 12px Arial';
    this.overlayCtx.textAlign = 'center';
    this.overlayCtx.textBaseline = 'middle';
    this.overlayCtx.fillText(letter, centerX, centerY);
  }

  private drawDrop(pt: { x: number; y: number }, color: string, index: number) {
    if (!this.overlayCtx) return;
    const centerX = pt.x * this.zoom;
    const centerY = pt.y * this.zoom;
    this.overlayCtx.fillStyle = color;
    this.overlayCtx.strokeStyle = '#ffffff';
    this.overlayCtx.lineWidth = 2;
    this.overlayCtx.beginPath();
    this.overlayCtx.arc(centerX, centerY, 12, 0, Math.PI * 2);
    this.overlayCtx.fill();
    this.overlayCtx.stroke();
    
    // Draw letter identifier
    const letter = this.getLabel(index);
    this.overlayCtx.fillStyle = '#ffffff';
    this.overlayCtx.font = 'bold 12px Arial';
    this.overlayCtx.textAlign = 'center';
    this.overlayCtx.textBaseline = 'middle';
    this.overlayCtx.fillText(letter, centerX, centerY);
  }

  private drawHandhole(pt: { x: number; y: number }, index: number) {
    if (!this.overlayCtx) return;
    const centerX = pt.x * this.zoom;
    const centerY = pt.y * this.zoom;
    const size = 14;
    
    // Draw outer purple square
    this.overlayCtx.fillStyle = '#a855f7';
    this.overlayCtx.fillRect(centerX - size, centerY - size, size * 2, size * 2);
    
    // Draw white border
    this.overlayCtx.strokeStyle = '#ffffff';
    this.overlayCtx.lineWidth = 2;
    this.overlayCtx.strokeRect(centerX - size, centerY - size, size * 2, size * 2);
    
    // Draw hollow center (white square inside)
    const innerSize = 6;
    this.overlayCtx.fillStyle = '#ffffff';
    this.overlayCtx.fillRect(centerX - innerSize, centerY - innerSize, innerSize * 2, innerSize * 2);
  }

  private drawMarker(pt: { x: number; y: number }, color: string) {
    if (!this.overlayCtx) return;
    this.overlayCtx.fillStyle = color;
    this.overlayCtx.strokeStyle = '#ffffff';
    this.overlayCtx.lineWidth = 2;
    this.overlayCtx.beginPath();
    this.overlayCtx.arc(pt.x * this.zoom, pt.y * this.zoom, 12, 0, Math.PI * 2);
    this.overlayCtx.fill();
    this.overlayCtx.stroke();
  }

  async nextPage() {
    if (this.pdf && this.currentPage < this.pdf.numPages) {
      this.currentPage++;
      this.currentPageChanged.emit(this.currentPage);
      await this.renderPage();
      // Reload calibration and markers for the new page
      if (this.projectId) {
        this.loadCalibrationFromBackend();
        this.loadMarkersFromBackend();
        this.loadAssignments();
      }
      this.redrawOverlay();
    }
  }

  async prevPage() {
    if (this.pdf && this.currentPage > 1) {
      this.currentPage--;
      this.currentPageChanged.emit(this.currentPage);
      await this.renderPage();
      // Reload calibration and markers for the new page
      if (this.projectId) {
        this.loadCalibrationFromBackend();
        this.loadMarkersFromBackend();
        this.loadAssignments();
      }
      this.redrawOverlay();
    }
  }

  private getStorageKey(suffix: string): string {
    // Include both pdfUrl and projectId if available for unique key per project
    const baseKey = this.pdfUrl ? this.pdfUrl.split('/').pop() : 'default';
    return `drawing_${baseKey}_${suffix}`;
  }

  saveDrawingData() {
    if (!this.pdfUrl) return;
    try {
      localStorage.setItem(this.getStorageKey('polylines'), JSON.stringify(this.polylines));
      localStorage.setItem(this.getStorageKey('terminals'), JSON.stringify(this.terminals));
      localStorage.setItem(this.getStorageKey('drops'), JSON.stringify(this.drops));
    } catch (error) {
      console.error('Error saving drawing data:', error);
    }
  }

  loadDrawingData() {
    if (!this.pdfUrl) return;
    try {
      const polylineData = localStorage.getItem(this.getStorageKey('polylines'));
      if (polylineData) {
        this.polylines = JSON.parse(polylineData);
      }
      const terminalData = localStorage.getItem(this.getStorageKey('terminals'));
      if (terminalData) {
        this.terminals = JSON.parse(terminalData);
      }
      const dropData = localStorage.getItem(this.getStorageKey('drops'));
      if (dropData) {
        this.drops = JSON.parse(dropData);
      }
      if (polylineData || terminalData || dropData) {
        this.redrawOverlay();
      }
    } catch (error) {
      console.error('Error loading drawing data:', error);
    }
  }

  // Assignment methods

    // Marker methods
    private loadMarkersFromBackend() {
      if (!this.projectId) return;
      this.apiService.getMarkers(this.projectId).subscribe({
        next: (markers) => {
          this.terminals = [];
          this.drops = [];
          this.handholes = [];
          // Filter markers to only show those on the current page
          markers.forEach(marker => {
            // Only load markers for the current page
            if (marker.page_number !== this.currentPage) {
              return;
            }
            const markerObj = { id: marker.id, x: marker.x, y: marker.y };
            if (marker.marker_type === 'terminal') {
              this.terminals.push(markerObj);
            } else if (marker.marker_type === 'dropPed') {
              this.drops.push(markerObj);
            } else if (marker.marker_type === 'handhole') {
              this.handholes.push(markerObj);
            }
          });
          this.redrawOverlay();
        },
        error: (err) => {
          console.error('Error loading markers:', err);
        }
      });
    }

    private saveMarkerToBackend(marker: { x: number; y: number }, type: string) {
      if (!this.projectId) return;
      const payload = {
        page_number: this.currentPage,
        marker_type: type,
        x: marker.x,
        y: marker.y
      };
      console.log('Saving marker to backend:', payload);
      this.apiService.addMarker(this.projectId, payload).subscribe({
        next: (savedMarker) => {
          console.log('Marker saved successfully:', savedMarker);
          const markerObj = { id: savedMarker.id, x: savedMarker.x, y: savedMarker.y };
          if (type === 'terminal') {
            this.terminals.push(markerObj);
            console.log('Added to terminals array, total:', this.terminals.length);
            this.terminalsChanged.emit(this.terminals);
          } else if (type === 'handhole') {
            this.handholes.push(markerObj);
            console.log('Added to handholes array, total:', this.handholes.length);
            this.handholesChanged.emit(this.handholes);
          } else {
            this.drops.push(markerObj);
            console.log('Added to drops array, total:', this.drops.length);
            this.dropsChanged.emit(this.drops);
          }
          console.log('Calling redrawOverlay');
          this.saveDrawingData();
          this.redrawOverlay();
        },
        error: (err) => {
          console.error(`Error saving ${type} marker:`, err);
          this.showToast(`Failed to save ${type}`, 2200, 'error');
        }
      });
    }

    private ensureAssignmentsSubscription() {
      if (this.assignmentsSubscribed) return;
      this.assignmentsSubscribed = true;
      this.stateService.assignments$.subscribe(assignments => {
        this.assignments = assignments;
        this.redrawOverlay();
      });
    }

    private isMarkerSynced(markerId: number): boolean {
      return this.terminals.some(t => t.id === markerId) || this.drops.some(d => d.id === markerId);
    }

  private loadAssignments() {
    if (!this.projectId) return;
    this.apiService.getAssignments(this.projectId).subscribe({
      next: (markerLinks) => {
        // Transform MarkerLink responses to Assignment objects and filter by current page
        const assignments: Assignment[] = markerLinks
          .filter(link => link.page_number === this.currentPage)
          .map(link => ({
            id: link.id,
            project_id: this.projectId || 0,
            from_marker_id: link.marker_id,
            to_x: link.to_x,
            to_y: link.to_y,
            page_number: link.page_number,
            color: '#ff6b35',
          }));
        this.stateService.setAssignments(assignments);
      },
      error: (err) => {
        console.error('Error loading assignments:', err);
      }
    });
  }

  private createAssignment(assignment: Assignment) {
    if (!this.projectId) return;
    
    // Transform Assignment to MarkerLinkCreate (API expects marker_id, not from_marker_id)
    const payload = {
      marker_id: assignment.from_marker_id,
      to_x: assignment.to_x,
      to_y: assignment.to_y,
      page_number: assignment.page_number,
    };
    
    this.apiService.createAssignment(this.projectId, payload).subscribe({
      next: (createdAssignment) => {
        // Map response back to Assignment format
        const created: Assignment = {
          id: createdAssignment.id,
          project_id: this.projectId || 0,
          from_marker_id: createdAssignment.marker_id,
          to_x: createdAssignment.to_x,
          to_y: createdAssignment.to_y,
          page_number: createdAssignment.page_number,
          color: '#ff6b35',
        };
        this.stateService.addAssignment(created);
        this.showToast('Assignment created successfully', 2200, 'success');
        this.redrawOverlay();
      },
      error: (err) => {
        console.error('Error creating assignment:', err);
        this.showToast('Failed to create assignment', 2200, 'error');
      }
    });
  }

  private findMarkerAtPoint(point: { x: number; y: number }): { id: number; x: number; y: number; type: 'terminal' | 'drop' | 'handhole' } | null {
    const hitRadius = 20 / this.zoom; // 20px click radius
    
    console.log('[findMarkerAtPoint] Click at:', point, 'Zoom:', this.zoom, 'HitRadius:', hitRadius);
    
    // Check terminals
    for (let i = 0; i < this.terminals.length; i++) {
      const dx = this.terminals[i].x - point.x;
      const dy = this.terminals[i].y - point.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      console.log('[findMarkerAtPoint] Terminal', i, ':', this.terminals[i], 'Distance:', dist);
      if (dist <= hitRadius) {
        console.log('[findMarkerAtPoint] FOUND TERMINAL');
        return { id: this.terminals[i].id, x: this.terminals[i].x, y: this.terminals[i].y, type: 'terminal' };
      }
    }
    
    // Check drops
    for (let i = 0; i < this.drops.length; i++) {
      const dx = this.drops[i].x - point.x;
      const dy = this.drops[i].y - point.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      console.log('[findMarkerAtPoint] Drop', i, ':', this.drops[i], 'Distance:', dist);
      if (dist <= hitRadius) {
        console.log('[findMarkerAtPoint] FOUND DROP');
        return { id: this.drops[i].id, x: this.drops[i].x, y: this.drops[i].y, type: 'drop' };
      }
    }
    
    // Check handholes
    for (let i = 0; i < this.handholes.length; i++) {
      const dx = this.handholes[i].x - point.x;
      const dy = this.handholes[i].y - point.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      console.log('[findMarkerAtPoint] Handhole', i, ':', this.handholes[i], 'Distance:', dist);
      if (dist <= hitRadius) {
        console.log('[findMarkerAtPoint] FOUND HANDHOLE');
        return { id: this.handholes[i].id, x: this.handholes[i].x, y: this.handholes[i].y, type: 'handhole' };
      }
    }
    
    console.log('[findMarkerAtPoint] NOT FOUND: terminals=', this.terminals.length, 'drops=', this.drops.length, 'handholes=', this.handholes.length);
    return null;
  }

  private drawAssignmentArrow(assignment: Assignment) {
    if (!this.overlayCtx) return;
    const ctx = this.overlayCtx;
    const color = assignment.color || '#ff6b35';
    
    const fromMarker = this.selectedMarkerForAssign?.id === assignment.from_marker_id
      ? { x: this.selectedMarkerForAssign.x * this.zoom, y: this.selectedMarkerForAssign.y * this.zoom }
      : this.getMarkerPosition(assignment.from_marker_id);
    
    if (!fromMarker) return;
    
    const toX = assignment.to_x * this.zoom;
    const toY = assignment.to_y * this.zoom;
    
    // Draw arrow line
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(fromMarker.x, fromMarker.y);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    
    // Draw arrowhead
    const headLen = 15;
    const angle = Math.atan2(toY - fromMarker.y, toX - fromMarker.x);
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Convert zero-based index to label: A, B, ..., Z, AA, AB, ..., AZ, BA, ...
   */
  private getLabel(index: number): string {
    if (index < 26) {
      return String.fromCharCode(65 + index); // A-Z
    }
    // AA, AB, ..., AZ, BA, ...
    const firstChar = String.fromCharCode(65 + Math.floor((index - 26) / 26));
    const secondChar = String.fromCharCode(65 + ((index - 26) % 26));
    return firstChar + secondChar;
  }

  private getMarkerPosition(markerId: number): { x: number; y: number } | null {
    // Check terminals
    const terminal = this.terminals.find(t => t.id === markerId);
    if (terminal) {
      return { x: terminal.x * this.zoom, y: terminal.y * this.zoom };
    }
    
    // Check drops
    const drop = this.drops.find(d => d.id === markerId);
    if (drop) {
      return { x: drop.x * this.zoom, y: drop.y * this.zoom };
    }
    
    return null;
  }
}
