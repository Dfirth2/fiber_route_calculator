import { create } from 'zustand';

export const useProjectStore = create((set) => ({
  projects: [],
  currentProject: null,
  currentPage: 1,
  
  setProjects: (projects) => set({ projects }),
  setCurrentProject: (project) => set({ currentProject: project }),
  setCurrentPage: (page) => set({ currentPage: page }),
  
  addProject: (project) =>
    set((state) => ({
      projects: [...state.projects, project],
    })),
  
  removeProject: (projectId) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== projectId),
    })),
}));

export const useDrawingStore = create((set) => ({
  polylines: [],
  currentPolyline: null,
  isDrawing: false,
  scale: 1,
  
  setPolylines: (polylines) => set({ polylines }),
  setCurrentPolyline: (polyline) => set({ currentPolyline: polyline }),
  setIsDrawing: (isDrawing) => set({ isDrawing }),
  setScale: (scale) => set({ scale }),
  
  addPoint: (point) =>
    set((state) => {
      if (!state.currentPolyline) {
        return {
          currentPolyline: {
            name: `Route ${state.polylines.length + 1}`,
            points: [point],
            description: '',
          },
        };
      }
      return {
        currentPolyline: {
          ...state.currentPolyline,
          points: [...state.currentPolyline.points, point],
        },
      };
    }),
  
  finishPolyline: () =>
    set((state) => {
      if (!state.currentPolyline || state.currentPolyline.points.length < 2) {
        return {};
      }
      return {
        polylines: [...state.polylines, state.currentPolyline],
        currentPolyline: null,
      };
    }),
  
  cancelPolyline: () =>
    set({
      currentPolyline: null,
    }),
  
  updatePolyline: (index, updates) =>
    set((state) => {
      const newPolylines = [...state.polylines];
      newPolylines[index] = { ...newPolylines[index], ...updates };
      return { polylines: newPolylines };
    }),
  
  deletePolyline: (index) =>
    set((state) => ({
      polylines: state.polylines.filter((_, i) => i !== index),
    })),
}));

export const useCalibrationStore = create((set) => ({
  calibrations: {},
  currentCalibrationMode: null,
  calibrationPoints: [],
  
  setCalibrations: (calibrations) => set({ calibrations }),
  setCurrentCalibrationMode: (mode) => set({ currentCalibrationMode: mode }),
  setCalibrateionPoints: (points) => set({ calibrationPoints: points }),
  
  addCalibrationPoint: (point) =>
    set((state) => ({
      calibrationPoints: [...state.calibrationPoints, point],
    })),
  
  finishCalibration: () =>
    set({
      currentCalibrationMode: null,
      calibrationPoints: [],
    }),
}));
