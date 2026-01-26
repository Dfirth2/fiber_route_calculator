import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service';

@Component({
  selector: 'app-measurement-display',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-4">
      <h3 class="text-lg font-semibold">Measurements</h3>
      
      <div class="space-y-3">
        <div *ngIf="polylines.length > 0">
          <h4 class="font-medium">Routes</h4>
          <div *ngFor="let polyline of polylines" class="p-2 bg-gray-50 rounded text-sm">
            <p><strong>{{ polyline.name }}</strong></p>
            <p class="text-gray-600">{{ polyline.length_ft | number:'1.2-2' }} ft</p>
            <p class="text-xs text-gray-500">{{ polyline.points.length }} points</p>
          </div>
        </div>

        <div *ngIf="markers.length > 0">
          <h4 class="font-medium">Markers</h4>
          <div *ngFor="let marker of markers" class="p-2 bg-gray-50 rounded text-sm">
            <p><strong>{{ marker.marker_type }}</strong></p>
            <p class="text-gray-600">Position: ({{ marker.x | number:'1.1-1' }}, {{ marker.y | number:'1.1-1' }})</p>
          </div>
        </div>

        <div *ngIf="conduits.length > 0">
          <h4 class="font-medium">Conduits</h4>
          <div *ngFor="let conduit of conduits" class="p-2 bg-gray-50 rounded text-sm">
            <p class="text-gray-600">{{ conduit.footage | number:'1.1-1' }} ft</p>
          </div>
        </div>

        <div *ngIf="totalLength > 0" class="p-3 bg-blue-50 border border-blue-200 rounded">
          <p class="text-sm"><strong>Total Length:</strong> {{ totalLength | number:'1.2-2' }} ft</p>
        </div>
      </div>
    </div>
  `
})
export class MeasurementDisplayComponent implements OnInit {
  @Input() projectId: number | null = null;

  polylines: any[] = [];
  markers: any[] = [];
  conduits: any[] = [];
  totalLength = 0;

  constructor(private stateService: StateService) {}

  ngOnInit() {
    this.stateService.polylines$.subscribe((polylines) => {
      this.polylines = polylines;
      this.totalLength = polylines.reduce((sum, p) => sum + (p.length_ft || 0), 0);
    });

    this.stateService.markers$.subscribe((markers) => {
      this.markers = markers;
    });

    this.stateService.conduits$.subscribe((conduits) => {
      this.conduits = conduits;
    });
  }
}
