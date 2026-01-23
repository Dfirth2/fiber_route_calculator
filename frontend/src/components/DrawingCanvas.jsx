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
  savedCalibrationPoints = [],
  resetToken,
}) {
  const canvasRef = useRef(null);
  const pointsRef = useRef([]);
  const contextRef = useRef(null);
  const [currentPath, setCurrentPath] = React.useState([]);
  const [calibrationMode, setCalibrationMode] = React.useState(false);
  const [calibrationPoints, setCalibrationPoints] = React.useState([]);

  useEffect(() => {
    if (!pdfCanvas || !canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = pdfCanvas.width;
    canvas.height = pdfCanvas.height;
    
    // Position the canvas to overlay the PDF canvas exactly (they're siblings in the same transformed div)
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    // Only capture mouse events when drawing or calibrating; otherwise let panning work
    canvas.style.pointerEvents = (calibrationMode || isActive) ? 'auto' : 'none';

    const context = canvas.getContext('2d');
    contextRef.current = context;

    // Only capture mouse events when drawing or calibrating; otherwise let panning work
    canvas.style.pointerEvents = (calibrationMode || isActive) ? 'auto' : 'none';

    // Copy PDF canvas content
    context.drawImage(pdfCanvas, 0, 0);
  }, [pdfCanvas]);

    // Keep pointer events synced with modes so panning works when idle
    useEffect(() => {
      if (!canvasRef.current) return;
      canvasRef.current.style.pointerEvents = (calibrationMode || isActive) ? 'auto' : 'none';
    }, [calibrationMode, isActive]);
  const redraw = (points) => {
    if (!contextRef.current || !pdfCanvas) return;

    const canvas = canvasRef.current;
    const context = contextRef.current;

    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redraw PDF
    context.drawImage(pdfCanvas, 0, 0);

    // Draw calibration points if in calibration mode
    if (calibrationMode && calibrationPoints.length > 0) {
      calibrationPoints.forEach((point, index) => {
        context.fillStyle = '#10b981';
        context.beginPath();
        context.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        context.fill();
        context.strokeStyle = 'white';
        context.lineWidth = 2;
        context.stroke();
        
        // Draw label
        context.fillStyle = '#10b981';
        context.font = 'bold 12px sans-serif';
        context.fillText(`P${index + 1}`, point.x + 8, point.y - 8);
      });
      
      // Draw line between calibration points
      if (calibrationPoints.length === 2) {
        context.strokeStyle = '#10b981';
        context.lineWidth = 2;
        context.setLineDash([5, 5]);
        context.beginPath();
        context.moveTo(calibrationPoints[0].x, calibrationPoints[0].y);
        context.lineTo(calibrationPoints[1].x, calibrationPoints[1].y);
        context.stroke();
        context.setLineDash([]);
      }
      return;
    }

    // Draw saved calibration points (when not actively calibrating)
    if (!calibrationMode && savedCalibrationPoints.length === 2) {
      savedCalibrationPoints.forEach((point, index) => {
        context.fillStyle = '#10b981';
        context.beginPath();
        context.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        context.fill();
        context.strokeStyle = 'white';
        context.lineWidth = 2;
        context.stroke();
        
        // Draw label
        context.fillStyle = '#10b981';
        context.font = 'bold 12px sans-serif';
        context.fillText(`P${index + 1}`, point.x + 8, point.y - 8);
      });
      
      // Draw line between saved calibration points
      context.strokeStyle = '#10b981';
      context.lineWidth = 2;
      context.setLineDash([5, 5]);
      context.beginPath();
      context.moveTo(savedCalibrationPoints[0].x, savedCalibrationPoints[0].y);
      context.lineTo(savedCalibrationPoints[1].x, savedCalibrationPoints[1].y);
      context.stroke();
      context.setLineDash([]);
    }

    // Draw current path
    if (points.length > 0) {
      context.strokeStyle = '#2563eb';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      
      for (let i = 1; i < points.length; i++) {
        context.lineTo(points[i].x, points[i].y);
      }
      context.stroke();

      // Draw points
      points.forEach((point, index) => {
        context.fillStyle = index === points.length - 1 ? '#dc2626' : '#2563eb';
        context.beginPath();
        context.arc(point.x, point.y, 4, 0, 2 * Math.PI);
        context.fill();
        context.strokeStyle = 'white';
        context.lineWidth = 1;
        context.stroke();
      });
    }
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
    console.log('Click point:', newPoint);

    // Handle calibration mode
    if (calibrationMode) {
      console.log('In calibration mode, points so far:', calibrationPoints.length);
      if (calibrationPoints.length < 2) {
        const newCalibrationPoints = [...calibrationPoints, newPoint];
        setCalibrationPoints(newCalibrationPoints);
        
        // Dispatch event with the new point
        window.dispatchEvent(new CustomEvent('calibrationPoint', { detail: newPoint }));
        
        if (newCalibrationPoints.length === 2) {
          // Dispatch event that both points are selected
          window.dispatchEvent(new CustomEvent('calibrationPointsSelected', { detail: newCalibrationPoints }));
        }
      }
      redraw([]);
      return;
    }

    // Handle drawing mode
    if (!isActive) return;

    const newPath = [...currentPath, newPoint];
    setCurrentPath(newPath);
    pointsRef.current = newPath;

    redraw(newPath);
    onPointAdded?.(newPoint);
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
    if (!isActive && !calibrationMode) return;

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
  }, [isActive, currentPath, calibrationMode, calibrationPoints]);

  return (
    <canvas
      ref={canvasRef}
      className="drawing-canvas"
      style={{ cursor: calibrationMode || isActive ? 'crosshair' : 'default' }}
    />
  );
}
