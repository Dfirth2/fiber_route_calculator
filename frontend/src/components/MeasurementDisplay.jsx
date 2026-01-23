import React from 'react';

export default function MeasurementDisplay({ polylines, totalLength, exportLoading, onExport, projectPageCount = 1, currentPage = 1 }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Measurements</h3>
      
      {polylines.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No routes drawn yet</p>
      ) : (
        <>
          <div className="space-y-3 mb-6">
            {polylines.map((polyline, index) => (
              <div key={index} className="border border-gray-200 rounded p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">{polyline.name}</p>
                    <p className="text-xs text-gray-500">
                      {polyline.points?.length || 0} points
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-blue-600">
                      {(polyline.length_ft || 0).toFixed(2)} ft
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t-2 border-gray-300 pt-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-gray-900 font-semibold">Total Fiber Required:</p>
              <p className="text-2xl font-bold text-green-600">
                {totalLength.toFixed(2)} ft
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => onExport('csv')}
                disabled={exportLoading}
                className="button-primary flex-1 disabled:opacity-50 text-sm"
              >
                {exportLoading ? 'Exporting...' : 'Export CSV'}
              </button>
              <button
                onClick={() => onExport('json')}
                disabled={exportLoading}
                className="button-primary flex-1 disabled:opacity-50 text-sm"
              >
                {exportLoading ? 'Exporting...' : 'Export JSON'}
              </button>
              <button
                onClick={() => onExport('pdf')}
                disabled={exportLoading}
                className="button-primary flex-1 disabled:opacity-50 text-sm"
                title={`Export annotated PDF of page ${currentPage}`}
              >
                {exportLoading ? 'Exporting...' : '📄 Export PDF'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
