import test from "node:test";
import assert from "node:assert/strict";

import {
  CHAPTERS,
  STORY_PARAGRAPHS,
  getChapter,
  getChapterIndex,
} from "../src/story.js";

test("the supplied story remains complete and in order", () => {
  assert.equal(STORY_PARAGRAPHS.length, 24);
  assert.match(STORY_PARAGRAPHS[0], /^Once upon a time, the toad/);
  assert.match(STORY_PARAGRAPHS[23], /children’s rhymes:$/);
  assert.equal(
    CHAPTERS.flatMap((chapter) => chapter.paragraphs).join("\n\n"),
    STORY_PARAGRAPHS.join("\n\n"),
  );
});

test("two full-page movements carry the complete story into rain", () => {
  assert.equal(CHAPTERS.length, 2);
  assert.deepEqual(
    CHAPTERS.map((chapter) => chapter.paragraphs.length),
    [12, 12],
  );
  assert.deepEqual(CHAPTERS[0].companions, ["toad"]);
  assert.ok(CHAPTERS.some((chapter) => chapter.companions.includes("crab")));
  assert.ok(CHAPTERS.some((chapter) => chapter.companions.includes("tiger")));
  assert.equal(CHAPTERS.at(-1).rainLevel, 1);
  assert.equal(CHAPTERS.at(-1).kanji, "雨");
});

test("chapter navigation clamps and wraps intentionally", () => {
  assert.equal(getChapterIndex(-1, CHAPTERS.length), 0);
  assert.equal(getChapterIndex(CHAPTERS.length + 2, CHAPTERS.length), CHAPTERS.length - 1);
  assert.equal(getChapter(0), CHAPTERS[0]);
  assert.equal(getChapter(999), CHAPTERS.at(-1));
});
