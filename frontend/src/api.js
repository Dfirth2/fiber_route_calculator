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
  
  // Markers
  createMarker: (projectId, marker) =>
    api.post(`/projects/${projectId}/markers`, marker),
  getMarkers: (projectId, pageNumber = null) => {
    const params = pageNumber ? { page_number: pageNumber } : {};
    return api.get(`/projects/${projectId}/markers`, { params });
  },
  deleteMarker: (projectId, markerId) =>
    api.delete(`/projects/${projectId}/markers/${markerId}`),
  
  // Marker Links
  createMarkerLink: (projectId, link) =>
    api.post(`/projects/${projectId}/marker-links`, link),
  getMarkerLinks: (projectId, pageNumber = null) => {
    const params = pageNumber ? { page_number: pageNumber } : {};
    return api.get(`/projects/${projectId}/marker-links`, { params });
  },
  deleteMarkerLink: (projectId, linkId) =>
    api.delete(`/projects/${projectId}/marker-links/${linkId}`),
  
  // Conduits
  createConduit: (projectId, conduit) =>
    api.post(`/projects/${projectId}/conduits`, conduit),
  getConduits: (projectId, pageNumber = null) => {
    const params = pageNumber ? { page_number: pageNumber } : {};
    return api.get(`/projects/${projectId}/conduits`, { params });
  },
  deleteConduit: (projectId, conduitId) =>
    api.delete(`/projects/${projectId}/conduits/${conduitId}`),
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
  exportPdf: (projectId, pageNumber = 1, pageWidth = null, pageHeight = null) => {
    const params = { page_number: pageNumber };
    if (pageWidth !== null) params.page_width = pageWidth;
    if (pageHeight !== null) params.page_height = pageHeight;
    return api.get(`/exports/${projectId}/pdf`, {
      params,
      responseType: 'blob',
    });
  },
};

export default api;
