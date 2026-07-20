import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceOrb,
  advanceOrbCollection,
  carveTextLineSlots,
  circleIntervalForBand,
  getColumnCount,
} from "../src/layout-geometry.js";

test("carveTextLineSlots preserves the input and splits around blockers", () => {
  const base = Object.freeze({ left: 0, right: 300 });
  const blocked = Object.freeze([
    Object.freeze({ left: 90, right: 150 }),
    Object.freeze({ left: 180, right: 220 }),
  ]);

  assert.deepEqual(carveTextLineSlots(base, blocked, 20), [
    { left: 0, right: 90 },
    { left: 150, right: 180 },
    { left: 220, right: 300 },
  ]);
  assert.deepEqual(base, { left: 0, right: 300 });
  assert.deepEqual(blocked, [
    { left: 90, right: 150 },
    { left: 180, right: 220 },
  ]);
});

test("carveTextLineSlots ignores outside blockers and removes narrow slots", () => {
  assert.deepEqual(
    carveTextLineSlots(
      { left: 0, right: 200 },
      [
        { left: -100, right: -10 },
        { left: 60, right: 160 },
        { left: 210, right: 230 },
      ],
      50,
    ),
    [{ left: 0, right: 60 }],
  );
});

test("carveTextLineSlots returns no slots when the band is fully covered", () => {
  assert.deepEqual(
    carveTextLineSlots({ left: 10, right: 90 }, [{ left: 0, right: 100 }], 1),
    [],
  );
});

test("circleIntervalForBand returns null outside and at a tangent", () => {
  assert.equal(circleIntervalForBand(100, 100, 30, 0, 60, 0, 0), null);
  assert.equal(circleIntervalForBand(100, 100, 30, 130, 150, 0, 0), null);
});

test("circleIntervalForBand returns a symmetric padded center interval", () => {
  assert.deepEqual(circleIntervalForBand(100, 100, 30, 90, 110, 8, 2), {
    left: 62,
    right: 138,
  });
});

test("getColumnCount follows the editorial demo breakpoints", () => {
  assert.equal(getColumnCount(640), 1);
  assert.equal(getColumnCount(641), 2);
  assert.equal(getColumnCount(1000), 2);
  assert.equal(getColumnCount(1001), 3);
});

test("advanceOrb moves immutably and bounces at stage bounds", () => {
  const source = Object.freeze({
    x: 290,
    y: 100,
    r: 20,
    vx: 40,
    vy: -10,
    paused: false,
    dragging: false,
  });

  const moved = advanceOrb(source, 1, {
    left: 0,
    right: 300,
    top: 0,
    bottom: 200,
  });

  assert.deepEqual(moved, {
    ...source,
    x: 280,
    y: 90,
    vx: -40,
  });
  assert.notEqual(moved, source);
  assert.equal(source.x, 290);
});

test("advanceOrb keeps paused and dragged orbs fixed without mutation", () => {
  const bounds = { left: 0, right: 300, top: 0, bottom: 200 };
  const paused = { x: 80, y: 90, r: 20, vx: 40, vy: 10, paused: true, dragging: false };
  const dragging = { ...paused, paused: false, dragging: true };

  assert.deepEqual(advanceOrb(paused, 1, bounds), paused);
  assert.deepEqual(advanceOrb(dragging, 1, bounds), dragging);
  assert.notEqual(advanceOrb(paused, 1, bounds), paused);
});

test("advanceOrbCollection preserves the active drag reference", () => {
  const active = { id: "toad", x: 80, y: 90, r: 20, vx: 40, vy: 10, paused: false, dragging: true };
  const neighbor = { id: "crab", x: 180, y: 90, r: 20, vx: 10, vy: 0, paused: false, dragging: false };
  const result = advanceOrbCollection(
    [active, neighbor],
    "toad",
    1,
    { left: 0, right: 300, top: 0, bottom: 200 },
  );

  assert.equal(result[0], active);
  assert.notEqual(result[1], neighbor);
  assert.equal(result[1].x, 190);
});
