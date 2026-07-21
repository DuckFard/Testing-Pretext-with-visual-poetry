import { layoutNextLine, prepareWithSegments } from "@chenglou/pretext";

import {
  advanceRainDropCollection,
  carveTextLineSlots,
  chooseWhitespaceBiasedX,
  getColumnCount,
  rainDropIntervalForBand,
} from "./layout-geometry.js";
import { RAIN_STROKE_PATHS, RAIN_STROKE_SEGMENTS } from "./rain-mark.js";
import { CHAPTERS, STORY_PARAGRAPHS, getChapterIndex } from "./story.js";

document.documentElement.classList.add("js");

const BODY_FONT_FAMILY = '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif';
const BODY_FONT = `16px ${BODY_FONT_FAMILY}`;
const BODY_LINE_HEIGHT = 25;
const COLUMN_GAP = 32;
const ROW_GAP = 72;
const MAX_LAYOUT_ROWS = 12;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const stage = document.querySelector("#stage");
const rainCanvas = document.querySelector("#rainField");
const rainContext = rainCanvas.getContext("2d", { alpha: true });
const bodyLayer = document.querySelector("#bodyLayer");
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
let motionHeld = reducedMotionQuery.matches;
let stageHeight = viewport.height;
let textTop = 560;
let textBottom = viewport.height - 120;
let lastFrameTime = performance.now();
let animationFrame = null;
let needsRender = true;
let activeRainDrop = null;
let readingReturnFocus = null;
let pointerX = -10_000;
let pointerY = -10_000;
let rainPhase = 0;
let currentTitleBottom = 0;
let whitespaceLineGeometry = [];
const frameTimes = [];
const bodyLinePool = [];

const rainDropDefinitions = [
  { id: "drop-01", fx: 0.46, fy: 0.2, width: 18, height: 12, vx: 0, vy: 22, rotation: -2, scale: 0.86 },
  { id: "drop-02", fx: 0.55, fy: 0.31, width: 18, height: 12, vx: 0, vy: 27, rotation: 1, scale: 0.9 },
  { id: "drop-03", fx: 0.64, fy: 0.16, width: 18, height: 12, vx: 0, vy: 19, rotation: -1, scale: 0.82 },
  { id: "drop-04", fx: 0.73, fy: 0.43, width: 18, height: 12, vx: 0, vy: 25, rotation: 2, scale: 0.88 },
  { id: "drop-05", fx: 0.83, fy: 0.27, width: 18, height: 12, vx: 0, vy: 21, rotation: -3, scale: 0.92 },
  { id: "drop-06", fx: 0.92, fy: 0.51, width: 18, height: 12, vx: 0, vy: 28, rotation: 1, scale: 0.84 },
  { id: "drop-07", fx: 0.12, fy: 0.64, width: 18, height: 12, vx: 0, vy: 20, rotation: -1, scale: 0.94 },
  { id: "drop-08", fx: 0.22, fy: 0.76, width: 18, height: 12, vx: 0, vy: 26, rotation: 2, scale: 0.87 },
  { id: "drop-09", fx: 0.31, fy: 0.58, width: 18, height: 12, vx: 0, vy: 23, rotation: 0, scale: 0.9 },
  { id: "drop-10", fx: 0.4, fy: 0.83, width: 18, height: 12, vx: 0, vy: 29, rotation: -2, scale: 0.83 },
  { id: "drop-11", fx: 0.49, fy: 0.67, width: 18, height: 12, vx: 0, vy: 24, rotation: 1, scale: 0.89 },
  { id: "drop-12", fx: 0.58, fy: 0.88, width: 18, height: 12, vx: 0, vy: 19, rotation: -1, scale: 0.85 },
  { id: "drop-13", fx: 0.68, fy: 0.72, width: 18, height: 12, vx: 0, vy: 27, rotation: 2, scale: 0.93 },
  { id: "drop-14", fx: 0.78, fy: 0.91, width: 18, height: 12, vx: 0, vy: 22, rotation: -2, scale: 0.86 },
  { id: "drop-15", fx: 0.89, fy: 0.79, width: 18, height: 12, vx: 0, vy: 25, rotation: 1, scale: 0.91 },
];

function createRainStrokeMark() {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.classList.add("rain-stroke-mark");
  svg.setAttribute("viewBox", "0 0 18 14");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  RAIN_STROKE_PATHS.forEach((pathData) => {
    const path = document.createElementNS(SVG_NAMESPACE, "path");
    path.setAttribute("d", pathData);
    svg.appendChild(path);
  });

  return svg;
}

let rainDrops = rainDropDefinitions.map((definition) => {
  const element = document.createElement("div");
  element.className = "rain-drop";
  element.style.setProperty("--mark-rotation", `${definition.rotation}deg`);
  element.style.setProperty("--mark-scale", String(definition.scale));
  element.appendChild(createRainStrokeMark());
  stage.appendChild(element);

  return {
    ...definition,
    x: definition.fx * viewport.width,
    y: Math.max(160, definition.fy * viewport.height),
    paused: false,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartDropX: 0,
    dragStartDropY: 0,
    element,
  };
});

const rainMarks = createRainMarks(48, 32);

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
      x: (column + 0.5 + (random() - 0.5) * 0.16) / columns,
      y: (row + 0.5 + (random() - 0.5) * 0.12) / rows,
      reveal: random(),
      phase: random() * Math.PI * 2,
      length: 2.5 + random() * 1.7,
      weight: 0.52 + random() * 0.38,
    };
  });
}

function getLineWordGeometry(line) {
  const words = [];
  const matcher = /\S+/g;
  let match;

  while ((match = matcher.exec(line.text)) !== null) {
    const left = line.x + rainContext.measureText(line.text.slice(0, match.index)).width;
    words.push({
      left,
      right: left + rainContext.measureText(match[0]).width,
    });
  }

  return {
    ...line,
    words,
  };
}

function cacheWhitespaceGeometry(lines) {
  rainContext.font = BODY_FONT;
  whitespaceLineGeometry = lines
    .map(getLineWordGeometry)
    .filter((line) => line.words.length > 1 && line.right - line.x >= 54);
}

function biasRainDropsTowardWhitespace() {
  rainDrops = rainDrops.map((rainDrop) => {
    if (rainDrop.dragging || whitespaceLineGeometry.length === 0) return rainDrop;
    const nearestLine = whitespaceLineGeometry.reduce((nearest, line) => {
      const distance = Math.abs(line.y + BODY_LINE_HEIGHT / 2 - rainDrop.y);
      const nearestDistance = Math.abs(nearest.y + BODY_LINE_HEIGHT / 2 - rainDrop.y);
      return distance < nearestDistance ? line : nearest;
    });
    const targetX = chooseWhitespaceBiasedX(
      rainDrop.x,
      rainDrop.width,
      { left: nearestLine.x, right: nearestLine.right },
      nearestLine.words,
    );

    return { ...rainDrop, x: targetX };
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

function getCompositionMetrics() {
  const isCompact = viewport.width <= 760;
  const gutter = isCompact ? 20 : Math.max(48, Math.round(viewport.width * 0.055));
  const titleTop = isCompact ? 88 : 104;
  const titleWidth = isCompact
    ? viewport.width - gutter * 2
    : Math.min(580, Math.round(viewport.width * 0.37));
  const titleHeight = isCompact ? (viewport.width < 420 ? 265 : 315) : 390;

  stage.style.setProperty("--title-left", `${gutter}px`);
  stage.style.setProperty("--title-top", `${titleTop}px`);
  stage.style.setProperty("--title-width", `${titleWidth}px`);

  if (isCompact) {
    const firstTop = titleTop + titleHeight + 42;
    const firstHeight = Math.max(500, viewport.height - firstTop - 120);
    return {
      columnCount: 1,
      gutter,
      initialRegions: [
        { x: gutter, y: firstTop, width: viewport.width - gutter * 2, height: firstHeight },
      ],
      overflowTop: firstTop + firstHeight + ROW_GAP,
      overflowRowHeight: 560,
      titleBottom: titleTop + titleHeight,
    };
  }

  const columnCount = getColumnCount(viewport.width);
  const topRightX = Math.max(gutter + titleWidth + 76, Math.round(viewport.width * 0.45));
  const topRightWidth = viewport.width - gutter - topRightX;
  const topHeight = Math.max(320, Math.min(410, viewport.height * 0.46));
  const lowerTop = Math.max(titleTop + titleHeight + 64, titleTop + topHeight + 44);
  const lowerBottom = Math.max(viewport.height - 118, lowerTop + 300);
  const contentWidth = viewport.width - gutter * 2;
  const columnWidth = Math.floor(
    (contentWidth - COLUMN_GAP * (columnCount - 1)) / columnCount,
  );
  const initialRegions = [
    { x: topRightX, y: titleTop + 8, width: topRightWidth, height: topHeight },
  ];

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    initialRegions.push({
      x: gutter + columnIndex * (columnWidth + COLUMN_GAP),
      y: lowerTop,
      width: columnWidth,
      height: lowerBottom - lowerTop,
    });
  }

  return {
    columnCount,
    gutter,
    columnWidth,
    initialRegions,
    overflowTop: lowerBottom + ROW_GAP,
    overflowRowHeight: Math.max(390, Math.min(580, viewport.height - 170)),
    titleBottom: titleTop + titleHeight,
  };
}

function layoutRegion(prepared, startCursor, region, blockers, rectangleBlockers) {
  let cursor = startCursor;
  let lineTop = region.y;
  const lines = [];
  let exhausted = false;

  while (lineTop + BODY_LINE_HEIGHT <= region.y + region.height && !exhausted) {
    const bandBottom = lineTop + BODY_LINE_HEIGHT;
    const blockedIntervals = blockers
      .map((rainDrop) => rainDropIntervalForBand(rainDrop, lineTop, bandBottom))
      .filter(Boolean);
    const rectangleIntervals = rectangleBlockers
      .filter(
        (rectangle) =>
          bandBottom > rectangle.y && lineTop < rectangle.y + rectangle.height,
      )
      .map((rectangle) => ({ left: rectangle.x, right: rectangle.x + rectangle.width }));
    const slots = carveTextLineSlots(
      { left: region.x, right: region.x + region.width },
      [...blockedIntervals, ...rectangleIntervals],
    ).sort((a, b) => a.left - b.left);

    for (const slot of slots) {
      const line = layoutNextLine(prepared, cursor, slot.right - slot.left);
      if (line === null) {
        exhausted = true;
        break;
      }
      lines.push({
        x: Math.round(slot.left),
        y: Math.round(lineTop),
        right: Math.round(slot.right),
        text: line.text,
      });
      cursor = line.end;
    }

    lineTop += BODY_LINE_HEIGHT;
  }

  return { cursor, exhausted, lines };
}

function createOverflowRegions(metrics, rowIndex) {
  const rowTop = metrics.overflowTop + rowIndex * (metrics.overflowRowHeight + ROW_GAP);
  const contentWidth = viewport.width - metrics.gutter * 2;
  const columnWidth =
    metrics.columnWidth ??
    Math.floor((contentWidth - COLUMN_GAP * (metrics.columnCount - 1)) / metrics.columnCount);

  return Array.from({ length: metrics.columnCount }, (_, columnIndex) => ({
    x: metrics.gutter + columnIndex * (columnWidth + COLUMN_GAP),
    y: rowTop,
    width: columnWidth,
    height: metrics.overflowRowHeight,
  }));
}

function renderEditorialLayout() {
  const startedAt = performance.now();
  const metrics = getCompositionMetrics();
  currentTitleBottom = metrics.titleBottom;
  const allLines = [];
  let cursor = { segmentIndex: 0, graphemeIndex: 0 };
  let exhausted = false;
  let finalBottom = metrics.initialRegions.at(-1).y + metrics.initialRegions.at(-1).height;
  const kanjiBlocker =
    viewport.width <= 760
      ? {
          x: metrics.gutter,
          y: viewport.height - 168,
          width: viewport.width - metrics.gutter * 2,
          height: 88,
        }
      : {
          x: viewport.width / 2 - 74,
          y: viewport.height - 168,
          width: 148,
          height: 88,
        };

  for (const region of metrics.initialRegions) {
    if (exhausted) break;
    const result = layoutRegion(currentPreparedBody, cursor, region, [], [kanjiBlocker]);
    allLines.push(...result.lines);
    cursor = result.cursor;
    exhausted = result.exhausted;
  }

  for (let rowIndex = 0; rowIndex < MAX_LAYOUT_ROWS && !exhausted; rowIndex += 1) {
    const regions = createOverflowRegions(metrics, rowIndex);
    finalBottom = regions[0].y + regions[0].height;
    for (const region of regions) {
      if (exhausted) break;
      const result = layoutRegion(currentPreparedBody, cursor, region, [], [kanjiBlocker]);
      allLines.push(...result.lines);
      cursor = result.cursor;
      exhausted = result.exhausted;
    }
  }

  stageHeight = Math.max(viewport.height, finalBottom + 190);
  textTop = Math.min(...metrics.initialRegions.map((region) => region.y));
  textBottom = Math.max(
    stageHeight - 190,
    ...metrics.initialRegions.map((region) => region.y + region.height),
  );
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

  cacheWhitespaceGeometry(allLines);
  biasRainDropsTowardWhitespace();
  renderRainDrops();
  drawRain(performance.now(), CHAPTERS[currentChapterIndex].rainLevel, currentTitleBottom);

  const elapsed = performance.now() - startedAt;
  statLines.textContent = String(allLines.length);
  statReflow.textContent = `${elapsed.toFixed(1)}ms`;
  statColumns.textContent = String(metrics.columnCount);
  stage.dataset.columns = String(metrics.columnCount);
  stage.dataset.lines = String(allLines.length);
  stage.dataset.chapter = String(currentChapterIndex + 1);
  stage.dataset.complete = String(exhausted);
}

function renderRainDrops() {
  rainDrops.forEach((rainDrop) => {
    rainDrop.element.style.left = `${rainDrop.x - rainDrop.width / 2}px`;
    rainDrop.element.style.top = `${rainDrop.y - rainDrop.height / 2}px`;
    rainDrop.element.style.width = `${rainDrop.width}px`;
    rainDrop.element.style.height = `${rainDrop.height}px`;
    rainDrop.element.classList.toggle("paused", rainDrop.paused);
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

function drawRain(now, density, titleBottom) {
  rainContext.clearRect(0, 0, viewport.width, stageHeight);
  rainContext.strokeStyle = "#16191a";
  rainContext.lineCap = "round";
  const visibleDensity = 0.58 + density * 0.42;
  const drift = motionHeld ? rainPhase : now * 0.00022;
  if (!motionHeld) rainPhase = drift;

  rainMarks.forEach((mark, index) => {
    if (mark.reveal > visibleDensity) return;
    if (viewport.width <= 760 && index % 2 === 0) return;
    const y = mark.y * stageHeight;
    const baseX = mark.x * viewport.width;
    const titleQuietZone =
      (viewport.width > 760 && baseX < viewport.width * 0.43 && y < titleBottom + 44) ||
      (viewport.width <= 760 && y < titleBottom + 32);
    if (titleQuietZone) return;

    const wave = Math.sin(mark.phase + drift * 5 + index * 0.009);
    const x = baseX + wave * (1.5 + density * 3.5);
    rainContext.globalAlpha = (0.2 + density * 0.24) * mark.weight;
    rainContext.lineWidth = Math.max(0.65, mark.weight);
    rainContext.beginPath();
    const strokeScale = mark.length / 4;
    RAIN_STROKE_SEGMENTS.forEach((segment) => {
      rainContext.moveTo(x + segment.x1 * strokeScale, y + segment.y1 * strokeScale);
      rainContext.lineTo(x + segment.x2 * strokeScale, y + segment.y2 * strokeScale);
    });
    rainContext.stroke();
  });

  rainContext.globalAlpha = 1;
}

function hitTestRainDrops(x, y) {
  for (let index = rainDrops.length - 1; index >= 0; index -= 1) {
    const rainDrop = rainDrops[index];
    const hitHalfWidth = Math.max(22, rainDrop.width / 2);
    const hitHalfHeight = Math.max(22, rainDrop.height / 2);
    if (
      Math.abs(x - rainDrop.x) <= hitHalfWidth &&
      Math.abs(y - rainDrop.y) <= hitHalfHeight
    ) return rainDrop;
  }
  return null;
}

function updateRainDrops(deltaSeconds) {
  const bounds = {
    left: 8,
    right: viewport.width - 8,
    top: Math.max(88, textTop - 34),
    bottom: Math.max(textTop + 220, textBottom),
  };

  rainDrops = advanceRainDropCollection(
    rainDrops,
    activeRainDrop?.id ?? null,
    deltaSeconds,
    bounds,
  ).map((rainDrop) => {
    if (rainDrop.dragging || rainDrop.paused || rainDrop.vy >= 0) return rainDrop;
    return { ...rainDrop, y: bounds.top + rainDrop.height / 2, vy: Math.abs(rainDrop.vy) };
  });
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

  if (!motionHeld) updateRainDrops(deltaSeconds);
  if (needsRender) {
    renderEditorialLayout();
    needsRender = false;
  } else if (!motionHeld || activeRainDrop) {
    biasRainDropsTowardWhitespace();
    renderRainDrops();
    drawRain(now, CHAPTERS[currentChapterIndex].rainLevel, currentTitleBottom);
  }
  updateFps(now);

  if (!motionHeld || activeRainDrop) scheduleFrame();
}

function scheduleFrame() {
  if (animationFrame === null) animationFrame = window.requestAnimationFrame(animate);
}

function prepareChapter(index) {
  currentChapterIndex = getChapterIndex(index);
  const chapter = CHAPTERS[currentChapterIndex];
  currentPreparedBody = prepareWithSegments(chapter.paragraphs.join("\n\n"), BODY_FONT);
  chapterEyebrow.textContent = chapter.eyebrow;
  chapterLabel.textContent = `Movement ${currentChapterIndex + 1} of ${CHAPTERS.length}`;
  chapterTitle.textContent = chapter.title.replaceAll("/", "").toLowerCase();
  previousChapter.disabled = currentChapterIndex === 0;
  nextChapter.disabled = currentChapterIndex === CHAPTERS.length - 1;
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
  if (storyBody.children.length > 0) return;

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
  fullStory.setAttribute("role", "dialog");
  fullStory.setAttribute("aria-modal", "true");
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
  fullStory.removeAttribute("role");
  fullStory.removeAttribute("aria-modal");
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
  const top = 100;
  const bottom = Math.max(top + 240, viewport.height - 110);

  rainDrops = rainDrops.map((rainDrop) => ({
    ...rainDrop,
    x: Math.max(
      rainDrop.width / 2 + 8,
      Math.min(viewport.width - rainDrop.width / 2 - 8, rainDrop.x),
    ),
    y: Math.max(
      top + rainDrop.height / 2,
      Math.min(bottom - rainDrop.height / 2, rainDrop.y),
    ),
  }));
  needsRender = true;
  scheduleFrame();
}

stage.addEventListener("pointerdown", (event) => {
  const documentY = event.clientY + window.scrollY;
  const rainDrop = hitTestRainDrops(event.clientX, documentY);
  if (!rainDrop) return;

  activeRainDrop = rainDrop;
  rainDrop.dragging = true;
  rainDrop.dragStartX = event.clientX;
  rainDrop.dragStartY = documentY;
  rainDrop.dragStartDropX = rainDrop.x;
  rainDrop.dragStartDropY = rainDrop.y;
  stage.setPointerCapture(event.pointerId);
  event.preventDefault();
  scheduleFrame();
});

stage.addEventListener("pointermove", (event) => {
  pointerX = event.clientX;
  pointerY = event.clientY + window.scrollY;
  if (!activeRainDrop) return;

  activeRainDrop.x = activeRainDrop.dragStartDropX + (pointerX - activeRainDrop.dragStartX);
  activeRainDrop.y = activeRainDrop.dragStartDropY + (pointerY - activeRainDrop.dragStartY);
  scheduleFrame();
});

stage.addEventListener("pointerup", (event) => {
  if (!activeRainDrop) return;
  const documentY = event.clientY + window.scrollY;
  const deltaX = event.clientX - activeRainDrop.dragStartX;
  const deltaY = documentY - activeRainDrop.dragStartY;

  if (deltaX * deltaX + deltaY * deltaY < 20) {
    activeRainDrop.paused = !activeRainDrop.paused;
  }
  activeRainDrop.dragging = false;
  activeRainDrop = null;
  needsRender = true;
  scheduleFrame();
});

stage.addEventListener("pointercancel", () => {
  if (!activeRainDrop) return;
  activeRainDrop.dragging = false;
  activeRainDrop = null;
  needsRender = true;
  scheduleFrame();
});

stage.addEventListener("pointerleave", () => {
  pointerX = -10_000;
  pointerY = -10_000;
});

stage.addEventListener("pointermove", () => {
  const hovered = hitTestRainDrops(pointerX, pointerY);
  stage.style.cursor = activeRainDrop ? "grabbing" : hovered ? "grab" : "";
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
  const isInteractiveTarget =
    event.target instanceof Element &&
    event.target.closest('button, a[href], input, select, textarea, [contenteditable="true"]');
  if (event.key === "ArrowLeft") goToChapter(currentChapterIndex - 1);
  if (event.key === "ArrowRight") goToChapter(currentChapterIndex + 1);
  if (event.key === " " && !isInteractiveTarget) {
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
