import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import * as geometry from "../src/layout-geometry.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("motion geometry exposes rain-drop APIs instead of orb aliases", () => {
  assert.deepEqual(
    {
      advanceRainDrop: typeof geometry.advanceRainDrop,
      advanceRainDropCollection: typeof geometry.advanceRainDropCollection,
      hasAdvanceOrb: Object.hasOwn(geometry, "advanceOrb"),
      hasAdvanceOrbCollection: Object.hasOwn(geometry, "advanceOrbCollection"),
    },
    {
      advanceRainDrop: "function",
      advanceRainDropCollection: "function",
      hasAdvanceOrb: false,
      hasAdvanceOrbCollection: false,
    },
  );
});

test("the interactive source creates rain drops rather than named animal cells", async () => {
  const [source, styles] = await Promise.all([
    read("src/main.js"),
    read("src/styles.css"),
  ]);

  assert.doesNotMatch(
    source,
    /\b(?:orbDefinitions|orbs|activeOrb|renderOrbs|hitTestOrbs|advanceOrb|advanceOrbCollection)\b/,
  );
  assert.doesNotMatch(
    source,
    /id:\s*["'](?:toad|crab|tiger|bear|wasp|fox)["']|label:\s*["'](?:Toad|Crab|Tiger|Bear|Wasp|Fox)["']/,
  );
  assert.doesNotMatch(styles, /\.rain-cell\b|\.cell-name\b/);

  assert.match(source, /\brainDrops?\b/);
  assert.match(source, /className\s*=\s*["']rain-drop["']/);
  assert.doesNotMatch(source, /ノノ/);
  assert.match(source, /createElementNS\([^)]*["']svg["']/);
  assert.match(source, /classList\.add\(["']rain-stroke-mark["']\)/);
  assert.match(source, /RAIN_STROKE_PATHS/);
  assert.match(source, /rainDropIntervalForBand\(/);
  assert.doesNotMatch(source, /circleIntervalForBand\(/);
  assert.match(styles, /\.rain-drop\b/);
  assert.match(styles, /\.rain-stroke-mark\b/);
  assert.match(styles, /fill:\s*currentColor/);
  assert.doesNotMatch(styles, /\.rain-drop::(?:before|after)/);
});

test("the custom ink marks hug the text closely", async () => {
  const source = await read("src/main.js");
  const dimensions = [...source.matchAll(
    /id:\s*["']drop-\d+["'][^}]*\bwidth:\s*(\d+)[^}]*\bheight:\s*(\d+)/g,
  )].map(([, width, height]) => ({ width: Number(width), height: Number(height) }));

  assert.ok(dimensions.length >= 8, "expected a field of interactive rain marks");
  assert.ok(dimensions.every(({ width }) => width <= 26), "expected narrow rain blockers");
  assert.ok(dimensions.every(({ height }) => height <= 16), "expected short rain blockers");
});

test("the moving rain is denser and falls decisively faster", async () => {
  const source = await read("src/main.js");
  const definitions = [...source.matchAll(
    /id:\s*["']drop-\d+["'][^}]*\bvy:\s*(-?\d+(?:\.\d+)?)/g,
  )].map(([, verticalSpeed]) => Number(verticalSpeed));

  assert.ok(
    definitions.length > 9,
    "expected more moving rain marks than the previous nine-drop composition",
  );
  assert.ok(
    definitions.every((verticalSpeed) => verticalSpeed >= 40),
    "expected every moving rain mark to fall at least 40 pixels per second",
  );
});

test("a falling mark creates a visible, disposable splash when it lands", async () => {
  const [source, styles] = await Promise.all([
    read("src/main.js"),
    read("src/styles.css"),
  ]);

  assert.match(source, /function\s+createRainSplash\s*\(/);
  assert.match(source, /className\s*=\s*["']rain-splash["']/);
  assert.match(
    source,
    /(?:animationend[^;]*(?:remove|removeChild)|(?:remove|removeChild)[^;]*animationend)/s,
  );
  assert.match(
    source,
    /\bvy\s*>\s*0[\s\S]{0,500}\bvy\s*<\s*0/,
    "expected the splash to be triggered by a downward-to-upward landing impact",
  );
  assert.match(styles, /\.rain-splash\b/);
  assert.match(styles, /@keyframes\s+rain-splash\b/);
  assert.match(
    styles,
    /\.rain-splash\s*\{(?=[^}]*animation\s*:)(?=[^}]*pointer-events\s*:\s*none)[^}]*\}/s,
  );
});

test("keyboard shortcuts preserve native activation for interactive controls", async () => {
  const source = await read("src/main.js");

  assert.match(source, /event\.target\.closest\([^)]+button[^)]+a\[href\][^)]+\)/s);
  assert.match(source, /if \(event\.key === ["'] ["'] && !isInteractiveTarget\)/);
});

test("the animated canvas reuses frozen stroke offsets", async () => {
  const source = await read("src/main.js");

  assert.match(source, /RAIN_STROKE_SEGMENTS\.forEach/);
  assert.doesNotMatch(source, /getRainStrokeSegments\(x, y/);
});

test("the composition owns a permanent bottom rain-kanji anchor", async () => {
  const [html, styles] = await Promise.all([
    read("index.html"),
    read("src/styles.css"),
  ]);

  assert.match(
    html,
    /<[^>]+id=["']rainKanjiAnchor["'][^>]*>\s*雨\s*<\/[^>]+>/,
  );
  assert.match(html, /class=["'][^"']*\brain-kanji-anchor\b[^"']*["']/);
  assert.match(
    styles,
    /\.rain-kanji-anchor\s*\{(?=[^}]*position:\s*absolute)(?=[^}]*bottom:\s*[^;]+;)[^}]*\}/s,
  );
});
