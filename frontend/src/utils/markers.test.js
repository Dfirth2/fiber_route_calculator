import { describe, it, expect } from 'vitest';
import { markerStyles, getMarkerStyle, computeTrianglePoints } from './markers';

describe('marker utilities', () => {
  it('returns styles for known marker types', () => {
    expect(getMarkerStyle('terminal')).toEqual(markerStyles.terminal);
    expect(getMarkerStyle('dropPed')).toEqual(markerStyles.dropPed);
  });

  it('returns null for unknown marker types', () => {
    expect(getMarkerStyle('unknown')).toBeNull();
  });

  it('computes triangle vertices relative to center', () => {
    const points = computeTrianglePoints({ x: 10, y: 20 }, 10);
    const height = 10 * Math.sqrt(3) / 2;
    expect(points).toEqual([
      { x: 10, y: 20 - height },
      { x: 10 - 5, y: 20 + height / 2 },
      { x: 10 + 5, y: 20 + height / 2 },
    ]);
  });
});
