import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { projectsAPI } from '../api';

export default function ScaleCalibration({ projectId, pageNumber, onCalibrationSuccess }) {
  const [knownDistance, setKnownDistance] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState([]);
  const [savedScaleFactor, setSavedScaleFactor] = useState(null);
  const [savedScaleLabel, setSavedScaleLabel] = useState('');

  useEffect(() => {
    const handleCalibrationPointsSelected = (event) => {
      const points = event.detail;
      setCalibrationPoints(points);
      toast.success('Two points selected. Enter the distance in feet.');
    };

    window.addEventListener('calibrationPointsSelected', handleCalibrationPointsSelected);
    return () => {
      window.removeEventListener('calibrationPointsSelected', handleCalibrationPointsSelected);
    };
  }, []);

  const handleStartTwoPointCalibration = () => {
    setCalibrationPoints([]);
    toast.success('Click two points on the plat to calibrate scale');
    window.dispatchEvent(new CustomEvent('startCalibration'));
  };

  const handleCancelCalibration = () => {
    setCalibrationPoints([]);
    toast.success('Calibration cancelled');
    window.dispatchEvent(new CustomEvent('cancelCalibration'));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!knownDistance || isNaN(knownDistance) || knownDistance <= 0) {
      toast.error('Enter a valid distance in feet');
      return;
    }
    if (calibrationPoints.length !== 2) {
      toast.error('Select exactly two points');
      return;
    }

    setIsLoading(true);
    let computedScaleFactor = null;
    try {
      const dx = calibrationPoints[1].x - calibrationPoints[0].x;
      const dy = calibrationPoints[1].y - calibrationPoints[0].y;
      const distancePdfUnits = Math.sqrt(dx * dx + dy * dy);
      computedScaleFactor = parseFloat(knownDistance) / distancePdfUnits;

      const calibrationData = {
        method: 'two_point',
        page_number: pageNumber,
        scale_factor: computedScaleFactor,
        point_a: calibrationPoints[0],
        point_b: calibrationPoints[1],
        known_distance_ft: parseFloat(knownDistance),
      };

      await projectsAPI.createCalibration(projectId, calibrationData);

      toast.success('Scale calibration saved');
      setSavedScaleFactor(computedScaleFactor);
      setSavedScaleLabel(`${knownDistance} ft between points → ${computedScaleFactor.toFixed(6)} ft per PDF unit`);

      window.dispatchEvent(new CustomEvent('calibrationSaved', { detail: { points: calibrationPoints, scaleFactor: computedScaleFactor } }));

      setCalibrationPoints([]);
      setKnownDistance('');
      onCalibrationSuccess?.({ points: calibrationPoints, scaleFactor: computedScaleFactor });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save calibration');
    } finally {
      if (computedScaleFactor !== null) {
        onCalibrationSuccess?.({ points: calibrationPoints, scaleFactor: computedScaleFactor });
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Scale Calibration (Two-Point)</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleStartTwoPointCalibration}
              disabled={isLoading || (!!savedScaleFactor && calibrationPoints.length === 0)}
              className="button-secondary flex-1 disabled:opacity-50"
            >
              Click to Select Two Points
            </button>
            {calibrationPoints.length > 0 && (
              <button
                type="button"
                onClick={handleCancelCalibration}
                className="px-3 py-2 rounded bg-gray-300 text-gray-700 hover:bg-gray-400"
              >
                Cancel
              </button>
            )}
          </div>
          {calibrationPoints.length > 0 && (
            <p className="text-sm text-gray-600 mt-2">
              {calibrationPoints.length} point{calibrationPoints.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {calibrationPoints.length === 2 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Distance Between Points (feet) *
            </label>
            <input
              type="number"
              step="0.01"
              value={knownDistance}
              onChange={(e) => setKnownDistance(e.target.value)}
              placeholder="e.g., 200"
              className="input-field w-full"
              disabled={isLoading}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || calibrationPoints.length !== 2 || !knownDistance}
          className="button-primary w-full disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Save Calibration'}
        </button>

        {savedScaleFactor && (
          <p className="text-sm text-gray-700 mt-2">Scale: {savedScaleLabel || `${savedScaleFactor.toFixed(6)} ft per PDF unit`}</p>
        )}
      </form>

      {savedScaleFactor && (
        <div className="mt-4 p-3 bg-gray-100 rounded border border-gray-200 text-sm text-gray-800">
          Saved Scale: {savedScaleLabel || `${savedScaleFactor.toFixed(6)} ft per PDF unit`}
        </div>
      )}
    </div>
  );
}
