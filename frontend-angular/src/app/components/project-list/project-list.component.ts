import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Project } from '../../core/services/state.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="space-y-6 relative">
      <!-- Loading Overlay -->
      <div *ngIf="isDeleting" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-6 shadow-xl">
          <div class="text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p class="text-gray-700 font-medium">Deleting project...</p>
          </div>
        </div>
      </div>
      <div>
        <h2 class="text-2xl font-bold mb-4">Projects</h2>
        <div class="bg-white p-6 rounded shadow space-y-4">
          <h3 class="text-lg font-semibold">Create New Project</h3>
          <input 
            #projectName
            type="text" 
            placeholder="Project name"
            class="w-full px-3 py-2 border rounded"
          >
          <input 
            #pdfFile
            type="file" 
            accept=".pdf"
            class="w-full px-3 py-2 border rounded"
          >
          <button 
            (click)="createProject(projectName.value, pdfFile.files?.[0])"
            [disabled]="isCreating"
            class="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Project
          </button>
        </div>
      </div>

      <div>
        <h3 class="text-lg font-semibold mb-4">Existing Projects</h3>
        <div *ngIf="isLoading" class="text-gray-500">Loading projects...</div>
        <div *ngIf="!isLoading && projects.length === 0" class="text-gray-500">
          No projects yet. Create one above!
        </div>
        <div *ngIf="!isLoading && projects.length > 0" class="bg-white rounded shadow overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50 border-b">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project Name
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Fiber (ft)
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr *ngFor="let project of projects" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <a 
                    [routerLink]="['/projects', project.id]" 
                    class="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {{ project.name }}
                  </a>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-gray-700">
                  {{ project.total_length_ft | number:'1.2-2' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <button 
                    (click)="deleteProject(project.id)"
                    class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class ProjectListComponent implements OnInit {
  projects: Project[] = [];
  isCreating = false;
  isLoading = false;
  isDeleting = false;

  constructor(
    private apiService: ApiService, 
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    // Reload projects whenever we navigate to this route
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.router.url === '/projects') {
          console.log('ProjectListComponent: Navigated to /projects, reloading...');
          this.loadProjects();
        }
      });
  }

  ngOnInit() {
    console.log('ProjectListComponent: ngOnInit called, loading projects...');
    this.loadProjects();
  }

  loadProjects() {
    console.log('ProjectListComponent: loadProjects called');
    this.isLoading = true;
    this.apiService.getProjects().subscribe({
      next: (data: any) => {
        console.log('ProjectListComponent: Received projects:', data);
        this.projects = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('ProjectListComponent: Failed to load projects', error);
        this.isLoading = false;
        this.cdr.detectChanges();
        alert('Failed to load projects. Check console for details.');
      }
    });
  }

  createProject(name: string, file: File | undefined) {
    if (!name || !file) {
      alert('Please enter a project name and select a PDF file');
      return;
    }
    // Prevent duplicate names on the client before calling the API
    const exists = this.projects.some(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (exists) {
      alert('Project name already exists. Please choose a different name.');
      return;
    }

    if (this.isCreating) return;
    this.isCreating = true;

    this.apiService.createProject(name.trim(), file).subscribe(
      (created) => {
        this.isCreating = false;
        // Redirect straight into the new project's editor
        this.router.navigate(['/projects', created.id]);
      },
      (error) => {
        this.isCreating = false;
        console.error('Failed to create project', error);
        alert(error?.error?.detail || 'Failed to create project');
      }
    );
  }

  deleteProject(id: number) {
    if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      this.isDeleting = true;
      this.apiService.deleteProject(id).subscribe(
        () => {
          // Reload projects to ensure data consistency
          this.loadProjects();
          this.isDeleting = false;
        },
        (error) => {
          console.error('Failed to delete project', error);
          this.isDeleting = false;
          alert('Failed to delete project. Please try again.');
        }
      );
    }
  }
}
