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

export function advanceOrb(orb, deltaSeconds, bounds) {
  if (orb.paused || orb.dragging) {
    return { ...orb };
  }

  let x = orb.x + orb.vx * deltaSeconds;
  let y = orb.y + orb.vy * deltaSeconds;
  let vx = orb.vx;
  let vy = orb.vy;

  if (x - orb.r < bounds.left) {
    x = bounds.left + orb.r;
    vx = Math.abs(vx);
  } else if (x + orb.r > bounds.right) {
    x = bounds.right - orb.r;
    vx = -Math.abs(vx);
  }

  if (y - orb.r < bounds.top) {
    y = bounds.top + orb.r;
    vy = Math.abs(vy);
  } else if (y + orb.r > bounds.bottom) {
    y = bounds.bottom - orb.r;
    vy = -Math.abs(vy);
  }

  return { ...orb, x, y, vx, vy };
}

export function advanceOrbCollection(orbs, activeOrbId, deltaSeconds, bounds) {
  return orbs.map((orb) =>
    orb.id === activeOrbId ? orb : advanceOrb(orb, deltaSeconds, bounds),
  );
}
