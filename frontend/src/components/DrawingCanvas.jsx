import React, { useEffect, useRef } from 'react';

export default function DrawingCanvas({
  pdfCanvas,
  viewport,
  onPointAdded,
  onPathChange,
  onPathComplete,
  onUndo,
  onClear,
  isActive,
  markerMode,
  markers = [],
  onMarkerAdd,
  onMarkerErase,
  erasingMarkers = false,
  assignMode = false,
  assigningFrom = null,
  onAssignStart,
  onAssignComplete,
  markerLinks = [],
  conduitMode = false,
  conduitFrom = null,
  onConduitStart,
  onConduitComplete,
  conduits = [],
  scaleFactor = null,
  savedCalibrationPoints = [],
  polylines = [],

  resetToken,
}) {
  const selectionRadius = 26;
  const canvasRef = useRef(null);
  const pointsRef = useRef([]);
  const contextRef = useRef(null);
  const viewportScaleRef = useRef(1); // Track zoom/scale factor
  const pageDimsRef = useRef({ width: 612, height: 792 }); // Default to letter size
  const [currentPath, setCurrentPath] = React.useState([]);
  const [calibrationMode, setCalibrationMode] = React.useState(false);
  const [calibrationPoints, setCalibrationPoints] = React.useState([]);

  useEffect(() => {
    if (!pdfCanvas || !canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = pdfCanvas.width;
    canvas.height = pdfCanvas.height;
    
    // Extract zoom scale and page dimensions from viewport if available
    if (viewport) {
      if (viewport.scale) {
        console.log('DrawingCanvas: Updating viewport scale from', viewportScaleRef.current, 'to', viewport.scale);
        viewportScaleRef.current = viewport.scale;
      }
      if (viewport.pageWidth && viewport.pageHeight) {
        console.log('DrawingCanvas: Page dims (scale 1.0):', viewport.pageWidth, 'x', viewport.pageHeight);
        console.log('DrawingCanvas: Canvas actual size:', canvas.width, 'x', canvas.height);
        pageDimsRef.current = {
          width: viewport.pageWidth,
          height: viewport.pageHeight,
        };
      }
    }
    
    // Position the canvas to overlay the PDF canvas exactly (they're siblings in the same transformed div)
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    // Only capture mouse events when drawing or calibrating; otherwise let panning work
    canvas.style.pointerEvents = (calibrationMode || isActive || !!markerMode || erasingMarkers || assignMode) ? 'auto' : 'none';

    const context = canvas.getContext('2d');
    contextRef.current = context;

    // Only capture mouse events when drawing or calibrating; otherwise let panning work
    canvas.style.pointerEvents = (calibrationMode || isActive || !!markerMode || erasingMarkers || assignMode) ? 'auto' : 'none';

    // Copy PDF canvas content
    context.drawImage(pdfCanvas, 0, 0);
  }, [pdfCanvas, viewport]);

  // Keep pointer events synced with modes so panning works when idle
  useEffect(() => {
    if (!canvasRef.current) return;
    canvasRef.current.style.pointerEvents = (calibrationMode || isActive || !!markerMode || erasingMarkers || assignMode || conduitMode) ? 'auto' : 'none';
  }, [calibrationMode, isActive, markerMode, erasingMarkers, assignMode, conduitMode]);

  const drawMarker = (marker) => {
    if (!contextRef.current) return;
    const ctx = contextRef.current;

    if (marker.type === 'terminal') {
      ctx.fillStyle = '#10b981';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      const size = 15;
      const height = size * Math.sqrt(3) / 2;
      ctx.beginPath();
      ctx.moveTo(marker.x, marker.y - height);
      ctx.lineTo(marker.x - size / 2, marker.y + height / 2);
      ctx.lineTo(marker.x + size / 2, marker.y + height / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (marker.type === 'dropPed') {
      ctx.fillStyle = '#a855f7';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 12, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
  };

  const drawArrow = (from, to) => {
    if (!contextRef.current) return;
    const ctx = contextRef.current;
    const headlen = 12;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);

    ctx.strokeStyle = '#0f172a';
    ctx.fillStyle = '#0f172a';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - headlen * Math.cos(angle - Math.PI / 6), to.y - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(to.x - headlen * Math.cos(angle + Math.PI / 6), to.y - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  };

  const drawConduit = (from, to, footage) => {
    if (!contextRef.current) return;
    const ctx = contextRef.current;
    
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw distance label at midpoint
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const footageStr = `${footage.toFixed(1)} ft`;
    
    ctx.fillStyle = '#0ea5e9';
    ctx.font = 'bold 12px sans-serif';
    const textWidth = ctx.measureText(footageStr).width;
    ctx.fillRect(midX - textWidth / 2 - 3, midY - 10, textWidth + 6, 16);
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText(footageStr, midX - textWidth / 2, midY + 4);
  };
  const redraw = (points) => {
    if (!contextRef.current || !pdfCanvas) return;

    const canvas = canvasRef.current;
    const context = contextRef.current;

    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redraw PDF
    context.drawImage(pdfCanvas, 0, 0);

    // Draw saved polylines
    if (polylines && polylines.length > 0) {
      polylines.forEach((polyline) => {
        if (polyline.points && polyline.points.length > 1) {
          context.strokeStyle = '#3b82f6';
          context.lineWidth = 2;
          context.beginPath();
          const p0 = toCanvasCoordinates(polyline.points[0]);
          context.moveTo(p0.x, p0.y);
          for (let i = 1; i < polyline.points.length; i++) {
            const p = toCanvasCoordinates(polyline.points[i]);
            context.lineTo(p.x, p.y);
          }
          context.stroke();
        }
      });
    }

    // Draw calibration points if in calibration mode
    if (calibrationMode && calibrationPoints.length > 0) {
      calibrationPoints.forEach((point, index) => {
        const canvasPoint = toCanvasCoordinates(point);
        context.fillStyle = '#10b981';
        context.beginPath();
        context.arc(canvasPoint.x, canvasPoint.y, 5, 0, 2 * Math.PI);
        context.fill();
        context.strokeStyle = 'white';
        context.lineWidth = 2;
        context.stroke();
        
        // Draw label
        context.fillStyle = '#10b981';
        context.font = 'bold 12px sans-serif';
        context.fillText(`P${index + 1}`, canvasPoint.x + 8, canvasPoint.y - 8);
      });
      
      // Draw line between calibration points
      if (calibrationPoints.length === 2) {
        context.strokeStyle = '#10b981';
        context.lineWidth = 2;
        context.setLineDash([5, 5]);
        context.beginPath();
        const p0 = toCanvasCoordinates(calibrationPoints[0]);
        const p1 = toCanvasCoordinates(calibrationPoints[1]);
        context.moveTo(p0.x, p0.y);
        context.lineTo(p1.x, p1.y);
        context.stroke();
        context.setLineDash([]);
      }
      return;
    }

    // Draw saved calibration points (when not actively calibrating)
    if (!calibrationMode && savedCalibrationPoints.length === 2) {
      savedCalibrationPoints.forEach((point, index) => {
        const canvasPoint = toCanvasCoordinates(point);
        context.fillStyle = '#10b981';
        context.beginPath();
        context.arc(canvasPoint.x, canvasPoint.y, 5, 0, 2 * Math.PI);
        context.fill();
        context.strokeStyle = 'white';
        context.lineWidth = 2;
        context.stroke();
        
        // Draw label
        context.fillStyle = '#10b981';
        context.font = 'bold 12px sans-serif';
        context.fillText(`P${index + 1}`, canvasPoint.x + 8, canvasPoint.y - 8);
      });
      
      // Draw line between saved calibration points
      context.strokeStyle = '#10b981';
      context.lineWidth = 2;
      context.setLineDash([5, 5]);
      context.beginPath();
      const sp0 = toCanvasCoordinates(savedCalibrationPoints[0]);
      const sp1 = toCanvasCoordinates(savedCalibrationPoints[1]);
      context.moveTo(sp0.x, sp0.y);
      context.lineTo(sp1.x, sp1.y);
      context.stroke();
      context.setLineDash([]);
    }

    // Draw current path
    if (points.length > 0) {
      context.strokeStyle = '#2563eb';
      context.lineWidth = 2;
      context.beginPath();
      const p0 = toCanvasCoordinates(points[0]);
      context.moveTo(p0.x, p0.y);
      
      for (let i = 1; i < points.length; i++) {
        const p = toCanvasCoordinates(points[i]);
        context.lineTo(p.x, p.y);
      }
      context.stroke();

      // Draw points
      points.forEach((point, index) => {
        const canvasPoint = toCanvasCoordinates(point);
        context.fillStyle = index === points.length - 1 ? '#dc2626' : '#2563eb';
        context.beginPath();
        context.arc(canvasPoint.x, canvasPoint.y, 4, 0, 2 * Math.PI);
        context.fill();
        context.strokeStyle = 'white';
        context.lineWidth = 1;
        context.stroke();
      });
    }

    // Draw markers
    if (markers.length > 0) {
      console.log('Rendering', markers.length, 'markers at scale', viewportScaleRef.current);
      if (markers[0]) console.log('First marker PDF coords:', { x: markers[0].x, y: markers[0].y });
      markers.forEach((marker, idx) => {
        const canvasCoords = toCanvasCoordinates({ x: marker.x, y: marker.y });
        if (idx === 0) console.log('  -> Canvas coords:', canvasCoords);
        const displayMarker = {
          ...marker,
          ...canvasCoords
        };
        drawMarker(displayMarker);
      });
    }

    // Draw marker links (arrows)
    if (markerLinks.length > 0) {
      markerLinks.forEach((link) => {
        const fromMarker = markers.find((m) => m.id === link.markerId);
        if (fromMarker) {
          const displayFrom = toCanvasCoordinates({ x: fromMarker.x, y: fromMarker.y });
          const displayTo = toCanvasCoordinates(link.to);
          drawArrow(displayFrom, displayTo);
        }
      });
    }

    // Highlight assigning marker
    if (assignMode && assigningFrom) {
      const m = markers.find((mk) => mk.id === assigningFrom);
      if (m) {
        const displayM = toCanvasCoordinates({ x: m.x, y: m.y });
        context.strokeStyle = '#ef4444';
        context.lineWidth = 3;
        context.beginPath();
        context.arc(displayM.x, displayM.y, selectionRadius + 4, 0, 2 * Math.PI);
        context.stroke();
      }
    }

    // Draw conduits
    if (conduits && conduits.length > 0) {
      conduits.forEach((conduit) => {
        const fromMarker = markers.find((m) => m.id === conduit.terminalId);
        const toMarker = markers.find((m) => m.id === conduit.dropPedId);
        if (fromMarker && toMarker) {
          const displayFrom = toCanvasCoordinates({ x: fromMarker.x, y: fromMarker.y });
          const displayTo = toCanvasCoordinates({ x: toMarker.x, y: toMarker.y });
          drawConduit(displayFrom, displayTo, conduit.footage);
        }
      });
    }

    // Highlight conduit starting marker
    if (conduitMode && conduitFrom) {
      const m = markers.find((mk) => mk.id === conduitFrom);
      if (m) {
        const displayM = toCanvasCoordinates({ x: m.x, y: m.y });
        context.strokeStyle = '#0ea5e9';
        context.lineWidth = 3;
        context.beginPath();
        context.arc(displayM.x, displayM.y, selectionRadius + 4, 0, 2 * Math.PI);
        context.stroke();
      }
    }
  };

  // Convert canvas coordinates (in viewport/zoomed space) to original PDF coordinates
  const toPdfCoordinates = (canvasPoint) => {
    const scale = viewportScaleRef.current;
    // Canvas is displayed at (canvas.width, canvas.height) which is (pageWidth * scale, pageHeight * scale)
    // So to convert: divide by scale to get back to page units
    return {
      x: canvasPoint.x / scale,
      y: canvasPoint.y / scale,
    };
  };

  // Convert PDF coordinates back to canvas coordinates for display
  const toCanvasCoordinates = (pdfPoint) => {
    const scale = viewportScaleRef.current;
    const result = {
      x: pdfPoint.x * scale,
      y: pdfPoint.y * scale,
    };
    // console.log('toCanvas:', pdfPoint, '* scale', scale, '=', result);
    return result;
  };

  const handleCanvasClick = (e) => {
    console.log('DrawingCanvas click detected', { calibrationMode, isActive });
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate canvas coordinates accounting for transform
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const newPoint = { x, y };
    console.log('Click - canvas coords:', newPoint, 'canvas dims:', canvas.width, 'x', canvas.height);
    console.log('Viewport scale:', viewportScaleRef.current, 'Page dims:', pageDimsRef.current);
    const pdfPoint = toPdfCoordinates(newPoint);
    console.log('Converted to PDF coords:', pdfPoint);

    // Handle calibration mode
    if (calibrationMode) {
      console.log('In calibration mode, points so far:', calibrationPoints.length);
      if (calibrationPoints.length < 2) {
        const pdfCoord = toPdfCoordinates(newPoint);
        const newCalibrationPoints = [...calibrationPoints, pdfCoord];
        setCalibrationPoints(newCalibrationPoints);
        
        // Dispatch event with the new point
        window.dispatchEvent(new CustomEvent('calibrationPoint', { detail: pdfCoord }));
        
        if (newCalibrationPoints.length === 2) {
          // Dispatch event that both points are selected
          window.dispatchEvent(new CustomEvent('calibrationPointsSelected', { detail: newCalibrationPoints }));
        }
      }
      redraw([]);
      return;
    }

    // Handle marker placement mode
    if (markerMode) {
      const pdfCoord = toPdfCoordinates(newPoint);
      onMarkerAdd?.(pdfCoord);
      redraw(currentPath);
      return;
    }

    // Handle marker erase mode
    if (erasingMarkers) {
      const pdfCoord = toPdfCoordinates(newPoint);
      onMarkerErase?.(pdfCoord);
      redraw(currentPath);
      return;
    }

    // Handle assign mode: first click selects marker, second click sets target
    if (assignMode) {
      console.log('Assign mode click, assigningFrom:', assigningFrom, 'markers:', markers);
      if (!assigningFrom) {
        // Find nearest marker within radius
        const scale = viewportScaleRef.current;
        const scaledRadius = selectionRadius / scale; // Scale radius to PDF space
        const nearest = markers
          .map((m) => ({ m, dist: Math.hypot(m.x - newPoint.x / scale, m.y - newPoint.y / scale) }))
          .sort((a, b) => a.dist - b.dist)[0];
        console.log('Nearest marker:', nearest);
        if (nearest && nearest.dist <= scaledRadius) {
          console.log('Calling onAssignStart with:', nearest.m.id);
          onAssignStart?.(nearest.m.id);
        }
      } else {
        console.log('Completing assignment to:', newPoint);
        const pdfCoord = toPdfCoordinates(newPoint);
        onAssignComplete?.(pdfCoord);
      }
      redraw(currentPath);
      return;
    }

    // Handle conduit mode: first click selects terminal, second click selects drop-ped
    if (conduitMode) {
      if (!conduitFrom) {
        // First click: find and select a terminal marker
        const scale = viewportScaleRef.current;
        const scaledRadius = selectionRadius / scale;
        const nearest = markers
          .filter((m) => m.type === 'terminal')
          .map((m) => ({ m, dist: Math.hypot(m.x - newPoint.x / scale, m.y - newPoint.y / scale) }))
          .sort((a, b) => a.dist - b.dist)[0];
        console.log('Nearest terminal for conduit:', nearest);
        if (nearest && nearest.dist <= scaledRadius) {
          console.log('Starting conduit from terminal:', nearest.m.id);
          onConduitStart?.(nearest.m.id);
        }
      } else {
        // Second click: find and select a drop-ped marker
        const scale = viewportScaleRef.current;
        const scaledRadius = selectionRadius / scale;
        const nearest = markers
          .filter((m) => m.type === 'dropPed')
          .map((m) => ({ m, dist: Math.hypot(m.x - newPoint.x / scale, m.y - newPoint.y / scale) }))
          .sort((a, b) => a.dist - b.dist)[0];
        console.log('Nearest drop-ped for conduit:', nearest);
        if (nearest && nearest.dist <= scaledRadius) {
          console.log('Completing conduit to drop-ped:', nearest.m.id);
          // Calculate distance between the two markers in PDF coordinates
          const fromMarker = markers.find((m) => m.id === conduitFrom);
          if (fromMarker) {
            const pdfDistance = Math.hypot(nearest.m.x - fromMarker.x, nearest.m.y - fromMarker.y);
            const footage = scaleFactor ? pdfDistance * scaleFactor : pdfDistance;
            onConduitComplete?.(nearest.m.id, footage);
          }
        }
      }
      redraw(currentPath);
      return;
    }

    // Handle drawing mode
    if (!isActive) return;

    const pdfCoord = toPdfCoordinates(newPoint);
    const newPath = [...currentPath, pdfCoord];
    setCurrentPath(newPath);
    pointsRef.current = newPath;

    redraw(newPath);
    onPointAdded?.(pdfCoord);
    onPathChange?.(newPath);
  };

  const handleCanvasDoubleClick = () => {
    if (currentPath.length >= 2) {
      // Path completed - emit event or callback
      const finalPath = [...currentPath];
      setCurrentPath([]);
      pointsRef.current = [];
      redraw([]);
      
      // Notify parent that path is complete
      onPathComplete?.(finalPath);
      window.dispatchEvent(new CustomEvent('pathComplete', { detail: finalPath }));
    }
  };

  const handleKeyDown = (e) => {
    if (!isActive && !calibrationMode && !markerMode && !assignMode && !erasingMarkers && !conduitMode) return;

    if (e.key === 'Enter' && currentPath.length >= 2) {
      handleCanvasDoubleClick();
    } else if ((e.key === 'Backspace' || e.key === 'Delete') && isActive && currentPath.length > 0) {
      // Undo last point
      e.preventDefault();
      const newPath = currentPath.slice(0, -1);
      setCurrentPath(newPath);
      pointsRef.current = newPath;
      redraw(newPath);
      onPathChange?.(newPath);
      onUndo?.();
    } else if (e.key === 'Escape') {
      if (calibrationMode) {
        setCalibrationPoints([]);
        setCalibrationMode(false);
      }
      if (isActive) {
        setCurrentPath([]);
        pointsRef.current = [];
        redraw([]);
        onPathChange?.([]);
        onClear?.();
      }
      if (markerMode) {
        redraw(currentPath);
      }
      if (assignMode) {
        onAssignStart?.(null);
        redraw(currentPath);
      }
      if (conduitMode) {
        onConduitStart?.(null);
        redraw(currentPath);
      }
      if (erasingMarkers) {
        redraw(currentPath);
      }
    }
  };

  useEffect(() => {
    const handleStartCalibration = () => {
      setCalibrationMode(true);
      setCalibrationPoints([]);
      setCurrentPath([]);
      // Ensure the overlay is ready for clicks immediately
      if (canvasRef.current) {
        canvasRef.current.style.pointerEvents = 'auto';
      }
      redraw([]);
    };

    const handleCalibrationSaved = () => {
      setCalibrationMode(false);
      setCalibrationPoints([]);
    };

    const handleCancelCalibration = () => {
      setCalibrationMode(false);
      setCalibrationPoints([]);
      redraw([]);
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

  // Redraw when calibration points change
  useEffect(() => {
    if (calibrationMode && calibrationPoints.length > 0) {
      redraw([]);
    }
  }, [calibrationPoints]);

  // Redraw when saved calibration points change
  useEffect(() => {
    if (savedCalibrationPoints.length > 0) {
      redraw([]);
    }
  }, [savedCalibrationPoints]);

  // Redraw when markers change
  useEffect(() => {
    if (markers.length >= 0) {
      redraw(pointsRef.current);
    }
  }, [markers]);

  // Redraw when marker links change
  useEffect(() => {
    redraw(pointsRef.current);
  }, [markerLinks]);

  // Redraw when conduits change
  useEffect(() => {
    redraw(pointsRef.current);
  }, [conduits]);

  // Redraw when polylines change
  useEffect(() => {
    redraw(pointsRef.current);
  }, [polylines]);

  // Log assigningFrom changes
  useEffect(() => {
    console.log('DrawingCanvas assigningFrom changed to:', assigningFrom);
  }, [assigningFrom]);

  // Clear current path when reset token changes
  useEffect(() => {
    if (resetToken === undefined) return;
    setCurrentPath([]);
    pointsRef.current = [];
    redraw([]);
    onPathChange?.([]);
  }, [resetToken]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('dblclick', handleCanvasDoubleClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      canvas.removeEventListener('click', handleCanvasClick);
      canvas.removeEventListener('dblclick', handleCanvasDoubleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, markerMode, erasingMarkers, currentPath, calibrationMode, calibrationPoints, assignMode, conduitMode]);

  return (
    <canvas
      ref={canvasRef}
      className="drawing-canvas"
        style={{ cursor: (calibrationMode || isActive || markerMode) ? 'crosshair' : (erasingMarkers || assignMode || conduitMode) ? 'pointer' : 'default' }}
    />
  );
}
