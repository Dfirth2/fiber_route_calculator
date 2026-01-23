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
  const [markerMode, setMarkerMode] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [isErasingMarkers, setIsErasingMarkers] = useState(false);
  const [assignMode, setAssignMode] = useState(false);
  const [assigningFrom, setAssigningFrom] = useState(null);
  const [markerLinks, setMarkerLinks] = useState([]);
  const [conduitMode, setConduitMode] = useState(false);
  const [conduitFrom, setConduitFrom] = useState(null);
  const [conduits, setConduits] = useState([]);
  
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
      
      // Load markers, marker links, and conduits
      try {
        const [markersRes, linksRes, conduitsRes] = await Promise.all([
          projectsAPI.getMarkers(projectId),
          projectsAPI.getMarkerLinks(projectId),
          projectsAPI.getConduits(projectId),
        ]);
        
        // Convert database format to frontend format
        const markersFormatted = markersRes.data.map((m) => ({
          id: m.id,
          type: m.marker_type,
          page: m.page_number,
          x: m.x,
          y: m.y,
        }));
        
        const linksFormatted = linksRes.data.map((l) => ({
          id: l.id,
          markerId: l.marker_id,
          page: l.page_number,
          to: { x: l.to_x, y: l.to_y },
        }));
        
        const conduitsFormatted = conduitsRes.data.map((c) => ({
          id: c.id,
          terminalId: c.terminal_id,
          dropPedId: c.drop_ped_id,
          page: c.page_number,
          footage: c.footage,
        }));
        
        setMarkers(markersFormatted);
        setMarkerLinks(linksFormatted);
        setConduits(conduitsFormatted);
      } catch (error) {
        console.error('Failed to load markers/conduits:', error);
        // Not critical, continue without them
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
    if (markerMode) {
      toast.error('Exit marker mode before saving a route');
      return;
    }
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
      // Keep drawing mode active; just clear the current path for the next route
      setDraftPath([]);
      setPathResetToken((n) => n + 1);
      
      toast.success(`Route "${pathName}" added - ${response.data.length_ft.toFixed(2)} ft. Ready for next route!`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save route');
    }
  };

  const handleMarkerAdd = async (point) => {
    if (!markerMode) return;
    const newMarker = {
      marker_type: markerMode,
      page_number: currentPage,
      x: point.x,
      y: point.y,
    };
    try {
      const response = await projectsAPI.createMarker(projectId, newMarker);
      const markerWithId = {
        id: response.data.id,
        type: markerMode,
        page: currentPage,
        x: point.x,
        y: point.y,
      };
      setMarkers((prev) => [...prev, markerWithId]);
    } catch (error) {
      toast.error('Failed to save marker');
    }
  };

  const clearMarkersForPage = () => {
    setMarkers((prev) => prev.filter((m) => m.page !== currentPage));
    setMarkerLinks((prev) => prev.filter((l) => l.page !== currentPage));
    setConduits((prev) => prev.filter((c) => c.page !== currentPage));
  };

  const handleMarkerErase = async (point) => {
    const pageMarkers = markers.filter((m) => m.page === currentPage);
    if (pageMarkers.length === 0) return;
    const withDistance = pageMarkers.map((m) => ({
      marker: m,
      dist: Math.hypot(m.x - point.x, m.y - point.y),
    }));
    const nearest = withDistance.reduce((best, cur) => (cur.dist < best.dist ? cur : best), withDistance[0]);
    if (nearest.dist <= 20) {
      try {
        await projectsAPI.deleteMarker(projectId, nearest.marker.id);
        setMarkers((prev) => prev.filter((m) => m.id !== nearest.marker.id));
        setMarkerLinks((prev) => prev.filter((link) => link.markerId !== nearest.marker.id));
        setConduits((prev) => prev.filter((c) => c.terminalId !== nearest.marker.id && c.dropPedId !== nearest.marker.id));
      } catch (error) {
        toast.error('Failed to delete marker');
      }
    }
  };

  const handleExport = async (format) => {
    setExportLoading(true);
    try {
      if (format === 'pdf') {
        // PDF export - export current page with annotations
        // Pass page dimensions from viewport to handle rotation correctly
        const pageWidth = viewport?.pageWidth || null;
        const pageHeight = viewport?.pageHeight || null;
        console.log('Exporting PDF with dimensions:', pageWidth, 'x', pageHeight);
        const response = await exportsAPI.exportPdf(projectId, currentPage, pageWidth, pageHeight);
        downloadFile(response.data, `${project.name}_page_${currentPage}_annotated.pdf`, 'application/pdf');
        toast.success('PDF exported successfully with all annotations!');
      } else {
        // CSV/JSON exports - ask about slack factor
        const slackFactor = prompt('Enter slack factor (optional, e.g., 0.05 for 5%):', '');
        
        if (format === 'csv') {
          const response = await exportsAPI.exportCsv(projectId, slackFactor ? parseFloat(slackFactor) : null);
          downloadFile(response.data, `${project.name}_report.csv`, 'text/csv');
        } else {
          const response = await exportsAPI.exportJson(projectId, slackFactor ? parseFloat(slackFactor) : null);
          downloadFile(response.data, `${project.name}_report.json`, 'application/json');
        }
        toast.success('Export successful');
      }
    } catch (error) {
      toast.error('Failed to export');
      console.error(error);
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

  const handleToggleDrawing = () => {
    if (!ensureCalibrated()) return;
    setIsDrawing((prev) => !prev);
    setConduitMode(false);
    setConduitFrom(null);
    setMarkerMode(null);
    setIsErasingMarkers(false);
    setAssignMode(false);
    setAssigningFrom(null);
  };

  const handleClearRoute = () => {
    setDraftPath([]);
    setPathResetToken((n) => n + 1);
  };

  const handleStopDrawing = () => {
    setIsDrawing(false);
    setDraftPath([]);
    setPathResetToken((n) => n + 1);
  };

  const ensureCalibrated = () => {
    if (!scaleFactor) {
      toast.error('Calibrate scale first to enable drawing and markers.');
      return false;
    }
    return true;
  };

  const toggleMarkerMode = (mode) => {
    if (!ensureCalibrated()) return;
    setMarkerMode((current) => (current === mode ? null : mode));
    setIsDrawing(false);
    setIsCalibrating(false);
    setIsErasingMarkers(false);
    setAssignMode(false);
    setAssigningFrom(null);
    setConduitMode(false);
    setConduitFrom(null);
  };

  const toggleEraseMode = () => {
    if (!ensureCalibrated()) return;
    setIsErasingMarkers((prev) => !prev);
    setMarkerMode(null);
    setIsDrawing(false);
    setIsCalibrating(false);
    setAssignMode(false);
    setAssigningFrom(null);
    setConduitMode(false);
    setConduitFrom(null);
  };

  const toggleAssignMode = () => {
    if (!ensureCalibrated()) return;
    setAssignMode((prev) => !prev);
    setAssigningFrom(null);
    setMarkerMode(null);
    setIsDrawing(false);
    setIsCalibrating(false);
    setIsErasingMarkers(false);
    setConduitMode(false);
  };

  const toggleConduitMode = () => {
    if (!ensureCalibrated()) return;
    setConduitMode((prev) => !prev);
    setConduitFrom(null);
    setMarkerMode(null);
    setIsDrawing(false);
    setIsCalibrating(false);
    setIsErasingMarkers(false);
    setAssignMode(false);
    setAssigningFrom(null);
  };

  const handleAssignStart = (markerId) => {
    console.log('handleAssignStart called with:', markerId);
    setAssigningFrom(markerId);
  };

  const handleAssignComplete = async (point) => {
    console.log('handleAssignComplete called, assigningFrom:', assigningFrom, 'point:', point);
    if (!assigningFrom) return;
    const newLink = {
      marker_id: assigningFrom,
      page_number: currentPage,
      to_x: point.x,
      to_y: point.y,
    };
    try {
      const response = await projectsAPI.createMarkerLink(projectId, newLink);
      const linkWithId = {
        id: response.data.id,
        markerId: assigningFrom,
        page: currentPage,
        to: point,
      };
      console.log('Creating link:', linkWithId);
      setMarkerLinks((prev) => [...prev, linkWithId]);
    } catch (error) {
      toast.error('Failed to save marker link');
    }
    setAssigningFrom(null);
  };

  const handleConduitStart = (terminalId) => {
    console.log('handleConduitStart called with:', terminalId);
    setConduitFrom(terminalId);
  };

  const handleConduitComplete = async (dropPedId, footage) => {
    console.log('handleConduitComplete called, from:', conduitFrom, 'to:', dropPedId, 'footage:', footage);
    if (!conduitFrom) return;
    const newConduit = {
      terminal_id: conduitFrom,
      drop_ped_id: dropPedId,
      page_number: currentPage,
      footage: footage,
    };
    try {
      const response = await projectsAPI.createConduit(projectId, newConduit);
      const conduitWithId = {
        id: response.data.id,
        terminalId: conduitFrom,
        dropPedId: dropPedId,
        page: currentPage,
        footage: footage,
      };
      console.log('Creating conduit:', conduitWithId);
      setConduits((prev) => [...prev, conduitWithId]);
    } catch (error) {
      toast.error('Failed to save conduit');
    }
    setConduitFrom(null);
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

  const pageMarkers = markers.filter((m) => m.page === currentPage);
  const pageLinks = markerLinks.filter((l) => l.page === currentPage);
  const pageConduits = conduits.filter((c) => c.page === currentPage);
  const totalConduitFootage = conduits.reduce((sum, c) => sum + c.footage, 0);

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
                    setConduitMode(false);
                    setIsDrawing(false);
                    setIsCalibrating(false);
                    setMarkerMode(null);
                    setIsErasingMarkers(false);
                    setAssignMode(false);
                    setAssigningFrom(null);
                  }}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    !isDrawing && !isCalibrating && !markerMode && !isErasingMarkers && !assignMode && !conduitMode
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  🖐️ Pan
                </button>
                <button
                  onClick={handleToggleDrawing}
                  disabled={!scaleFactor}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    isDrawing
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  ✏️ Draw
                </button>
                <button
                  onClick={() => toggleMarkerMode('terminal')}
                  disabled={!scaleFactor}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    markerMode === 'terminal'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title="Place terminal (green triangle)"
                >
                  ▲ Terminal
                </button>
                <button
                  onClick={() => toggleMarkerMode('dropPed')}
                  disabled={!scaleFactor}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    markerMode === 'dropPed'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title="Place Drop Ped (purple circle)"
                >
                  ● Drop Ped
                </button>
                <button
                    onClick={toggleEraseMode}
                    disabled={!scaleFactor}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    isErasingMarkers
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title="Erase markers"
                >
                  🩹 Erase
                </button>
                <button
                    onClick={toggleAssignMode}
                    disabled={!scaleFactor}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    assignMode
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title="Assign marker to lot (draw arrow)"
                >
                  ➜ Assign
                </button>
                <button
                    onClick={toggleConduitMode}
                    disabled={!scaleFactor}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    conduitMode
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title="Draw conduit between terminal and drop ped"
                >
                  🔗 Conduit
                </button>
              </div>

              {!scaleFactor && (
                <div className="flex items-center gap-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  <span>Calibrate scale to enable drawing, markers, assignments, and conduits.</span>
                  <button
                    onClick={() => {
                      setIsDrawing(false);
                      setMarkerMode(null);
                      setIsErasingMarkers(false);
                      setAssignMode(false);
                      setConduitMode(false);
                      setAssigningFrom(null);
                      setConduitFrom(null);
                      setIsCalibrating(true);
                      window.dispatchEvent(new CustomEvent('startCalibration'));
                    }}
                    className="text-xs font-semibold text-amber-900 underline"
                  >
                    Start calibration
                  </button>
                </div>
              )}

              {/* Drawing Status & Actions */}
              {isDrawing && (
                <>
                  <div className="ml-3 flex items-center gap-2 text-sm text-blue-700">
                    <span>✏️ Drawing mode - Save routes to continue drawing more, or</span>
                    <button
                      onClick={handleStopDrawing}
                      className="text-xs font-semibold text-blue-700 underline"
                    >
                      stop drawing
                    </button>
                  </div>

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
                      💾 Save & Next
                    </button>
                  </div>
                </>
              )}

              {markerMode && (
                <div className="ml-3 flex items-center gap-2 text-sm text-gray-700">
                  <span>Marker mode:</span>
                  <span className="font-semibold">
                    {markerMode === 'terminal' ? 'Terminal (green triangle)' : 'Drop Ped (purple circle)'}
                  </span>
                </div>
              )}

                {isErasingMarkers && (
                  <div className="ml-3 flex items-center gap-2 text-sm text-red-700">
                    <span>Erase markers mode</span>
                  </div>
                )}

                {assignMode && (
                  <div className="ml-3 flex items-center gap-2 text-sm text-amber-700">
                    <span>Assign mode: click a marker, then a target point</span>
                    {assigningFrom && <span className="font-semibold">(selected)</span>}
                  </div>
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
              overlayCanvas={pdfCanvas && (isDrawing || isCalibrating || savedCalibrationPoints.length > 0 || markerMode || isErasingMarkers || assignMode || conduitMode || conduitFrom || markers.some((m) => m.page === currentPage) || pageLinks.length > 0 || pageConduits.length > 0) ? (
                <DrawingCanvas
                  key={`canvas-${assignMode}-${assigningFrom}-${conduitMode}-${conduitFrom}`}
                  pdfCanvas={pdfCanvas}
                  viewport={viewport}
                  isActive={isDrawing}
                  markerMode={markerMode}
                  markers={markers.filter((m) => m.page === currentPage)}
                  onMarkerAdd={handleMarkerAdd}
                  onMarkerErase={handleMarkerErase}
                  erasingMarkers={isErasingMarkers}
                  assignMode={assignMode}
                  assigningFrom={assigningFrom}
                  onAssignStart={handleAssignStart}
                  onAssignComplete={handleAssignComplete}
                  markerLinks={pageLinks}
                  conduitMode={conduitMode}
                  conduitFrom={conduitFrom}
                  onConduitStart={handleConduitStart}
                  onConduitComplete={handleConduitComplete}
                  conduits={pageConduits}
                  scaleFactor={scaleFactor}
                  polylines={polylines.filter((p) => p.page_number === currentPage)}
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

          {/* Markers */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Markers</h3>
              <button
                onClick={clearMarkersForPage}
                disabled={pageMarkers.length === 0}
                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Clear page
              </button>
            </div>
            {pageMarkers.length === 0 ? (
              <p className="text-sm text-gray-600">No markers on this page.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {pageMarkers.map((marker) => (
                  <div key={marker.id} className="flex items-center justify-between text-sm border rounded px-2 py-1">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full"
                        style={{
                          backgroundColor: marker.type === 'terminal' ? '#10b981' : '#a855f7',
                          clipPath: marker.type === 'terminal' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : 'none',
                        }}
                      ></span>
                      {marker.type === 'terminal' ? 'Terminal' : 'Drop Ped'}
                    </span>
                    <span className="text-gray-600">({marker.x.toFixed(1)}, {marker.y.toFixed(1)})</span>
                  </div>
                ))}
              </div>
            )}
            {pageLinks.length > 0 && (
              <div className="mt-3 text-sm text-gray-700 space-y-1">
                <div className="font-semibold">Assignments</div>
                {pageLinks.map((link) => {
                  const m = pageMarkers.find((pm) => pm.id === link.markerId);
                  return (
                    <div key={link.id} className="flex items-center justify-between border rounded px-2 py-1">
                      <span>{m ? (m.type === 'terminal' ? 'Terminal' : 'Drop Ped') : 'Marker'} → ({link.to.x.toFixed(1)}, {link.to.y.toFixed(1)})</span>
                    </div>
                  );
                })}
              </div>
            )}
            {pageConduits.length > 0 && (
              <div className="mt-3 text-sm text-gray-700 space-y-1">
                <div className="font-semibold">Conduits</div>
                {pageConduits.map((c) => {
                  const fromMarker = pageMarkers.find((pm) => pm.id === c.terminalId);
                  const toMarker = pageMarkers.find((pm) => pm.id === c.dropPedId);
                  return (
                    <div key={c.id} className="flex items-center justify-between border rounded px-2 py-1">
                      <span>
                        {fromMarker ? (fromMarker.type === 'terminal' ? 'Terminal' : 'Marker') : 'Terminal'} → {toMarker ? (toMarker.type === 'dropPed' ? 'Drop Ped' : 'Marker') : 'Drop Ped'}
                      </span>
                      <span className="font-medium text-gray-900">{c.footage.toFixed(1)} ft</span>
                    </div>
                  );
                })}
                <div className="flex justify-between border-t pt-2 mt-1 font-semibold">
                  <span>Total</span>
                  <span>{pageConduits.reduce((sum, c) => sum + c.footage, 0).toFixed(1)} ft</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Project total</span>
                  <span>{totalConduitFootage.toFixed(1)} ft</span>
                </div>
              </div>
            )}
          </div>

          {/* Measurements */}
          <MeasurementDisplay
            polylines={polylines}
            totalLength={totalLength}
            exportLoading={exportLoading}
            onExport={handleExport}
            projectPageCount={project.page_count}
            currentPage={currentPage}
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
