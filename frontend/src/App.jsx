import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import ProjectUpload from './components/ProjectUpload';
import ProjectEditor from './components/ProjectEditor';
import { projectsAPI } from './api';

export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  useEffect(() => {
    loadProjects();
    
    // Listen for project creation events
    const handleProjectCreated = () => {
      loadProjects();
      setCurrentView('list');
    };
    
    window.addEventListener('projectCreated', handleProjectCreated);
    return () => window.removeEventListener('projectCreated', handleProjectCreated);
  }, []);

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const response = await projectsAPI.list();
      setProjects(response.data);
    } catch (error) {
      toast.error('Failed to load projects');
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleProjectCreated = async () => {
    await loadProjects();
    setCurrentView('list');
  };

  const handleSelectProject = (projectId) => {
    setSelectedProjectId(projectId);
    setCurrentView('editor');
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    
    try {
      await projectsAPI.delete(projectId);
      toast.success('Project deleted');
      await loadProjects();
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  if (currentView === 'editor' && selectedProjectId) {
    return (
      <div className="h-screen flex flex-col bg-gray-100">
        <div className="bg-white border-b border-gray-300 p-3">
          <button
            onClick={() => {
              setCurrentView('list');
              setSelectedProjectId(null);
            }}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to Projects
          </button>
        </div>
        <Toaster position="top-right" />
        <div className="flex-1">
          <ProjectEditor projectId={selectedProjectId} />
        </div>
      </div>
    );
  }

  if (currentView === 'list') {
    return (
      <div className="min-h-screen bg-gray-100">
        <Toaster position="top-right" />
        
        <header className="bg-blue-600 text-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Fiber Route Calculator</h1>
              <p className="text-blue-100 mt-1">Projects</p>
            </div>
            <button
              onClick={() => setCurrentView('home')}
              className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg"
            >
              + New Project
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {isLoadingProjects ? (
            <div className="text-center py-8">Loading...</div>
          ) : projects.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600 mb-4">No projects yet</p>
              <button
                onClick={() => setCurrentView('home')}
                className="button-primary"
              >
                Create Your First Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div key={project.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="text-sm text-gray-600 mb-4">
                        {project.description}
                      </p>
                    )}
                    
                    <div className="bg-blue-50 p-3 rounded mb-4">
                      <p className="text-sm text-gray-600">Total Fiber:</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {project.total_length_ft.toFixed(2)} ft
                      </p>
                    </div>
                    
                    <p className="text-xs text-gray-500 mb-4">
                      Created: {new Date(project.created_at).toLocaleDateString()}
                    </p>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSelectProject(project.id)}
                        className="button-primary flex-1 text-sm py-2"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => handleDeleteProject(project.id)}
                        className="button-danger flex-1 text-sm py-2"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-blue-600 text-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Fiber Route Calculator</h1>
            <p className="text-blue-100 mt-1">Measure fiber routes from subdivision plats</p>
          </div>
          {projects.length > 0 && (
            <button
              onClick={() => setCurrentView('list')}
              className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg"
            >
              View Projects ({projects.length})
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Project Upload */}
          <div>
            <ProjectUpload />
          </div>

          {/* Right: Instructions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Getting Started</h2>
            <ol className="space-y-3 list-decimal list-inside text-sm text-gray-700">
              <li><strong>Upload PDF:</strong> Select your subdivision plat PDF file</li>
              <li><strong>Calibrate Scale:</strong> Use manual entry or click two points to set the scale</li>
              <li><strong>Draw Routes:</strong> Click to trace fiber paths on the plat</li>
              <li><strong>Double-click:</strong> to complete a route</li>
              <li><strong>Review:</strong> Check calculated totals</li>
              <li><strong>Export:</strong> Download CSV or JSON report</li>
            </ol>
            
            <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-600">
              <p className="text-sm text-blue-900">
                <strong>Tip:</strong> For best results, use high-quality PDF scans 
                of your plats. Ensure the PDF scale is clearly marked.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
