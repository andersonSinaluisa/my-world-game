import { WORLD_HEIGHT } from '../../scene/scene-types';

/**
 * Virtual resolution (ADR-007, RENDERING §2): fixed height of 1080 world units, variable width.
 * Pure and worklet-safe; no Skia import so it runs in Node tests.
 */
export interface Viewport {
  /** dp per world unit. */
  scale: number;
  /** Visible width in world units. */
  viewportW: number;
  canvasWidthDp: number;
  canvasHeightDp: number;
}

export function computeViewport(canvasWidthDp: number, canvasHeightDp: number): Viewport {
  'worklet';
  const scale = canvasHeightDp > 0 ? canvasHeightDp / WORLD_HEIGHT : 1;
  return {
    scale,
    viewportW: canvasWidthDp / scale,
    canvasWidthDp,
    canvasHeightDp,
  };
}
