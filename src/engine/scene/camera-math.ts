import type { SceneBounds } from './scene-types';

/**
 * Horizontal camera limits (RENDERING §5, HU-GAME-007).
 * cameraX ∈ [minX, maxX − viewportW]. If the scene is narrower than the viewport, the camera is fixed
 * so the scene appears centered (cameraX may then be negative).
 * Pure worklet-safe function: usable from the UI thread.
 */
export function clampCameraX(x: number, bounds: SceneBounds, viewportW: number): number {
  'worklet';
  const sceneWidth = bounds.maxX - bounds.minX;
  if (sceneWidth <= viewportW) return bounds.minX + (sceneWidth - viewportW) / 2;
  return Math.min(Math.max(x, bounds.minX), bounds.maxX - viewportW);
}

/** Camera target that centers `x` in the viewport, clamped (RENDERING §5 "saltar a una zona"). */
export function cameraTargetFor(x: number, bounds: SceneBounds, viewportW: number): number {
  'worklet';
  return clampCameraX(x - viewportW / 2, bounds, viewportW);
}

export const CAMERA_JUMP_MS = 450;
