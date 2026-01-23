import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import toast from 'react-hot-toast';

// Set worker from local public directory
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

export default function PDFViewer({ pdfFile, pdfUrl, onPageChange, onCanvasReady, overlayCanvas }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    loadPdf();
  }, [pdfFile, pdfUrl]);

  const loadPdf = async () => {
    if (!pdfFile && !pdfUrl) {
      console.log('No PDF file or URL provided');
      return;
    }
    
    setIsLoading(true);
    try {
      let pdfSource;
      if (pdfUrl) {
        console.log('Loading PDF from URL:', pdfUrl);
        // Fetch the PDF and convert to blob URL for pdf.js
        const response = await fetch(pdfUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const pdfBlob = await response.blob();
        pdfSource = URL.createObjectURL(pdfBlob);
        console.log('Created blob URL from fetch');
      } else {
        console.log('Loading PDF from file:', pdfFile);
        pdfSource = URL.createObjectURL(pdfFile);
      }
      console.log('Starting PDF document load with source:', pdfSource);
      const pdfDoc = await pdfjsLib.getDocument(pdfSource).promise;
      console.log('PDF loaded successfully, pages:', pdfDoc.numPages);
      setPdf(pdfDoc);
      setTotalPages(pdfDoc.numPages);
      setCurrentPage(1);
      await renderPage(pdfDoc, 1);
    } catch (error) {
      console.error('PDF loading error:', error);
      toast.error('Failed to load PDF: ' + (error.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const renderPage = async (pdfDoc, pageNum) => {
    if (!pdfDoc) {
      console.log('No PDF document available');
      return;
    }
    
    // Cancel previous render if it's still running
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch (e) {
        console.log('Could not cancel previous render');
      }
    }
    
    if (!canvasRef.current) {
      console.log('Canvas ref not ready, waiting...');
      // Wait a bit for the canvas to be mounted
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!canvasRef.current) {
      console.error('Canvas element not found after waiting');
      return;
    }
    
    try {
      console.log('Rendering page:', pageNum);
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: zoom });
      
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      const renderContext = {
        canvasContext: canvas.getContext('2d'),
        viewport: viewport,
      };
      
      console.log('Starting page render with viewport:', viewport.width, 'x', viewport.height);
      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      
      await renderTask.promise;
      console.log('Page rendered successfully');
      
      if (onCanvasReady) {
        onCanvasReady(canvas, viewport);
      }
    } catch (error) {
      if (error.name === 'RenderingCancelledException') {
        console.log('Render was cancelled');
      } else {
        console.error('Page rendering error:', error);
        toast.error('Failed to render page');
      }
    } finally {
      renderTaskRef.current = null;
    }
  };

  useEffect(() => {
    if (pdf) {
      renderPage(pdf, currentPage);
      onPageChange?.(currentPage);
    }
    
    // Cleanup: cancel render if component unmounts
    return () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {
          console.log('Could not cancel render on unmount');
        }
      }
    };
  }, [currentPage, zoom]);

  const handlePageChange = (newPage) => {
    const page = Math.max(1, Math.min(newPage, totalPages));
    setCurrentPage(page);
  };

  const handleZoom = (direction) => {
    const newZoom = direction === 'in' ? zoom + 0.2 : Math.max(0.5, zoom - 0.2);
    setZoom(Math.round(newZoom * 10) / 10);
  };

  const handleMouseDown = (e) => {
    // Don't pan if clicking on the drawing canvas (when drawing or calibrating)
    const target = e.target;
    if (target && target.classList && target.classList.contains('drawing-canvas')) {
      return;
    }
    
    if (e.button !== 0) return; // Only handle left click
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    
    setPanOffset(prev => ({
      x: prev.x + dx,
      y: prev.y + dy
    }));
    
    setPanStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleRotate = (direction) => {
    setRotation(prev => {
      const newRotation = direction === 'cw' ? prev + 90 : prev - 90;
      return newRotation % 360;
    });
  };

  useEffect(() => {
    if (isPanning) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isPanning, panStart]);

  return (
    <div className="pdf-viewer flex flex-col h-full bg-gray-200">
      {/* Controls */}
      <div className="bg-white border-b border-gray-300 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
            className="button-secondary disabled:opacity-50 px-3 py-1 text-sm"
          >
            ←
          </button>
          <span className="text-sm font-medium">
            Page <input
              type="number"
              min="1"
              max={totalPages}
              value={currentPage}
              onChange={(e) => handlePageChange(parseInt(e.target.value) || 1)}
              className="input-field w-12 h-8 text-center text-sm"
              disabled={isLoading}
            /> / {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
            className="button-secondary disabled:opacity-50 px-3 py-1 text-sm"
          >
            →
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleRotate('ccw')}
            disabled={isLoading}
            className="button-secondary disabled:opacity-50 px-3 py-1 text-sm"
            title="Rotate counter-clockwise"
          >
            ↺
          </button>
          <button
            onClick={() => handleRotate('cw')}
            disabled={isLoading}
            className="button-secondary disabled:opacity-50 px-3 py-1 text-sm"
            title="Rotate clockwise"
          >
            ↻
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleZoom('out')}
            disabled={zoom <= 0.5 || isLoading}
            className="button-secondary disabled:opacity-50 px-3 py-1 text-sm"
          >
            −
          </button>
          <span className="text-sm font-medium w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => handleZoom('in')}
            disabled={zoom >= 3 || isLoading}
            className="button-secondary disabled:opacity-50 px-3 py-1 text-sm"
          >
            +
          </button>
        </div>
      </div>
      
      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-200 flex items-start justify-center p-4 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        {isLoading && (
          <div className="text-center text-gray-600 mt-4">
            <p>Loading PDF...</p>
          </div>
        )}
        {!isLoading && totalPages === 0 && (
          <div className="text-center text-red-600 mt-4">
            <p>Failed to load PDF (0 pages)</p>
          </div>
        )}
        <div
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) rotate(${rotation}deg)`,
            transition: isPanning ? 'none' : 'transform 0.1s ease-out',
            transformOrigin: 'center center',
            display: 'inline-block',
            position: 'relative'
          }}
        >
          <canvas
            ref={canvasRef}
            className="bg-white shadow-lg"
          />
          {overlayCanvas}
        </div>
      </div>
    </div>
  );
}
