import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { projectsAPI, exportsAPI } from '../api';
import PDFViewer from './PDFViewer';
import DrawingCanvas from './DrawingCanvas';
import ScaleCalibration from './ScaleCalibration';
import MeasurementDisplay from './MeasurementDisplay';

export default function ProjectEditor({ projectId }) {
  const [project, setProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [polylines, setPolylines] = useState([]);
  const [totalLength, setTotalLength] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [savedCalibrationPoints, setSavedCalibrationPoints] = useState([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [pdfCanvas, setPdfCanvas] = useState(null);
  const [viewport, setViewport] = useState(null);
  const [draftPath, setDraftPath] = useState([]);
  const [pathResetToken, setPathResetToken] = useState(0);
  const [scaleFactor, setScaleFactor] = useState(null);
  
  const handleCalibrationSuccess = (payload) => {
    if (payload?.points) {
      setSavedCalibrationPoints(payload.points);
    }
    if (payload?.scaleFactor) {
      setScaleFactor(payload.scaleFactor);
    }
    setIsCalibrating(false);
  };

  useEffect(() => {
    loadProject();
  }, [projectId]);

  useEffect(() => {
    const handleStartCalibration = () => {
      setIsCalibrating(true);
    };
    
    const handleCalibrationSaved = (event) => {
      const detail = event.detail || {};
      setSavedCalibrationPoints(detail.points || []);
      setIsCalibrating(false);
    };

    const handleCancelCalibration = () => {
      setIsCalibrating(false);
    };

    window.addEventListener('startCalibration', handleStartCalibration);
    window.addEventListener('calibrationSaved', handleCalibrationSaved);
    window.addEventListener('cancelCalibration', handleCancelCalibration);
    
    return () => {
      window.removeEventListener('startCalibration', handleStartCalibration);
      window.removeEventListener('calibrationSaved', handleCalibrationSaved);
      window.removeEventListener('cancelCalibration', handleCancelCalibration);
    };
  }, []);

  const loadProject = async () => {
    setIsLoading(true);
    try {
      const response = await projectsAPI.get(projectId);
      setProject(response.data);
      setPolylines(response.data.polylines || []);
      setTotalLength(response.data.total_length_ft || 0);

      // Load saved calibration points (if any) for the current page
      if (response.data.scale_calibrations && response.data.scale_calibrations.length > 0) {
        // Prefer matching current page; fallback to first
        const match = response.data.scale_calibrations.find(
          (c) => c.page_number === currentPage && c.point_a && c.point_b
        ) || response.data.scale_calibrations.find((c) => c.point_a && c.point_b);
        if (match) {
          setSavedCalibrationPoints([match.point_a, match.point_b]);
          if (match.scale_factor) {
            setScaleFactor(match.scale_factor);
          }
        }
      } else {
        setSavedCalibrationPoints([]);
        setScaleFactor(null);
      }
      
      // Set the PDF URL for the viewer
      setPdfUrl(`/api/projects/${projectId}/pdf`);
    } catch (error) {
      toast.error('Failed to load project');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePathComplete = async (points) => {
    const path = points && points.length ? points : draftPath;
    if (!path || path.length < 2) {
      toast.error('Add at least two points before saving');
      return;
    }

    const pathName = prompt('Enter route name:', `Route ${polylines.length + 1}`);
    if (!pathName) return;

    try {
      const response = await projectsAPI.createPolyline(projectId, {
        name: pathName,
        description: '',
        page_number: currentPage,
        points: path,
      });

      setPolylines([...polylines, response.data]);
      setTotalLength(project.total_length_ft + response.data.length_ft);
      setIsDrawing(false);
      setDraftPath([]);
      setPathResetToken((n) => n + 1);
      
      toast.success(`Route "${pathName}" added - ${response.data.length_ft.toFixed(2)} ft`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save route');
    }
  };

  const handleExport = async (format) => {
    setExportLoading(true);
    try {
      const slackFactor = prompt('Enter slack factor (optional, e.g., 0.05 for 5%):', '');
      
      if (format === 'csv') {
        const response = await exportsAPI.exportCsv(projectId, slackFactor ? parseFloat(slackFactor) : null);
        downloadFile(response.data, `${project.name}_report.csv`, 'text/csv');
      } else {
        const response = await exportsAPI.exportJson(projectId, slackFactor ? parseFloat(slackFactor) : null);
        downloadFile(response.data, `${project.name}_report.json`, 'application/json');
      }
      
      toast.success('Export successful');
    } catch (error) {
      toast.error('Failed to export');
    } finally {
      setExportLoading(false);
    }
  };

  const calculateDraftFootage = () => {
    if (!draftPath || draftPath.length < 2) {
      toast.error('Add at least two points to calculate footage');
      return;
    }
    if (!scaleFactor) {
      toast.error('Calibrate scale first to calculate footage');
      return;
    }
    let dist = 0;
    for (let i = 1; i < draftPath.length; i++) {
      const dx = draftPath[i].x - draftPath[i - 1].x;
      const dy = draftPath[i].y - draftPath[i - 1].y;
      dist += Math.sqrt(dx * dx + dy * dy);
    }
    const feet = dist * scaleFactor;
    toast.success(`Draft route length: ${feet.toFixed(2)} ft`);
  };

  const calculateSegmentDistances = () => {
    if (!draftPath || draftPath.length < 2 || !scaleFactor) return [];
    const segments = [];
    for (let i = 1; i < draftPath.length; i++) {
      const dx = draftPath[i].x - draftPath[i - 1].x;
      const dy = draftPath[i].y - draftPath[i - 1].y;
      const pdfDist = Math.sqrt(dx * dx + dy * dy);
      const feet = pdfDist * scaleFactor;
      segments.push({ from: i - 1, to: i, distance: feet });
    }
    return segments;
  };

  const handleUndoPoint = () => {
    if (draftPath.length === 0) return;
    const newPath = draftPath.slice(0, -1);
    setDraftPath(newPath);
  };

  const handleClearRoute = () => {
    setDraftPath([]);
    setPathResetToken((n) => n + 1);
  };

  const downloadFile = (blob, filename, type) => {
    const url = window.URL.createObjectURL(new Blob([blob], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!project) {
    return <div className="text-center py-8">Project not found</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow p-4 border-b border-gray-300">
        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        <p className="text-sm text-gray-600">
          {project.description}
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Left: PDF Viewer and Canvas */}
        <div className="flex-1 flex flex-col bg-white rounded-lg shadow overflow-hidden">
          {/* Toolbar */}
          <div className="bg-gray-50 border-b border-gray-200 px-3 py-2">
            <div className="flex items-center gap-3">
              {/* Mode Controls */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsDrawing(false);
                    setIsCalibrating(false);
                  }}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    !isDrawing && !isCalibrating
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  🖐️ Pan
                </button>
                <button
                  onClick={() => setIsDrawing(!isDrawing)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    isDrawing
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  ✏️ Draw
                </button>
              </div>

              {/* Drawing Status & Actions */}
              {isDrawing && (
                <>
                  <div className="h-6 w-px bg-gray-300"></div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      {draftPath.length} point{draftPath.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={handleUndoPoint}
                      disabled={draftPath.length === 0}
                      className="p-1.5 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                      title="Undo (Backspace)"
                    >
                      ↶
                    </button>
                    <button
                      onClick={handleClearRoute}
                      disabled={draftPath.length === 0}
                      className="p-1.5 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                      title="Clear (Esc)"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="h-6 w-px bg-gray-300"></div>

                  <div className="flex gap-2">
                    <button
                      onClick={calculateDraftFootage}
                      disabled={draftPath.length < 2}
                      className="px-3 py-1.5 rounded text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
                    >
                      📏 Calculate
                    </button>
                    <button
                      onClick={() => handlePathComplete()}
                      disabled={draftPath.length < 2}
                      className="px-3 py-1.5 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:hover:bg-green-600 transition-colors shadow-sm"
                    >
                      💾 Save
                    </button>
                  </div>
                </>
              )}

              {/* Page Info */}
              <span className="text-sm text-gray-500 ml-auto">
                Page {currentPage} / {project.page_count}
              </span>
            </div>
          </div>
          
          <div className="flex-1 relative">
            <PDFViewer
              pdfUrl={pdfUrl}
              onPageChange={setCurrentPage}
              onCanvasReady={(canvas, vp) => {
                setPdfCanvas(canvas);
                setViewport(vp);
              }}
              overlayCanvas={pdfCanvas && (isDrawing || isCalibrating || savedCalibrationPoints.length > 0) ? (
                <DrawingCanvas
                  pdfCanvas={pdfCanvas}
                  viewport={viewport}
                  isActive={isDrawing}
                  savedCalibrationPoints={savedCalibrationPoints}
                  onPointAdded={() => {}}
                  onPathChange={setDraftPath}
                  onPathComplete={handlePathComplete}
                  onUndo={handleUndoPoint}
                  onClear={handleClearRoute}
                  resetToken={pathResetToken}
                />
              ) : null}
            />
          </div>
        </div>

        {/* Right: Controls */}
        <div className="w-80 flex flex-col gap-4 overflow-y-auto">
          {/* Segment Distances */}
          {isDrawing && draftPath.length >= 2 && scaleFactor && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-3">Segment Distances</h3>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {calculateSegmentDistances().map((seg, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm py-1.5 px-2 bg-gray-50 rounded">
                    <span className="text-gray-600">P{seg.from + 1} → P{seg.to + 1}</span>
                    <span className="font-medium text-gray-900">{seg.distance.toFixed(2)} ft</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between items-center text-sm font-semibold">
                  <span>Total:</span>
                  <span>{calculateSegmentDistances().reduce((sum, s) => sum + s.distance, 0).toFixed(2)} ft</span>
                </div>
              </div>
            </div>
          )}

          {/* Scale Calibration */}
          <ScaleCalibration
            projectId={projectId}
            pageNumber={currentPage}
            onCalibrationSuccess={handleCalibrationSuccess}
          />

          {/* Measurements */}
          <MeasurementDisplay
            polylines={polylines}
            totalLength={totalLength}
            exportLoading={exportLoading}
            onExport={handleExport}
          />

          {/* Routes List */}
          {polylines.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold mb-3">Routes</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {polylines.map((polyline) => (
                  <div key={polyline.id} className="text-sm border rounded p-2">
                    <p className="font-medium">{polyline.name}</p>
                    <p className="text-gray-600">{polyline.length_ft.toFixed(2)} ft</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
