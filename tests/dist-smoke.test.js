import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the GitHub Pages artifact contains the finished editorial experience", async () => {
  const html = await read("dist/index.html");
  const jsFiles = [...html.matchAll(/src="(\.\/assets\/[^"]+\.js)"/g)].map((match) => match[1]);
  const cssFiles = [...html.matchAll(/href="(\.\/assets\/[^"]+\.css)"/g)].map((match) => match[1]);

  assert.match(html, /When Toad Called for Rain/);
  assert.match(html, /<main/);
  assert.match(html, /<article[^>]+id="fullStory"/);
  assert.match(html, /aria-hidden="true"[^>]+id="stage"|id="stage"[^>]+aria-hidden="true"/);
  assert.match(html, /id="pauseMotion"[^>]+aria-pressed="false"/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /id="skipToStory"/);
  assert.match(html, /role="dialog"/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/);
  assert.ok(jsFiles.length >= 1, "expected a bundled JavaScript asset");
  assert.ok(cssFiles.length >= 1, "expected a bundled CSS asset");

  for (const asset of [...jsFiles, ...cssFiles]) {
    await stat(new URL(`../dist/${asset.slice(2)}`, import.meta.url));
  }
  await stat(new URL("../dist/.nojekyll", import.meta.url));
});

test("the hot path uses Pretext without layout-read APIs", async () => {
  const source = await read("src/main.js");

  assert.match(source, /from ["']@chenglou\/pretext["']/);
  assert.doesNotMatch(
    source,
    /getBoundingClientRect|offsetWidth|offsetHeight|getComputedStyle/,
  );
});
