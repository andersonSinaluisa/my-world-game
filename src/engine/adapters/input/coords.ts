/**
 * Screen (dp) ↔ world (units) conversion (INPUT_SYSTEM §4). Only adapters know about dp.
 * Worklet-safe pure functions.
 */
export function screenToWorld(xDp: number, yDp: number, scale: number, cameraX: number): { x: number; y: number } {
  'worklet';
  return { x: xDp / scale + cameraX, y: yDp / scale };
}

export function worldToScreen(x: number, y: number, scale: number, cameraX: number): { x: number; y: number } {
  'worklet';
  return { x: (x - cameraX) * scale, y: y * scale };
}

/** dp distance → world units (e.g. drag/pan thresholds, minHitDp). */
export function dpToWorld(dp: number, scale: number): number {
  'worklet';
  return dp / scale;
}
