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

test("the canvas carries a denser field of non-blocking rain marks", async () => {
  const source = await read("src/main.js");
  const grid = source.match(/createRainMarks\(\s*(\d+)\s*,\s*(\d+)\s*\)/);

  assert.ok(grid, "expected a deterministic rain-mark grid");
  const [, columns, rows] = grid.map(Number);
  assert.ok(
    columns * rows >= 1_400,
    `expected at least 1,400 decorative marks, received ${columns * rows}`,
  );
});

test("rendered rain marks stay materially smaller than the surrounding type", async () => {
  const [source, styles] = await Promise.all([
    read("src/main.js"),
    read("src/styles.css"),
  ]);
  const dimensions = [...source.matchAll(
    /id:\s*["']drop-\d+["'][^}]*\bwidth:\s*(\d+)[^}]*\bheight:\s*(\d+)/g,
  )].map(([, width, height]) => ({ width: Number(width), height: Number(height) }));
  const markRule = styles.match(/\.rain-stroke-mark\s*\{([^}]*)\}/s)?.[1] ?? "";
  const renderedWidth = Number(markRule.match(/\bwidth:\s*(\d+)px/)?.[1]);
  const renderedHeight = Number(markRule.match(/\bheight:\s*(\d+)px/)?.[1]);

  assert.ok(dimensions.every(({ width }) => width <= 20), "expected compact blocker widths");
  assert.ok(dimensions.every(({ height }) => height <= 14), "expected compact blocker heights");
  assert.ok(renderedWidth <= 18, `expected an SVG width no larger than 18px, received ${renderedWidth}px`);
  assert.ok(renderedHeight <= 14, `expected an SVG height no larger than 14px, received ${renderedHeight}px`);
});

test("the live composition applies whitespace-biased rain placement", async () => {
  const [source, styles] = await Promise.all([
    read("src/main.js"),
    read("src/styles.css"),
  ]);

  assert.match(source, /chooseWhitespaceBiasedX\(/);
  assert.match(
    source,
    /lines\.push\(\{[^}]*right:\s*Math\.round\(slot\.right\)/s,
    "line geometry should retain trailing whitespace for rain placement",
  );
  assert.doesNotMatch(
    source,
    /layoutRegion\(currentPreparedBody, cursor, region, rainDrops,/,
    "moving marks should not continuously recompose the prose",
  );
  assert.match(styles, /\.body-line\s*\{(?=[^}]*z-index:\s*2)[^}]*\}/s);
  assert.match(styles, /\.rain-drop\s*\{(?=[^}]*z-index:\s*1)[^}]*\}/s);
});

test("dragging a non-blocking rain mark avoids a full prose reflow", async () => {
  const source = await read("src/main.js");
  const pointerMoveHandler = source.match(
    /stage\.addEventListener\(["']pointermove["'],\s*\(event\)\s*=>\s*\{.*?\n\}\);/s,
  )?.[0] ?? "";

  assert.match(pointerMoveHandler, /activeRainDrop\.x\s*=/);
  assert.doesNotMatch(pointerMoveHandler, /needsRender\s*=\s*true/);
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
