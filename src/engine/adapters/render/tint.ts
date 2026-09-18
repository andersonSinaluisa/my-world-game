/**
 * Pure, worklet-free helpers of the character renderer (no Skia import: tested in Node).
 */

/** Multiply tint as a 4×5 color matrix (ADR-010): grayscale art × tone, alpha untouched. */
export function tintMatrix(hex: string): number[] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, 0, 0, 0, 0, 0, g, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0];
}

/** Stable per-character phase in [0, 2π) so characters never breathe in sync (HU-GAME-014 R6). */
export function breathPhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 628) / 100;
}
