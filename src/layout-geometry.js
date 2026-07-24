export const MIN_SLOT_WIDTH = 54;

export function carveTextLineSlots(base, blocked, minWidth = MIN_SLOT_WIDTH) {
  const carved = blocked.reduce((slots, interval) => {
    return slots.flatMap((slot) => {
      if (interval.right <= slot.left || interval.left >= slot.right) {
        return [{ ...slot }];
      }

      const leftSlot =
        interval.left > slot.left
          ? [{ left: slot.left, right: Math.min(interval.left, slot.right) }]
          : [];
      const rightSlot =
        interval.right < slot.right
          ? [{ left: Math.max(interval.right, slot.left), right: slot.right }]
          : [];

      return [...leftSlot, ...rightSlot];
    });
  }, [{ ...base }]);

  return carved.filter((slot) => slot.right - slot.left >= minWidth);
}

export function rainDropIntervalForBand(
  rainDrop,
  bandTop,
  bandBottom,
  horizontalPadding = 3,
  verticalPadding = 1,
) {
  const halfWidth = rainDrop.width / 2;
  const halfHeight = rainDrop.height / 2;
  const top = rainDrop.y - halfHeight - verticalPadding;
  const bottom = rainDrop.y + halfHeight + verticalPadding;

  if (bandTop >= bottom || bandBottom <= top) return null;

  return {
    left: rainDrop.x - halfWidth - horizontalPadding,
    right: rainDrop.x + halfWidth + horizontalPadding,
  };
}

export function getRandomSplashProgress(random = Math.random) {
  const normalizedRandom = Math.max(0, Math.min(1, random()));
  return 0.2 + normalizedRandom * 0.6;
}

export function shouldSplashMidair(rainDrop, bounds) {
  if (rainDrop.paused || rainDrop.dragging || rainDrop.vy <= 0) return false;

  const splashY =
    bounds.top + (bounds.bottom - bounds.top) * rainDrop.splashProgress;
  return rainDrop.y >= splashY;
}

export function getColumnCount(width) {
  if (width > 1000) return 3;
  if (width > 640) return 2;
  return 1;
}

export function advanceRainDrop(rainDrop, deltaSeconds, bounds) {
  if (rainDrop.paused || rainDrop.dragging) {
    return { ...rainDrop };
  }

  let x = rainDrop.x + rainDrop.vx * deltaSeconds;
  let y = rainDrop.y + rainDrop.vy * deltaSeconds;
  let vx = rainDrop.vx;
  let vy = rainDrop.vy;
  const halfWidth = rainDrop.width / 2;
  const halfHeight = rainDrop.height / 2;

  if (x - halfWidth < bounds.left) {
    x = bounds.left + halfWidth;
    vx = Math.abs(vx);
  } else if (x + halfWidth > bounds.right) {
    x = bounds.right - halfWidth;
    vx = -Math.abs(vx);
  }

  if (y - halfHeight < bounds.top) {
    y = bounds.top + halfHeight;
    vy = Math.abs(vy);
  } else if (y + halfHeight > bounds.bottom) {
    y = bounds.bottom - halfHeight;
    vy = -Math.abs(vy);
  }

  return { ...rainDrop, x, y, vx, vy };
}

export function advanceRainDropCollection(rainDrops, activeRainDropId, deltaSeconds, bounds) {
  return rainDrops.map((rainDrop) =>
    rainDrop.id === activeRainDropId
      ? rainDrop
      : advanceRainDrop(rainDrop, deltaSeconds, bounds),
  );
}
