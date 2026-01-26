import { Routes } from '@angular/router';
import { ProjectEditorComponent } from './components/project-editor/project-editor.component';
import { ProjectListComponent } from './components/project-list/project-list.component';

export const routes: Routes = [
  { path: '', redirectTo: '/projects', pathMatch: 'full' },
  { path: 'projects', component: ProjectListComponent },
  { path: 'projects/:id', component: ProjectEditorComponent },
];
