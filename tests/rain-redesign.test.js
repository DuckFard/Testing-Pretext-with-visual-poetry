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
  assert.match(styles, /\.rain-drop\b/);
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
