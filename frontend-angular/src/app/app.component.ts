import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-gray-50">
      <nav class="bg-white shadow">
        <div class="max-w-7xl mx-auto px-4 py-4">
          <h1 class="text-2xl font-bold text-gray-900">Fiber Route Calculator</h1>
        </div>
      </nav>
      <main class="max-w-7xl mx-auto px-4 py-8">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
})
export class AppComponent {}
