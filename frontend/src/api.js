import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Projects API
export const projectsAPI = {
  create: (name, description, pdfFile) => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('pdf_file', pdfFile);
    return api.post('/projects/', formData);
  },
  list: () => api.get('/projects/'),
  get: (projectId) => api.get(`/projects/${projectId}`),
  delete: (projectId) => api.delete(`/projects/${projectId}`),
  
  // Scale calibrations
  createCalibration: (projectId, calibration) =>
    api.post(`/projects/${projectId}/scale-calibrations`, calibration),
  
  // Polylines
  createPolyline: (projectId, polyline) =>
    api.post(`/projects/${projectId}/polylines`, polyline),
  updatePolyline: (projectId, polylineId, data) =>
    api.put(`/projects/${projectId}/polylines/${polylineId}`, data),
  deletePolyline: (projectId, polylineId) =>
    api.delete(`/projects/${projectId}/polylines/${polylineId}`),
};

// Exports API
export const exportsAPI = {
  exportCsv: (projectId, slackFactor = null) => {
    const params = slackFactor ? { slack_factor: slackFactor } : {};
    return api.get(`/exports/${projectId}/csv`, {
      params,
      responseType: 'blob',
    });
  },
  exportJson: (projectId, slackFactor = null) => {
    const params = slackFactor ? { slack_factor: slackFactor } : {};
    return api.get(`/exports/${projectId}/json`, {
      params,
      responseType: 'blob',
    });
  },
};

export default api;
