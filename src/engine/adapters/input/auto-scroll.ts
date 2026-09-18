/**
 * Camera auto-scroll while dragging near a screen edge (RENDERING §5, HU-GAME-029). Worklet-safe and pure.
 */

/** R1: the edge zone is 12 % of the screen width on each side. */
export const AUTO_SCROLL_ZONE_RATIO = 0.12;
/** R2: maximum speed, in world units per second. */
export const AUTO_SCROLL_MAX_SPEED = 1400;

/**
 * Signed speed (units/s) for a finger at `xDp` on a screen `widthDp` wide: linear with the depth inside
 * the edge zone, 0 at its inner border, max at the edge. Negative = towards the left.
 */
export function autoScrollVelocity(xDp: number, widthDp: number): number {
  'worklet';
  const zone = widthDp * AUTO_SCROLL_ZONE_RATIO;
  if (!(zone > 0)) return 0;
  const right = zone - (widthDp - xDp);
  if (right > 0) return (AUTO_SCROLL_MAX_SPEED * Math.min(right, zone)) / zone;
  const left = zone - xDp;
  if (left > 0) return (-AUTO_SCROLL_MAX_SPEED * Math.min(left, zone)) / zone;
  return 0;
}

/** R3: frame-rate independent step, clamped to [minX, maxX]. */
export function autoScrollStep(cameraX: number, velocity: number, dtMs: number, minX: number, maxX: number): number {
  'worklet';
  return Math.min(Math.max(cameraX + (velocity * dtMs) / 1000, minX), maxX);
}
