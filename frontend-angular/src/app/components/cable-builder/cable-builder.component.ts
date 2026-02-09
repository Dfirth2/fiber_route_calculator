import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ApiService } from '../../core/services/api.service';

interface Terminal {
  id: number;
  marker_id: number;
  label?: string;
  address: string;
  assignment_count: number;
  suggested_size: number;
  actual_size: number;
  order: number;
}

interface Cable {
  id?: number;
  cable_number: number;
  cable_type: 'BAU' | 'FNAP';
  cable_size: number;
  order: number;
  assigned_terminals?: number[]; // Array of terminal marker_ids
}

interface TeatherSplicer {
  id?: number;
  cable_id: number;
  target_cable_id: number;
  divert_count: number;
}

interface CableConfiguration {
  id?: number;
  project_id: number;
  name?: string;
  terminals: Terminal[];
  cables: Cable[];
  teathers: TeatherSplicer[];
}

const TERMINAL_SIZES = [4, 6, 8, 12];
const CABLE_SIZES_BOTH = [24, 48, 72, 144, 288, 432];
const CABLE_SIZES_BAU_ONLY = [216, 864];
const TEATHER_OPTIONS = [12, 24, 36, 48];

@Component({
  selector: 'app-cable-builder',
  templateUrl: './cable-builder.component.html',
  styleUrls: ['./cable-builder.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule]
})
export class CableBuilderComponent implements OnInit {
  projectId: number = 0;
  config: CableConfiguration = {
    project_id: 0,
    terminals: [],
    cables: [],
    teathers: []
  };
  loading = true;
  saving = false;
  savedMessage = '';
  maxCables = 0; // Maximum number of cables based on fiber polylines

  TERMINAL_SIZES = TERMINAL_SIZES;
  TEATHER_OPTIONS = TEATHER_OPTIONS;

  constructor(
    private apiService: ApiService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.projectId = +this.route.snapshot.paramMap.get('id')!;
    this.loadCableConfiguration();
  }

  loadCableConfiguration() {
    this.loading = true;

    // First get cable counts for terminal data
    this.apiService.getCableCounts(this.projectId).subscribe({
      next: (response: any) => {
        // Initialize terminals from cable counts
        const terminals = response.terminals || [];
        this.maxCables = response.max_cables || 0;
        const labelByMarkerId = new Map(
          terminals.map((t: any) => [t.marker_id || t.id, t.label])
        );
        
        // Try to load existing configuration
        this.apiService.getCableConfiguration(this.projectId).subscribe({
          next: (config: any) => {
            this.config = config;
            this.config.terminals = (this.config.terminals || []).map((t: any) => {
              const markerId = t.marker_id ?? t.terminal_marker_id ?? t.id;
              return {
                ...t,
                marker_id: markerId,
                label: t.label ?? labelByMarkerId.get(markerId)
              };
            });
            // Ensure cables have assigned_terminals array and remove duplicates
            this.config.cables = (this.config.cables || []).map((c: any) => ({
              ...c,
              assigned_terminals: Array.from(new Set(c.assigned_terminals || []))
            }));
            this.loading = false;
          },
          error: () => {
            // No existing config, create new one with terminal data
            this.config = {
              project_id: this.projectId,
              terminals: terminals.map((t: any, idx: number) => ({
                id: undefined,
                marker_id: t.marker_id || t.id,
                label: t.label,
                address: t.address || '',
                assignment_count: t.assignment_count,
                suggested_size: t.suggested_size,
                actual_size: t.suggested_size,
                order: idx
              })),
              cables: [],
              teathers: []
            };
            this.loading = false;
          }
        });
      },
      error: (err) => {
        console.error('Failed to load cable counts:', err);
        this.loading = false;
      }
    });
  }

  dropTerminals(event: CdkDragDrop<Terminal[]>) {
    moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    this.updateTerminalOrder();
  }

  dropCables(event: CdkDragDrop<Cable[]>) {
    moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    this.updateCableOrder();
  }

  updateTerminalOrder() {
    this.config.terminals.forEach((t, idx) => (t.order = idx));
  }

  updateCableOrder() {
    this.config.cables.forEach((c, idx) => (c.order = idx));
  }

  addCable() {
    // Can't add more cables than fiber polylines
    if (this.config.cables.length >= this.maxCables) {
      return;
    }
    
    const nextNumber = (this.config.cables.length || 0) + 1;
    this.config.cables.push({
      cable_number: nextNumber,
      cable_type: 'BAU',
      cable_size: 24,
      order: this.config.cables.length,
      assigned_terminals: []
    });
  }

  canAddCable(): boolean {
    return this.config.cables.length < this.maxCables;
  }

  removeCable(index: number) {
    // Remove teathers referencing this cable
    this.config.teathers = this.config.teathers.filter(
      t => t.cable_id !== index && t.target_cable_id !== index
    );
    this.config.cables.splice(index, 1);
    this.updateCableOrder();
  }

  dropTerminalOnCable(event: CdkDragDrop<any>, cable: Cable) {
    const terminal = event.item.data;
    if (!cable.assigned_terminals) {
      cable.assigned_terminals = [];
    }
    
    // Prevent duplicates - use Set to ensure uniqueness
    const uniqueTerminals = new Set(cable.assigned_terminals);
    uniqueTerminals.add(terminal.marker_id);
    cable.assigned_terminals = Array.from(uniqueTerminals);
  }

  removeTerminalFromCable(cable: Cable, terminalMarkerId: number) {
    if (cable.assigned_terminals) {
      cable.assigned_terminals = cable.assigned_terminals.filter(id => id !== terminalMarkerId);
    }
  }

  getTerminalByMarkerId(markerId: number): Terminal | undefined {
    return this.config.terminals.find(t => t.marker_id === markerId);
  }

  getAssignedTerminals(cable: Cable): Terminal[] {
    if (!cable.assigned_terminals) return [];
    return cable.assigned_terminals
      .map(id => this.getTerminalByMarkerId(id))
      .filter(t => t !== undefined) as Terminal[];
  }

  getCableDropListIds(): string[] {
    return this.config.cables.map(c => 'cable-' + c.cable_number);
  }

  addTeather(fromCableIndex: number) {
    const cable = this.config.cables[fromCableIndex];
    if (!cable) return;

    this.config.teathers.push({
      cable_id: cable.cable_number,
      target_cable_id: 1,
      divert_count: 12
    });
  }

  removeTeather(index: number) {
    this.config.teathers.splice(index, 1);
  }

  getTeathersForCable(cableNumber: number): TeatherSplicer[] {
    return this.config.teathers.filter(t => t.cable_id === cableNumber);
  }

  getTeatherIndex(teather: TeatherSplicer): number {
    return this.config.teathers.indexOf(teather);
  }

  updateTeatherTargetCable(teather: TeatherSplicer, value: any) {
    teather.target_cable_id = +value;
  }

  updateTeatherDivertCount(teather: TeatherSplicer, value: any) {
    teather.divert_count = +value;
  }

  getValidCableSizes(cableType: string): number[] {
    if (cableType === 'FNAP') {
      return CABLE_SIZES_BOTH;
    }
    return [...CABLE_SIZES_BOTH, ...CABLE_SIZES_BAU_ONLY];
  }

  onCableTypeChange(cable: Cable) {
    const validSizes = this.getValidCableSizes(cable.cable_type);
    if (!validSizes.includes(cable.cable_size)) {
      cable.cable_size = validSizes[0];
    }
  }

  saveConfiguration() {
    this.saving = true;
    this.savedMessage = '';

    const configToSave = {
      name: this.config.name,
      terminals: this.config.terminals.map(t => ({
        terminal_marker_id: t.marker_id,
        address: t.address,
        suggested_size: t.suggested_size,
        actual_size: t.actual_size,
        order: t.order
      })),
      cables: this.config.cables.map(c => ({
        cable_number: c.cable_number,
        cable_type: c.cable_type,
        cable_size: c.cable_size,
        order: c.order,
        assigned_terminals: c.assigned_terminals || []  // Include terminal assignments
      })),
      teathers: this.config.teathers
    };

    this.apiService.saveCableConfiguration(this.projectId, configToSave).subscribe({
      next: () => {
        this.saving = false;
        this.savedMessage = 'Configuration saved successfully!';
        setTimeout(() => (this.savedMessage = ''), 3000);
      },
      error: (err) => {
        this.saving = false;
        console.error('Failed to save configuration:', err);
        alert('Failed to save configuration. Check console for errors.');
      }
    });
  }

  goBack() {
    if (window.opener && !window.opener.closed) {
      window.opener.focus();
      window.close();
      return;
    }
    this.router.navigate(['/projects', this.projectId]);
  }
}
