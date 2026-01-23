export const markerStyles = {
  terminal: {
    fill: '#10b981',
    stroke: '#ffffff',
    shape: 'triangle',
    size: 15,
  },
  dropPed: {
    fill: '#a855f7',
    stroke: '#ffffff',
    shape: 'circle',
    size: 12,
  },
};

export function getMarkerStyle(type) {
  return markerStyles[type] || null;
}

export function computeTrianglePoints({ x, y }, size) {
  const height = size * Math.sqrt(3) / 2;
  return [
    { x, y: y - height }, // top vertex
    { x: x - size / 2, y: y + height / 2 },
    { x: x + size / 2, y: y + height / 2 },
  ];
}
