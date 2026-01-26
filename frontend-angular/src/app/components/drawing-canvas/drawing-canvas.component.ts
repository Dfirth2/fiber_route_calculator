import { Component, ViewChild, ElementRef, Input, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService, Marker, Polyline } from '../../core/services/state.service';

@Component({
  selector: 'app-drawing-canvas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <canvas 
      #drawingCanvas
      class="absolute inset-0 cursor-crosshair"
      [style.pointerEvents]="isActive ? 'auto' : 'none'"
      (click)="onCanvasClick($event)"
      (mousemove)="onMouseMove($event)"
      (mousedown)="onMouseDown($event)"
      (mouseup)="onMouseUp($event)"
    ></canvas>
  `
})
export class DrawingCanvasComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('drawingCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() pdfCanvas: HTMLCanvasElement | null = null;
  @Input() viewport: any;
  @Input() isActive = false;
  @Input() projectId: number | null = null;

  private context: CanvasRenderingContext2D | null = null;
  private currentPath: { x: number; y: number }[] = [];
  private viewportScale = 1;
  private pageDims = { width: 1728, height: 2592 };
  private isDrawing = false;

  constructor(
    private stateService: StateService
  ) {}

  ngOnInit() {
    if (this.viewport) {
      this.viewportScale = this.viewport.scale || 1;
      this.pageDims = {
        width: this.viewport.pageWidth || 1728,
        height: this.viewport.pageHeight || 2592
      };
    }
  }

  ngAfterViewInit() {
    if (!this.pdfCanvas || !this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    canvas.width = this.pdfCanvas.width;
    canvas.height = this.pdfCanvas.height;
    this.context = canvas.getContext('2d');
    this.redraw();
  }

  ngOnDestroy() {
    this.context = null;
  }

  onCanvasClick(event: MouseEvent) {
    if (!this.isActive) return;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const pdfCoord = this.toPdfCoordinates({ x, y });
    
    // Add marker
    if (this.projectId) {
      const marker = {
        id: Date.now(),
        project_id: this.projectId,
        page_number: 1,
        x: pdfCoord.x,
        y: pdfCoord.y,
        marker_type: 'terminal'
      } as Marker;
      this.stateService.addMarker(marker);
      this.redraw();
    }
  }

  onMouseDown(event: MouseEvent) {
    this.isDrawing = true;
    this.currentPath = [];
  }

  onMouseMove(event: MouseEvent) {
    if (!this.isDrawing) return;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.currentPath.push({ x, y });
    this.redraw();
  }

  onMouseUp(event?: MouseEvent) {
    if (!this.isDrawing || this.currentPath.length < 2) {
      this.isDrawing = false;
      return;
    }

    this.isDrawing = false;
    const pdfPoints = this.currentPath.map(p => this.toPdfCoordinates(p));
    
    if (this.projectId) {
      const polyline = {
        id: Date.now(),
        project_id: this.projectId,
        page_number: 1,
        name: `Route ${Date.now()}`,
        points: pdfPoints,
        length_ft: 0
      } as Polyline;
      this.stateService.addPolyline(polyline);
      this.currentPath = [];
      this.redraw();
    }
  }

  private toPdfCoordinates(canvasPoint: { x: number; y: number }): { x: number; y: number } {
    return {
      x: canvasPoint.x / this.viewportScale,
      y: canvasPoint.y / this.viewportScale
    };
  }

  private toCanvasCoordinates(pdfPoint: { x: number; y: number }): { x: number; y: number } {
    return {
      x: pdfPoint.x * this.viewportScale,
      y: pdfPoint.y * this.viewportScale
    };
  }

  private redraw() {
    if (!this.context || !this.canvasRef) return;

    const canvas = this.canvasRef.nativeElement;
    this.context.clearRect(0, 0, canvas.width, canvas.height);

    // Draw polylines
    this.stateService.polylines$.subscribe((polylines) => {
      this.context!.strokeStyle = '#3b82f6';
      this.context!.lineWidth = 2;
      polylines.forEach((polyline) => {
        if (polyline.points.length < 2) return;
        const p0 = this.toCanvasCoordinates(polyline.points[0]);
        this.context!.beginPath();
        this.context!.moveTo(p0.x, p0.y);
        for (let i = 1; i < polyline.points.length; i++) {
          const p = this.toCanvasCoordinates(polyline.points[i]);
          this.context!.lineTo(p.x, p.y);
        }
        this.context!.stroke();
      });
    });

    // Draw markers
    this.stateService.markers$.subscribe((markers) => {
      markers.forEach((marker) => {
        const canvasCoord = this.toCanvasCoordinates({ x: marker.x, y: marker.y });
        if (marker.marker_type === 'terminal') {
          this.drawTerminal(canvasCoord.x, canvasCoord.y);
        } else if (marker.marker_type === 'dropPed') {
          this.drawDropPed(canvasCoord.x, canvasCoord.y);
        }
      });
    });

    // Draw current path
    if (this.currentPath.length > 0) {
      this.context.strokeStyle = '#10b981';
      this.context.lineWidth = 2;
      this.context.setLineDash([5, 5]);
      const p0 = this.currentPath[0];
      this.context.beginPath();
      this.context.moveTo(p0.x, p0.y);
      for (let i = 1; i < this.currentPath.length; i++) {
        const p = this.currentPath[i];
        this.context.lineTo(p.x, p.y);
      }
      this.context.stroke();
      this.context.setLineDash([]);
    }
  }

  private drawTerminal(x: number, y: number) {
    if (!this.context) return;
    const size = 15;
    const height = size * Math.sqrt(3) / 2;
    this.context.fillStyle = '#10b981';
    this.context.strokeStyle = '#ffffff';
    this.context.lineWidth = 2;
    this.context.beginPath();
    this.context.moveTo(x, y - height);
    this.context.lineTo(x - size / 2, y + height / 2);
    this.context.lineTo(x + size / 2, y + height / 2);
    this.context.closePath();
    this.context.fill();
    this.context.stroke();
  }

  private drawDropPed(x: number, y: number) {
    if (!this.context) return;
    const radius = 12;
    this.context.fillStyle = '#a855f7';
    this.context.strokeStyle = '#ffffff';
    this.context.lineWidth = 2;
    this.context.beginPath();
    this.context.arc(x, y, radius, 0, 2 * Math.PI);
    this.context.fill();
    this.context.stroke();
  }
}
