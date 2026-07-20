import {
  layout,
  layoutNextLine,
  layoutWithLines,
  prepareWithSegments,
  walkLineRanges,
} from "@chenglou/pretext";

import {
  advanceOrbCollection,
  carveTextLineSlots,
  circleIntervalForBand,
  getColumnCount,
} from "./layout-geometry.js";
import { CHAPTERS, STORY_PARAGRAPHS, getChapterIndex } from "./story.js";

const BODY_FONT_FAMILY = '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif';
const HEADLINE_FONT_FAMILY = 'Arial, Helvetica, sans-serif';
const BODY_FONT = `16px ${BODY_FONT_FAMILY}`;
const BODY_LINE_HEIGHT = 25;
const PULLQUOTE_FONT = `italic 18px ${BODY_FONT_FAMILY}`;
const PULLQUOTE_LINE_HEIGHT = 25;
const COLUMN_GAP = 30;
const ROW_GAP = 62;
const MAX_LAYOUT_ROWS = 12;

const stage = document.querySelector("#stage");
const rainCanvas = document.querySelector("#rainField");
const rainContext = rainCanvas.getContext("2d", { alpha: true });
const headlineLayer = document.querySelector("#headlineLayer");
const bodyLayer = document.querySelector("#bodyLayer");
const pullquoteLayer = document.querySelector("#pullquoteLayer");
const pullquoteRule = document.querySelector("#pullquoteRule");
const kanjiCoda = document.querySelector("#kanjiCoda");
const chapterEyebrow = document.querySelector("#chapterEyebrow");
const chapterLabel = document.querySelector("#chapterLabel");
const chapterTitle = document.querySelector("#chapterTitle");
const previousChapter = document.querySelector("#previousChapter");
const nextChapter = document.querySelector("#nextChapter");
const pauseMotion = document.querySelector("#pauseMotion");
const motionLabel = document.querySelector("#motionLabel");
const readingMode = document.querySelector("#readingMode");
const closeReadingMode = document.querySelector("#closeReadingMode");
const storyBody = document.querySelector("#storyBody");
const statLines = document.querySelector("#statLines");
const statReflow = document.querySelector("#statReflow");
const statFps = document.querySelector("#statFps");
const statColumns = document.querySelector("#statColumns");
const fullStory = document.querySelector("#fullStory");
const masthead = document.querySelector(".masthead");
const visualEdition = document.querySelector(".visual-edition");
const motionControl = document.querySelector(".motion-control");
const skipToStory = document.querySelector("#skipToStory");

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const viewport = {
  width: window.innerWidth,
  height: window.innerHeight,
  dpr: Math.min(window.devicePixelRatio || 1, 2),
};

let currentChapterIndex = 0;
let currentPreparedBody;
let currentPreparedPullquote;
let motionHeld = reducedMotionQuery.matches;
let stageHeight = viewport.height;
let bodyTop = 250;
let firstRowBottom = viewport.height - 110;
let lastFrameTime = performance.now();
let animationFrame = null;
let needsRender = true;
let cachedHeadline = { key: "", size: 0, lineHeight: 0, lines: [] };
let activeOrb = null;
let readingReturnFocus = null;
let pointerX = -10_000;
let pointerY = -10_000;
let rainPhase = 0;
const frameTimes = [];

const headlinePool = [];
const bodyLinePool = [];
const pullquotePool = [];

const orbDefinitions = [
  { id: "toad", label: "Toad", fx: 0.54, fy: 0.31, r: 72, vx: 17, vy: 12, color: "#68546d" },
  { id: "crab", label: "Crab", fx: 0.18, fy: 0.52, r: 58, vx: -13, vy: 18, color: "#8a6a3f" },
  { id: "tiger", label: "Tiger", fx: 0.78, fy: 0.56, r: 69, vx: 11, vy: -16, color: "#71664f" },
  { id: "bear", label: "Bear", fx: 0.39, fy: 0.7, r: 64, vx: -18, vy: -9, color: "#526257" },
  { id: "wasp", label: "Wasp", fx: 0.87, fy: 0.28, r: 49, vx: -10, vy: 15, color: "#8f7b42" },
  { id: "fox", label: "Fox", fx: 0.28, fy: 0.36, r: 56, vx: 15, vy: -12, color: "#7b5945" },
];

let orbs = orbDefinitions.map((definition) => {
  const element = document.createElement("div");
  element.className = "rain-cell";
  element.dataset.character = definition.id;
  element.style.setProperty("--cell-color", definition.color);
  const label = document.createElement("span");
  label.className = "cell-name";
  label.textContent = definition.label;
  element.appendChild(label);
  stage.appendChild(element);

  return {
    ...definition,
    x: definition.fx * viewport.width,
    y: Math.max(300, definition.fy * viewport.height),
    paused: false,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartOrbX: 0,
    dragStartOrbY: 0,
    element,
  };
});

const rainMarks = createRainMarks(48, 42);

function createRainMarks(columns, rows) {
  let seed = 1_966;
  const random = () => {
    seed = (seed * 16_807) % 2_147_483_647;
    return (seed - 1) / 2_147_483_646;
  };

  return Array.from({ length: columns * rows }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    return {
      x: (column + 0.5 + (random() - 0.5) * 0.18) / columns,
      y: (row + 0.5 + (random() - 0.5) * 0.14) / rows,
      reveal: random(),
      phase: random() * Math.PI * 2,
      length: 3.2 + random() * 2.6,
      weight: 0.55 + random() * 0.55,
    };
  });
}

function syncPool(pool, count, className, parent) {
  while (pool.length < count) {
    const element = document.createElement("div");
    element.className = className;
    parent.appendChild(element);
    pool.push(element);
  }

  pool.forEach((element, index) => {
    element.hidden = index >= count;
  });
}

function fitHeadline(text, maxWidth, maxHeight) {
  const key = `${text}:${Math.round(maxWidth)}:${Math.round(maxHeight)}`;
  if (cachedHeadline.key === key) return cachedHeadline;

  let low = viewport.width < 640 ? 30 : 38;
  let high = viewport.width < 640 ? 62 : 104;
  let bestSize = low;
  let bestLineHeight = Math.round(low * 0.88);
  let bestLines = [];

  while (low <= high) {
    const size = Math.floor((low + high) / 2);
    const font = `800 ${size}px ${HEADLINE_FONT_FAMILY}`;
    const lineHeight = Math.round(size * 0.88);
    const prepared = prepareWithSegments(text, font);
    let breaksWord = false;
    let lineCount = 0;

    walkLineRanges(prepared, maxWidth, (line) => {
      lineCount += 1;
      if (line.end.graphemeIndex !== 0) breaksWord = true;
    });

    if (!breaksWord && lineCount * lineHeight <= maxHeight) {
      const result = layoutWithLines(prepared, maxWidth, lineHeight);
      bestSize = size;
      bestLineHeight = lineHeight;
      bestLines = result.lines;
      low = size + 1;
    } else {
      high = size - 1;
    }
  }

  cachedHeadline = {
    key,
    size: bestSize,
    lineHeight: bestLineHeight,
    lines: bestLines,
  };
  return cachedHeadline;
}

function layoutColumn(
  prepared,
  startCursor,
  region,
  circleObstacles,
  rectangleObstacles,
) {
  let cursor = startCursor;
  let lineTop = region.y;
  const lines = [];
  let exhausted = false;

  while (lineTop + BODY_LINE_HEIGHT <= region.y + region.height && !exhausted) {
    const bandBottom = lineTop + BODY_LINE_HEIGHT;
    const circleBlocks = circleObstacles
      .map((circle) =>
        circleIntervalForBand(
          circle.x,
          circle.y,
          circle.r,
          lineTop,
          bandBottom,
          12,
          3,
        ),
      )
      .filter(Boolean);
    const rectangleBlocks = rectangleObstacles
      .filter((rectangle) => bandBottom > rectangle.y && lineTop < rectangle.y + rectangle.height)
      .map((rectangle) => ({ left: rectangle.x, right: rectangle.x + rectangle.width }));
    const slots = carveTextLineSlots(
      { left: region.x, right: region.x + region.width },
      [...circleBlocks, ...rectangleBlocks],
    ).sort((a, b) => a.left - b.left);

    if (slots.length === 0) {
      lineTop += BODY_LINE_HEIGHT;
      continue;
    }

    for (const slot of slots) {
      const line = layoutNextLine(prepared, cursor, slot.right - slot.left);
      if (line === null) {
        exhausted = true;
        break;
      }
      lines.push({ x: Math.round(slot.left), y: Math.round(lineTop), text: line.text });
      cursor = line.end;
    }

    lineTop += BODY_LINE_HEIGHT;
  }

  return { cursor, exhausted, lines };
}

function createPullquotePlacement(chapter, contentLeft, columnWidth, rowHeight, columnCount) {
  if (viewport.width <= 640 || columnCount === 1) return null;

  const width = Math.round(columnWidth * 0.6);
  const result = layout(currentPreparedPullquote, width - 22, PULLQUOTE_LINE_HEIGHT);
  const x = contentLeft + columnWidth - width;
  const y = Math.round(bodyTop + rowHeight * 0.44);

  return {
    chapter,
    x,
    y,
    width,
    height: result.height + 18,
  };
}

function renderPullquote(placement) {
  if (!placement) {
    pullquoteRule.style.display = "none";
    syncPool(pullquotePool, 0, "pullquote-line", pullquoteLayer);
    return;
  }

  const result = layoutWithLines(
    currentPreparedPullquote,
    placement.width - 22,
    PULLQUOTE_LINE_HEIGHT,
  );
  syncPool(pullquotePool, result.lines.length, "pullquote-line", pullquoteLayer);
  pullquoteRule.style.display = "block";
  pullquoteRule.style.left = `${placement.x}px`;
  pullquoteRule.style.top = `${placement.y}px`;
  pullquoteRule.style.height = `${placement.height}px`;

  result.lines.forEach((line, index) => {
    const element = pullquotePool[index];
    element.textContent = line.text;
    element.style.left = `${placement.x + 18}px`;
    element.style.top = `${placement.y + 8 + index * PULLQUOTE_LINE_HEIGHT}px`;
    element.style.font = PULLQUOTE_FONT;
    element.style.lineHeight = `${PULLQUOTE_LINE_HEIGHT}px`;
  });
}

function renderEditorialLayout() {
  const startedAt = performance.now();
  const chapter = CHAPTERS[currentChapterIndex];
  const horizontalGutter = viewport.width < 640 ? 22 : 48;
  const headlineTop = viewport.width < 640 ? 116 : 118;
  const headlineWidth = Math.min(viewport.width - horizontalGutter * 2, 1180);
  const headline = fitHeadline(chapter.title, headlineWidth, viewport.width < 640 ? 170 : 190);
  const headlineFont = `800 ${headline.size}px ${HEADLINE_FONT_FAMILY}`;
  const headlineHeight = headline.lines.length * headline.lineHeight;

  syncPool(headlinePool, headline.lines.length, "headline-line", headlineLayer);
  headline.lines.forEach((line, index) => {
    const element = headlinePool[index];
    element.textContent = line.text;
    element.style.left = `${horizontalGutter}px`;
    element.style.top = `${headlineTop + index * headline.lineHeight}px`;
    element.style.font = headlineFont;
    element.style.lineHeight = `${headline.lineHeight}px`;
  });

  bodyTop = headlineTop + headlineHeight + (viewport.width < 640 ? 42 : 52);
  const columnCount = getColumnCount(viewport.width);
  const contentWidth = Math.min(viewport.width, 1500) - horizontalGutter * 2;
  const columnWidth = Math.floor(
    (contentWidth - COLUMN_GAP * (columnCount - 1)) / columnCount,
  );
  const occupiedWidth = columnWidth * columnCount + COLUMN_GAP * (columnCount - 1);
  const contentLeft = Math.round((viewport.width - occupiedWidth) / 2);
  const rowHeight = Math.max(360, Math.min(620, viewport.height - bodyTop - 110));
  const pullquote = createPullquotePlacement(
    chapter,
    contentLeft,
    columnWidth,
    rowHeight,
    columnCount,
  );
  const activeIds = new Set(chapter.companions);
  const activeOrbs = orbs.filter((orb) => activeIds.has(orb.id));
  const allLines = [];
  let cursor = { segmentIndex: 0, graphemeIndex: 0 };
  let exhausted = false;
  let finalRowIndex = 0;

  for (let rowIndex = 0; rowIndex < MAX_LAYOUT_ROWS && !exhausted; rowIndex += 1) {
    const rowTop = bodyTop + rowIndex * (rowHeight + ROW_GAP);
    finalRowIndex = rowIndex;

    for (let columnIndex = 0; columnIndex < columnCount && !exhausted; columnIndex += 1) {
      const columnX = contentLeft + columnIndex * (columnWidth + COLUMN_GAP);
      const result = layoutColumn(
        currentPreparedBody,
        cursor,
        { x: columnX, y: rowTop, width: columnWidth, height: rowHeight },
        rowIndex === 0 ? activeOrbs : [],
        rowIndex === 0 && columnIndex === 0 && pullquote
          ? [pullquote]
          : [],
      );
      allLines.push(...result.lines);
      cursor = result.cursor;
      exhausted = result.exhausted;
    }
  }

  stageHeight = Math.max(
    viewport.height,
    bodyTop + (finalRowIndex + 1) * rowHeight + finalRowIndex * ROW_GAP + 150,
  );
  firstRowBottom = bodyTop + rowHeight;
  stage.style.height = `${stageHeight}px`;
  resizeRainCanvas();

  syncPool(bodyLinePool, allLines.length, "body-line", bodyLayer);
  allLines.forEach((line, index) => {
    const element = bodyLinePool[index];
    element.textContent = line.text;
    element.style.left = `${line.x}px`;
    element.style.top = `${line.y}px`;
    element.style.font = BODY_FONT;
    element.style.lineHeight = `${BODY_LINE_HEIGHT}px`;
  });

  renderPullquote(pullquote);
  renderOrbs(activeIds);
  drawRain(performance.now(), chapter.rainLevel);

  const elapsed = performance.now() - startedAt;
  statLines.textContent = String(allLines.length);
  statReflow.textContent = `${elapsed.toFixed(1)}ms`;
  statColumns.textContent = String(columnCount);
  stage.dataset.columns = String(columnCount);
  stage.dataset.lines = String(allLines.length);
  stage.dataset.chapter = String(currentChapterIndex + 1);
  stage.dataset.complete = String(exhausted);
}

function renderOrbs(activeIds) {
  orbs.forEach((orb) => {
    const isActive = activeIds.has(orb.id);
    orb.element.hidden = !isActive;
    if (!isActive) return;

    orb.element.style.left = `${orb.x - orb.r}px`;
    orb.element.style.top = `${orb.y - orb.r}px`;
    orb.element.style.width = `${orb.r * 2}px`;
    orb.element.style.height = `${orb.r * 2}px`;
    orb.element.classList.toggle("paused", orb.paused);
  });
}

function resizeRainCanvas() {
  const pixelWidth = Math.round(viewport.width * viewport.dpr);
  const pixelHeight = Math.round(stageHeight * viewport.dpr);
  if (rainCanvas.width === pixelWidth && rainCanvas.height === pixelHeight) return;

  rainCanvas.width = pixelWidth;
  rainCanvas.height = pixelHeight;
  rainContext.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
}

function drawRain(now, density) {
  rainContext.clearRect(0, 0, viewport.width, stageHeight);
  rainContext.strokeStyle = "#16191a";
  rainContext.lineCap = "round";
  const visibleDensity = Math.max(0.06, density);
  const drift = motionHeld ? rainPhase : now * 0.00038;
  if (!motionHeld) rainPhase = drift;

  rainMarks.forEach((mark, index) => {
    if (mark.reveal > visibleDensity) return;
    const wave = Math.sin(mark.phase + drift * 5 + index * 0.007);
    const x = mark.x * viewport.width + wave * (2 + density * 5);
    const y = mark.y * stageHeight;
    const bandStrength = density > 0.4 && Math.floor(mark.y * 42) % 9 === 0 ? 1.55 : 1;
    const length = mark.length * bandStrength;

    rainContext.globalAlpha = (0.2 + density * 0.46) * mark.weight;
    rainContext.lineWidth = Math.max(0.6, mark.weight);
    rainContext.beginPath();
    rainContext.moveTo(x - 3, y - length / 2);
    rainContext.lineTo(x, y + length / 2);
    rainContext.moveTo(x + 4, y - length / 2);
    rainContext.lineTo(x + 7, y + length / 2);
    rainContext.stroke();
  });

  rainContext.globalAlpha = 1;
}

function hitTestOrbs(x, y) {
  const activeIds = new Set(CHAPTERS[currentChapterIndex].companions);
  for (let index = orbs.length - 1; index >= 0; index -= 1) {
    const orb = orbs[index];
    if (!activeIds.has(orb.id)) continue;
    const deltaX = x - orb.x;
    const deltaY = y - orb.y;
    if (deltaX * deltaX + deltaY * deltaY <= orb.r * orb.r) return orb;
  }
  return null;
}

function updateOrbs(deltaSeconds) {
  const activeIds = new Set(CHAPTERS[currentChapterIndex].companions);
  const bounds = {
    left: 8,
    right: viewport.width - 8,
    top: bodyTop,
    bottom: firstRowBottom,
  };

  const advancingOrbs = orbs.map((orb) =>
    activeIds.has(orb.id) ? orb : { ...orb, paused: true },
  );
  orbs = advanceOrbCollection(
    advancingOrbs,
    activeOrb?.id ?? null,
    deltaSeconds,
    bounds,
  ).map((orb, index) =>
    activeIds.has(orb.id) ? orb : { ...orb, paused: orbs[index].paused },
  );
}

function updateFps(now) {
  frameTimes.push(now);
  while (frameTimes.length > 0 && frameTimes[0] < now - 1_000) frameTimes.shift();
  statFps.textContent = motionHeld ? "—" : String(frameTimes.length);
}

function animate(now) {
  animationFrame = null;
  const deltaSeconds = Math.min((now - lastFrameTime) / 1_000, 0.05);
  lastFrameTime = now;

  if (!motionHeld) updateOrbs(deltaSeconds);
  if (needsRender || !motionHeld || activeOrb) {
    renderEditorialLayout();
    needsRender = false;
  }
  updateFps(now);

  if (!motionHeld || activeOrb) scheduleFrame();
}

function scheduleFrame() {
  if (animationFrame === null) animationFrame = window.requestAnimationFrame(animate);
}

function prepareChapter(index) {
  currentChapterIndex = getChapterIndex(index);
  const chapter = CHAPTERS[currentChapterIndex];
  currentPreparedBody = prepareWithSegments(chapter.paragraphs.join("\n\n"), BODY_FONT);
  currentPreparedPullquote = prepareWithSegments(`“${chapter.pullquote}”`, PULLQUOTE_FONT);
  cachedHeadline = { key: "", size: 0, lineHeight: 0, lines: [] };
  chapterEyebrow.textContent = chapter.eyebrow;
  chapterLabel.textContent = `Chapter ${currentChapterIndex + 1} of ${CHAPTERS.length}`;
  chapterTitle.textContent = chapter.title.replaceAll("/", "").toLowerCase();
  previousChapter.disabled = currentChapterIndex === 0;
  nextChapter.disabled = currentChapterIndex === CHAPTERS.length - 1;
  kanjiCoda.textContent = chapter.kanji;
  kanjiCoda.classList.toggle("visible", Boolean(chapter.kanji));
  needsRender = true;
  scheduleFrame();
}

function goToChapter(index) {
  const nextIndex = getChapterIndex(index);
  if (nextIndex === currentChapterIndex) return;
  prepareChapter(nextIndex);
  window.scrollTo({ top: 0, behavior: reducedMotionQuery.matches ? "auto" : "smooth" });
}

function setMotionHeld(held) {
  motionHeld = held || reducedMotionQuery.matches;
  pauseMotion.setAttribute("aria-pressed", String(motionHeld));
  motionLabel.textContent = motionHeld ? "Release the rain" : "Hold the rain";
  pauseMotion.querySelector(".motion-symbol").textContent = motionHeld ? "▶" : "Ⅱ";
  needsRender = true;
  scheduleFrame();
}

function buildReadingEdition() {
  CHAPTERS.forEach((chapter) => {
    const section = document.createElement("section");
    section.className = "story-section";
    const heading = document.createElement("h3");
    heading.textContent = chapter.title.replaceAll("/", "");
    const copy = document.createElement("div");
    copy.className = "story-copy";

    chapter.paragraphs.forEach((paragraph) => {
      const element = document.createElement("p");
      element.textContent = paragraph;
      copy.appendChild(element);
    });

    section.append(heading, copy);
    storyBody.appendChild(section);
  });
}

function openReadingEdition() {
  readingReturnFocus = document.activeElement;
  setMotionHeld(true);
  document.body.classList.add("reading-open");
  masthead.inert = true;
  visualEdition.inert = true;
  motionControl.inert = true;
  skipToStory.inert = true;
  readingMode.setAttribute("aria-expanded", "true");
  closeReadingMode.focus();
}

function closeReadingEdition() {
  document.body.classList.remove("reading-open");
  masthead.inert = false;
  visualEdition.inert = false;
  motionControl.inert = false;
  skipToStory.inert = false;
  readingMode.setAttribute("aria-expanded", "false");
  if (!reducedMotionQuery.matches) setMotionHeld(false);
  readingReturnFocus?.focus();
  readingReturnFocus = null;
}

function updateViewport() {
  viewport.width = window.innerWidth;
  viewport.height = window.innerHeight;
  viewport.dpr = Math.min(window.devicePixelRatio || 1, 2);
  const top = Math.max(280, bodyTop);
  const bottom = Math.max(top + 200, viewport.height - 110);

  orbs = orbs.map((orb) => ({
    ...orb,
    x: Math.max(orb.r + 8, Math.min(viewport.width - orb.r - 8, orb.x)),
    y: Math.max(top + orb.r, Math.min(bottom - orb.r, orb.y)),
  }));
  cachedHeadline = { key: "", size: 0, lineHeight: 0, lines: [] };
  needsRender = true;
  scheduleFrame();
}

stage.addEventListener("pointerdown", (event) => {
  const documentY = event.clientY + window.scrollY;
  const orb = hitTestOrbs(event.clientX, documentY);
  if (!orb) return;

  activeOrb = orb;
  orb.dragging = true;
  orb.dragStartX = event.clientX;
  orb.dragStartY = documentY;
  orb.dragStartOrbX = orb.x;
  orb.dragStartOrbY = orb.y;
  stage.setPointerCapture(event.pointerId);
  event.preventDefault();
  scheduleFrame();
});

stage.addEventListener("pointermove", (event) => {
  pointerX = event.clientX;
  pointerY = event.clientY + window.scrollY;
  if (!activeOrb) return;

  activeOrb.x = activeOrb.dragStartOrbX + (pointerX - activeOrb.dragStartX);
  activeOrb.y = activeOrb.dragStartOrbY + (pointerY - activeOrb.dragStartY);
  needsRender = true;
  scheduleFrame();
});

stage.addEventListener("pointerup", (event) => {
  if (!activeOrb) return;
  const documentY = event.clientY + window.scrollY;
  const deltaX = event.clientX - activeOrb.dragStartX;
  const deltaY = documentY - activeOrb.dragStartY;

  if (deltaX * deltaX + deltaY * deltaY < 20) activeOrb.paused = !activeOrb.paused;
  activeOrb.dragging = false;
  activeOrb = null;
  needsRender = true;
  scheduleFrame();
});

stage.addEventListener("pointercancel", () => {
  if (!activeOrb) return;
  activeOrb.dragging = false;
  activeOrb = null;
  needsRender = true;
  scheduleFrame();
});

stage.addEventListener("pointerleave", () => {
  pointerX = -10_000;
  pointerY = -10_000;
});

stage.addEventListener("pointermove", () => {
  const hovered = hitTestOrbs(pointerX, pointerY);
  stage.style.cursor = activeOrb ? "grabbing" : hovered ? "grab" : "";
});

previousChapter.addEventListener("click", () => goToChapter(currentChapterIndex - 1));
nextChapter.addEventListener("click", () => goToChapter(currentChapterIndex + 1));
pauseMotion.addEventListener("click", () => setMotionHeld(!motionHeld));
readingMode.addEventListener("click", openReadingEdition);
skipToStory.addEventListener("click", (event) => {
  event.preventDefault();
  openReadingEdition();
});
closeReadingMode.addEventListener("click", closeReadingEdition);

window.addEventListener("keydown", (event) => {
  if (document.body.classList.contains("reading-open")) {
    if (event.key === "Escape") closeReadingEdition();
    if (event.key === "Tab") {
      const focusable = [...fullStory.querySelectorAll("button:not([disabled]), a[href]")];
      const firstFocusable = focusable[0];
      const lastFocusable = focusable.at(-1);
      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }
    return;
  }
  if (event.key === "ArrowLeft") goToChapter(currentChapterIndex - 1);
  if (event.key === "ArrowRight") goToChapter(currentChapterIndex + 1);
  if (event.key === " ") {
    event.preventDefault();
    setMotionHeld(!motionHeld);
  }
});

window.addEventListener("resize", updateViewport, { passive: true });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    animationFrame = null;
  } else {
    lastFrameTime = performance.now();
    needsRender = true;
    scheduleFrame();
  }
});

reducedMotionQuery.addEventListener("change", (event) => {
  setMotionHeld(event.matches);
});

buildReadingEdition();
await document.fonts.ready;
prepareChapter(0);

if (STORY_PARAGRAPHS.length !== 24) {
  throw new Error("The supplied story is incomplete.");
}
