import { Component, Input, OnChanges, OnInit, SimpleChanges, ViewChild, ElementRef, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as pdfjsLib from 'pdfjs-dist';
import { ApiService } from '../../core/services/api.service';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs';

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [CommonModule],
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
  @Input() syncedPolylines: any[] = [];

  pdf: any = null;
  currentPage = 1;
  zoom = 1;
  panOffset = { x: 0, y: 0 };
  isPanning = false;
  Math = Math;

  mode: 'pan' | 'calibrate' | 'fiber' | 'conduit' | 'terminal' | 'drop' = 'pan';
  calibrationPoints: { x: number; y: number }[] = [];
  scaleFeetPerPixel: number | null = null;
  drawingPath: { x: number; y: number }[] = [];
  hoverPoint: { x: number; y: number } | null = null;
  polylines: { points: { x: number; y: number }[]; lengthFt: number; type: 'fiber' | 'conduit' }[] = [];
  totalLengthFeet = 0;
  totalConduitFeet = 0;
  terminals: { x: number; y: number }[] = [];
  drops: { x: number; y: number }[] = [];
  selectedEndpoint: { point: { x: number; y: number }; type: 'terminal' | 'drop' } | null = null;
  toastMessage: string | null = null;
  showEquipmentMenu = false;
  showCalibrationMenu = false;
  private toastTimer: any = null;

  private renderTask: any = null;
  private lastMouse = { x: 0, y: 0 };
  private overlayCtx: CanvasRenderingContext2D | null = null;

  @Output() polylinesChanged = new EventEmitter<any[]>();
  @Output() terminalsChanged = new EventEmitter<any[]>();
  @Output() dropsChanged = new EventEmitter<any[]>();

  constructor(private apiService: ApiService) {}

  async ngOnInit() {
    if (this.pdfUrl) {
      await this.loadPdf();
      this.loadCalibrationFromBackend();
      this.loadDrawingData();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['pdfUrl'] && !changes['pdfUrl'].firstChange && this.pdfUrl) {
      this.loadPdf();
    }
    if (changes['syncedTerminals'] && this.syncedTerminals) {
      this.terminals = this.syncedTerminals;
      this.saveDrawingData();
      this.redrawOverlay();
    }
    if (changes['syncedDrops'] && this.syncedDrops) {
      this.drops = this.syncedDrops;
      this.saveDrawingData();
      this.redrawOverlay();
    }
    if (changes['syncedPolylines'] && this.syncedPolylines) {
      this.polylines = this.syncedPolylines;
      this.saveDrawingData();
      this.redrawOverlay();
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
      // Don't load old localStorage data - use only backend
      this.loadDrawingData();
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  }

  async renderPage() {
    if (!this.pdf || !this.canvasRef) return;

    if (this.renderTask) {
      try {
        this.renderTask.cancel();
      } catch (err) {}
    }

    try {
      const page = await this.pdf.getPage(this.currentPage);
      const viewport = page.getViewport({ scale: this.zoom });

      const canvas = this.canvasRef.nativeElement;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

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
    } catch (error) {
      console.error('Render error:', error);
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

    if (this.mode === 'terminal') {
      this.terminals.push(pdfPoint);
      this.terminalsChanged.emit(this.terminals);
      this.saveDrawingData();
      this.redrawOverlay();
      return;
    }

    if (this.mode === 'drop') {
      this.drops.push(pdfPoint);
      this.dropsChanged.emit(this.drops);
      this.saveDrawingData();
      this.redrawOverlay();
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
        if (start) {
          this.selectedEndpoint = start;
          this.redrawOverlay();
        }
        return;
      }

      // second click must land on a drop pedestal
      const end = this.findNearestEndpoint(pdfPoint, 'drop');
      if (!end) {
        this.showToast('Select a drop pedestal to complete the conduit');
        return;
      }

      // enforce terminal->drop or drop->drop; block terminal->terminal
      if (this.selectedEndpoint.type === 'terminal' && end.type === 'terminal') {
        this.showToast('Cannot connect terminal to terminal');
        return;
      }

      const path = [this.selectedEndpoint.point, end.point];
      const lengthFt = this.measurePath(path);
      this.polylines.push({ points: path, lengthFt, type: 'conduit' });
      this.totalConduitFeet = this.polylines.filter(p => p.type === 'conduit').reduce((sum, p) => sum + p.lengthFt, 0);
      this.selectedEndpoint = null;
      this.redrawOverlay();
      return;
    }

    // if we reach here, click is ignored (not in a valid mode)
  }

  onMouseMove(event: MouseEvent) {
    if (this.mode === 'pan') {
      if (!this.isPanning) return;
      const dx = event.clientX - this.lastMouse.x;
      const dy = event.clientY - this.lastMouse.y;
      this.panOffset.x += dx;
      this.panOffset.y += dy;
      this.lastMouse = { x: event.clientX, y: event.clientY };
      return;
    }

    if (this.mode === 'fiber' && this.drawingPath.length > 0 && this.overlayRef) {
      const rect = this.overlayRef.nativeElement.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      this.hoverPoint = { x: x / this.zoom, y: y / this.zoom };
      this.redrawOverlay();
    }
  }

  onMouseUp() {
    if (this.mode === 'pan') {
      this.isPanning = false;
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

  setMode(next: 'pan' | 'calibrate' | 'fiber' | 'conduit' | 'terminal' | 'drop') {
    // Require calibration before using drawing tools
    if (!this.scaleFeetPerPixel && next !== 'calibrate' && next !== 'pan') {
      this.showToast('Please calibrate the scale first');
      return;
    }
    this.mode = next;
    this.isPanning = false;
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
        this.showToast('Calibration loaded from saved data');
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
        const pageCalibration = calibrations.find(c => c.page_number === this.currentPage);
        if (pageCalibration) {
          this.scaleFeetPerPixel = pageCalibration.scale_factor;
          this.showToast('Calibration loaded from server');
          this.redrawOverlay();
        } else {
          // No calibration for this project - user must calibrate
          this.scaleFeetPerPixel = null;
          this.showToast('Please calibrate the scale for this project', 3000);
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
          this.showToast('Calibration saved!');
        },
        (error) => {
          console.error('Failed to save calibration:', error);
          this.showToast('Failed to save calibration', 2000);
        }
      );
    }
  }

  private finishCalibration() {
    if (this.calibrationPoints.length !== 2) return;
    const [p1, p2] = this.calibrationPoints;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distPx = Math.sqrt(dx * dx + dy * dy);
    const input = prompt('Enter real-world distance between points (feet):');
    const feet = input ? parseFloat(input) : NaN;
    if (!isNaN(feet) && distPx > 0) {
      this.scaleFeetPerPixel = feet / distPx;
      this.saveCalibration();
      this.showToast('Calibration saved');
      this.mode = 'pan';
    } else {
      this.scaleFeetPerPixel = null;
    }
    this.calibrationPoints = [];
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
      this.polylines.push({ points: [...this.drawingPath], lengthFt, type: this.mode });
      this.totalLengthFeet = this.polylines.filter(p => p.type === 'fiber').reduce((sum, p) => sum + p.lengthFt, 0);
      this.totalConduitFeet = this.polylines.filter(p => p.type === 'conduit').reduce((sum, p) => sum + p.lengthFt, 0);
      
      if (drawingMode === 'fiber') {
        this.showToast(`Fiber route saved: ${lengthFt.toFixed(1)} ft`);
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
      this.showToast('Need at least 2 points to save fiber');
      return;
    }
    const lengthFt = this.measurePath(this.drawingPath);
    const polyline = { points: [...this.drawingPath], lengthFt, type: 'fiber' as const };
    this.polylines.push(polyline);
    this.totalLengthFeet = this.polylines.filter(p => p.type === 'fiber').reduce((sum, p) => sum + p.lengthFt, 0);
    this.polylinesChanged.emit(this.polylines);
    this.saveDrawingData();
    this.showToast(`Fiber route saved: ${lengthFt.toFixed(1)} ft`);
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

    // polylines
    this.polylines.forEach(line => {
      if (line.points.length < 2) return;
      ctx.strokeStyle = line.type !== 'conduit' ? '#22c55e' : '#9333ea';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(line.points[0].x * this.zoom, line.points[0].y * this.zoom);
      for (let i = 1; i < line.points.length; i++) {
        ctx.lineTo(line.points[i].x * this.zoom, line.points[i].y * this.zoom);
      }
      ctx.stroke();
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

    // markers
    this.terminals.forEach((pt, idx) => this.drawTerminal(pt, idx));
    this.drops.forEach((pt, idx) => this.drawDrop(pt, '#a855f7', idx));
  }

  private findNearestEndpoint(target: { x: number; y: number }, requiredType?: 'drop'): { point: { x: number; y: number }; type: 'terminal' | 'drop' } | null {
    const hitRadius = 12 / this.zoom;
    const candidates: { point: { x: number; y: number }; type: 'terminal' | 'drop' }[] = [];
    if (!requiredType || requiredType === 'drop') {
      this.drops.forEach(p => candidates.push({ point: p, type: 'drop' }));
    }
    if (!requiredType) {
      this.terminals.forEach(p => candidates.push({ point: p, type: 'terminal' }));
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

  private showToast(message: string, duration: number = 2200) {
    this.toastMessage = message;
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
    const letter = String.fromCharCode(65 + index); // A, B, C, etc.
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
    const letter = String.fromCharCode(65 + index); // A, B, C, etc.
    this.overlayCtx.fillStyle = '#ffffff';
    this.overlayCtx.font = 'bold 12px Arial';
    this.overlayCtx.textAlign = 'center';
    this.overlayCtx.textBaseline = 'middle';
    this.overlayCtx.fillText(letter, centerX, centerY);
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

  nextPage() {
    if (this.pdf && this.currentPage < this.pdf.numPages) {
      this.currentPage++;
      this.renderPage();
    }
  }

  prevPage() {
    if (this.pdf && this.currentPage > 1) {
      this.currentPage--;
      this.renderPage();
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
      console.log('Drawing data saved:', { polylines: this.polylines.length, terminals: this.terminals.length, drops: this.drops.length });
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
        console.log('Loaded polylines:', this.polylines.length);
      }
      const terminalData = localStorage.getItem(this.getStorageKey('terminals'));
      if (terminalData) {
        this.terminals = JSON.parse(terminalData);
        console.log('Loaded terminals:', this.terminals.length);
      }
      const dropData = localStorage.getItem(this.getStorageKey('drops'));
      if (dropData) {
        this.drops = JSON.parse(dropData);
        console.log('Loaded drops:', this.drops.length);
      }
      if (polylineData || terminalData || dropData) {
        this.redrawOverlay();
      }
    } catch (error) {
      console.error('Error loading drawing data:', error);
    }
  }
}
