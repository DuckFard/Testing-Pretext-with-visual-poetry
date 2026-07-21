import test from "node:test";
import assert from "node:assert/strict";

import {
  RAIN_STROKE_PATHS,
  getRainStrokeSegments,
} from "../src/rain-mark.js";

test("the moving rain mark is four custom tapered strokes, not a text glyph", () => {
  assert.equal(RAIN_STROKE_PATHS.length, 4);
  assert.ok(RAIN_STROKE_PATHS.every((path) => /^M[\d. -]+C/.test(path)));
  assert.ok(RAIN_STROKE_PATHS.every((path) => path.endsWith("Z")));
});

test("the canvas field repeats the same two-column, two-row stroke rhythm", () => {
  assert.deepEqual(getRainStrokeSegments(100, 200, 1), [
    { x1: 96, y1: 194, x2: 98.4, y2: 197.4 },
    { x1: 104, y1: 194, x2: 106.4, y2: 197.4 },
    { x1: 98.5, y1: 202, x2: 100.9, y2: 205.4 },
    { x1: 106.5, y1: 202, x2: 108.9, y2: 205.4 },
  ]);
});
