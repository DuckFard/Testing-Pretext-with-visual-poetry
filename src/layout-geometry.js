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

export function circleIntervalForBand(
  cx,
  cy,
  radius,
  bandTop,
  bandBottom,
  horizontalPadding = 0,
  verticalPadding = 0,
) {
  const top = bandTop - verticalPadding;
  const bottom = bandBottom + verticalPadding;

  if (top >= cy + radius || bottom <= cy - radius) {
    return null;
  }

  const minimumDeltaY =
    cy >= top && cy <= bottom ? 0 : cy < top ? top - cy : cy - bottom;

  if (minimumDeltaY >= radius) {
    return null;
  }

  const maximumDeltaX = Math.sqrt(radius * radius - minimumDeltaY * minimumDeltaY);

  return {
    left: cx - maximumDeltaX - horizontalPadding,
    right: cx + maximumDeltaX + horizontalPadding,
  };
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

  if (x - rainDrop.r < bounds.left) {
    x = bounds.left + rainDrop.r;
    vx = Math.abs(vx);
  } else if (x + rainDrop.r > bounds.right) {
    x = bounds.right - rainDrop.r;
    vx = -Math.abs(vx);
  }

  if (y - rainDrop.r < bounds.top) {
    y = bounds.top + rainDrop.r;
    vy = Math.abs(vy);
  } else if (y + rainDrop.r > bounds.bottom) {
    y = bounds.bottom - rainDrop.r;
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
