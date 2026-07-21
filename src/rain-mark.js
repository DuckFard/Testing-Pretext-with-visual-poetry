export const RAIN_STROKE_PATHS = Object.freeze([
  "M2 1.2 C3 1.8 4.5 3.8 5 5.4 C4 5 2.5 3.2 2 1.2Z",
  "M10 1.2 C11 1.8 12.5 3.8 13 5.4 C12 5 10.5 3.2 10 1.2Z",
  "M4.5 8.2 C5.5 8.8 7 10.8 7.5 12.4 C6.5 12 5 10.2 4.5 8.2Z",
  "M12.5 8.2 C13.5 8.8 15 10.8 15.5 12.4 C14.5 12 13 10.2 12.5 8.2Z",
]);

export const RAIN_STROKE_SEGMENTS = Object.freeze([
  Object.freeze({ x1: -4, y1: -6, x2: -1.6, y2: -2.6 }),
  Object.freeze({ x1: 4, y1: -6, x2: 6.4, y2: -2.6 }),
  Object.freeze({ x1: -1.5, y1: 2, x2: 0.9, y2: 5.4 }),
  Object.freeze({ x1: 6.5, y1: 2, x2: 8.9, y2: 5.4 }),
]);

export function getRainStrokeSegments(centerX, centerY, scale = 1) {
  return RAIN_STROKE_SEGMENTS.map((segment) => ({
    x1: centerX + segment.x1 * scale,
    y1: centerY + segment.y1 * scale,
    x2: centerX + segment.x2 * scale,
    y2: centerY + segment.y2 * scale,
  }));
}
