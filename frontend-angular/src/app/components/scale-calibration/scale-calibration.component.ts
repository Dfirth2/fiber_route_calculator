import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { StateService } from '../../core/services/state.service';

@Component({
  selector: 'app-scale-calibration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-4">
      <h3 class="text-lg font-semibold">Scale Calibration</h3>
      <div class="space-y-2">
        <label class="block">
          <input 
            type="radio" 
            name="calibration" 
            value="twopoint"
            [(ngModel)]="calibrationMethod"
            (change)="onMethodChange()"
          >
          Two-Point Calibration
        </label>
        <label class="block">
          <input 
            type="radio" 
            name="calibration" 
            value="manual"
            [(ngModel)]="calibrationMethod"
            (change)="onMethodChange()"
          >
          Manual Scale
        </label>
      </div>

      <div *ngIf="calibrationMethod === 'twopoint'" class="space-y-2">
        <p class="text-sm text-gray-600">Click two points on the PDF, then enter the distance between them</p>
        <button 
          (click)="startCalibration()"
          [disabled]="calibrating"
          class="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {{ calibrating ? 'Waiting for points...' : 'Start Calibration' }}
        </button>
        <div *ngIf="calibrationPoints.length > 0" class="text-sm text-gray-600">
          Points selected: {{ calibrationPoints.length }}/2
        </div>
      </div>

      <div *ngIf="calibrationMethod === 'manual'" class="space-y-2">
        <label class="block">
          <span class="text-sm">Scale (pixels per foot):</span>
          <input 
            type="number" 
            [(ngModel)]="manualScale"
            class="w-full px-2 py-1 border rounded"
            step="0.1"
          >
        </label>
      </div>

      <button 
        (click)="saveCalibration()"
        class="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Save Calibration
      </button>

      <div *ngIf="savedCalibration" class="p-3 bg-green-50 border border-green-200 rounded">
        <p class="text-sm"><strong>Scale Factor:</strong> {{ savedCalibration.scale_factor }}</p>
        <p class="text-sm"><strong>Method:</strong> {{ savedCalibration.method }}</p>
      </div>
    </div>
  `
})
export class ScaleCalibrationComponent {
  @Input() projectId: number | null = null;
  @Output() calibrationChanged = new EventEmitter<any>();

  calibrationMethod = 'twopoint';
  calibrating = false;
  calibrationPoints: { x: number; y: number }[] = [];
  manualScale = 1;
  savedCalibration: any = null;

  constructor(
    private apiService: ApiService,
    private stateService: StateService
  ) {
    window.addEventListener('calibrationPointsSelected', (event: any) => {
      this.calibrationPoints = event.detail;
      this.onCalibrationPointsSelected();
    });
  }

  startCalibration() {
    this.calibrating = true;
    this.calibrationPoints = [];
  }

  onMethodChange() {
    this.calibrationPoints = [];
  }

  onCalibrationPointsSelected() {
    this.calibrating = false;
    if (this.calibrationPoints.length === 2) {
      const distance = Math.sqrt(
        Math.pow(this.calibrationPoints[1].x - this.calibrationPoints[0].x, 2) +
        Math.pow(this.calibrationPoints[1].y - this.calibrationPoints[0].y, 2)
      );
      const knownDistance = prompt('Enter the real-world distance (in feet):');
      if (knownDistance) {
        this.calculateScaleFactor(distance, parseFloat(knownDistance));
      }
    }
  }

  calculateScaleFactor(pixelDistance: number, realDistance: number) {
    this.manualScale = pixelDistance / realDistance;
  }

  saveCalibration() {
    if (!this.projectId) return;

    const calibration = {
      page_number: 1,
      method: this.calibrationMethod,
      scale_factor: this.manualScale,
      known_distance_ft: this.calibrationMethod === 'twopoint' ? null : null
    };

    this.apiService.saveScaleCalibration(this.projectId, calibration).subscribe(
      (saved) => {
        this.savedCalibration = saved;
        this.stateService.setScaleCalibration(saved);
        this.calibrationChanged.emit(saved);
      }
    );
  }
}
