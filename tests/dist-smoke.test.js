import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { STORY_PARAGRAPHS } from "../src/story.js";

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
  assert.match(html, /Movement 1 of 2/);
  assert.doesNotMatch(html, /(?:three|eight) movements|Previous chapter|Next chapter/i);
  assert.doesNotMatch(html, /ノノ/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /id="skipToStory"/);
  assert.doesNotMatch(html, /<article[^>]+role="dialog"/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/);
  assert.ok(jsFiles.length >= 1, "expected a bundled JavaScript asset");
  assert.ok(cssFiles.length >= 1, "expected a bundled CSS asset");

  for (const asset of [...jsFiles, ...cssFiles]) {
    await stat(new URL(`../dist/${asset.slice(2)}`, import.meta.url));
  }
  await stat(new URL("../dist/.nojekyll", import.meta.url));
});

test("the static artifact contains the complete story in accessible reading order", async () => {
  const html = await read("dist/index.html");
  const articleMatch = html.match(
    /<article\b(?=[^>]*\bid=["']fullStory["'])[^>]*>([\s\S]*?)<\/article>/i,
  );

  assert.ok(articleMatch, "expected a semantic #fullStory article in the static HTML");
  assert.doesNotMatch(
    articleMatch[0].slice(0, articleMatch[0].indexOf(">") + 1),
    /\baria-hidden\s*=\s*["']true["']/i,
  );

  let previousPosition = -1;
  for (const [index, paragraph] of STORY_PARAGRAPHS.entries()) {
    const position = articleMatch[1].indexOf(paragraph, previousPosition + 1);
    assert.ok(
      position > previousPosition,
      `expected supplied story paragraph ${index + 1} in static reading order`,
    );
    previousPosition = position;
  }

  assert.ok(
    (articleMatch[1].match(/<p\b/g) ?? []).length >= STORY_PARAGRAPHS.length,
    "expected each supplied paragraph to be represented by semantic paragraph markup",
  );
});

test("the built visual composition ends with the rain kanji anchor", async () => {
  const html = await read("dist/index.html");

  assert.match(
    html,
    /<[^>]+id=["']rainKanjiAnchor["'][^>]*>\s*雨\s*<\/[^>]+>/,
  );
});

test("the static reading edition remains available before JavaScript runs", async () => {
  const css = await read("dist/assets/styles.css");
  const baseRuleStart = css.indexOf(".story-article {");
  const baseRuleEnd = css.indexOf("}", baseRuleStart);

  assert.ok(baseRuleStart >= 0, "expected a base story article rule");
  assert.doesNotMatch(css.slice(baseRuleStart, baseRuleEnd + 1), /visibility:\s*hidden/);
  assert.match(css, /\.js \.story-article\s*\{[^}]*visibility:\s*hidden/s);
});

test("the hot path uses Pretext without layout-read APIs", async () => {
  const source = await read("src/main.js");

  assert.match(source, /from ["']@chenglou\/pretext["']/);
  assert.match(source, /setAttribute\("role", "dialog"\)/);
  assert.match(source, /removeAttribute\("role"\)/);
  assert.doesNotMatch(
    source,
    /getBoundingClientRect|offsetWidth|offsetHeight|getComputedStyle/,
  );
});

test("the published bundle uses custom ink strokes instead of font glyphs", async () => {
  const html = await read("dist/index.html");
  const [jsPath] = [...html.matchAll(/src="(\.\/assets\/[^\"]+\.js)"/g)].map(
    (match) => match[1],
  );
  const bundledJavaScript = await read(`dist/${jsPath.slice(2)}`);
  const bundledStyles = await read("dist/assets/styles.css");

  assert.doesNotMatch(bundledJavaScript, /ノノ/);
  assert.match(bundledJavaScript, /rain-stroke-mark/);
  assert.match(bundledStyles, /\.rain-stroke-mark/);
});
