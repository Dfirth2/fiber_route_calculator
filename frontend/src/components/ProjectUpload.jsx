import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { projectsAPI } from '../api';

export default function ProjectUpload() {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    pdfFile: null,
  });
  
  const handleFileChange = (e) => {
    setFormData({
      ...formData,
      pdfFile: e.target.files[0],
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Project name is required');
      return;
    }
    
    if (!formData.pdfFile) {
      toast.error('PDF file is required');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await projectsAPI.create(
        formData.name,
        formData.description,
        formData.pdfFile
      );
      
      const newProject = response.data;
      
      toast.success('Project created successfully');
      setFormData({ name: '', description: '', pdfFile: null });
      
      // Trigger a project list refresh in the parent
      window.dispatchEvent(new CustomEvent('projectCreated', { detail: newProject }));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create project');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Create New Project</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project Name *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="e.g., Subdivision A - Phase 1"
            className="input-field w-full"
            disabled={isLoading}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Project notes and details..."
            rows="3"
            className="input-field w-full"
            disabled={isLoading}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            PDF Plat File *
          </label>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="input-field w-full"
            disabled={isLoading}
          />
          {formData.pdfFile && (
            <p className="text-sm text-gray-600 mt-2">
              Selected: {formData.pdfFile.name}
            </p>
          )}
        </div>
        
        <button
          type="submit"
          disabled={isLoading}
          className="button-primary w-full disabled:opacity-50"
        >
          {isLoading ? 'Creating...' : 'Create Project'}
        </button>
      </form>
    </div>
  );
}
