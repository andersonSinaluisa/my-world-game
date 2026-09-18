import type { Shape, Transform } from '../components/base';
import type { WorldPoint } from '../core/types';

/**
 * Shape geometry in world units. Shapes are relative to the entity pivot (transform.x/y),
 * scaled by transform.scale and mirrored in x by transform.flipX (HU-GAME-026 R2, HU-GAME-028 R2).
 */

export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type WorldShape =
  | { type: 'rect'; rect: Rect }
  | { type: 'circle'; cx: number; cy: number; r: number };

export function toWorldShape(shape: Shape, t: Pick<Transform, 'x' | 'y' | 'scale' | 'flipX'>): WorldShape | undefined {
  const s = t.scale ?? 1;
  const fx = t.flipX ? -1 : 1;
  if (shape.type === 'rect') {
    const a = t.x + fx * shape.x * s;
    const b = t.x + fx * (shape.x + shape.w) * s;
    return {
      type: 'rect',
      rect: { x1: Math.min(a, b), x2: Math.max(a, b), y1: t.y + shape.y * s, y2: t.y + (shape.y + shape.h) * s },
    };
  }
  if (shape.type === 'circle') return { type: 'circle', cx: t.x + fx * shape.x * s, cy: t.y + shape.y * s, r: shape.r * s };
  return undefined; // polygon: DESIGNED FOR LATER
}

/**
 * Expands a shape by `padding`, then grows it (keeping its center) until each axis measures at least
 * `minSize` (HU-GAME-026 R3/R11: minHitDp converted to world units).
 */
export function expandShape(shape: WorldShape, padding: number, minSize: number): WorldShape {
  if (shape.type === 'rect') {
    let { x1, y1, x2, y2 } = shape.rect;
    x1 -= padding;
    x2 += padding;
    y1 -= padding;
    y2 += padding;
    if (x2 - x1 < minSize) {
      const c = (x1 + x2) / 2;
      x1 = c - minSize / 2;
      x2 = c + minSize / 2;
    }
    if (y2 - y1 < minSize) {
      const c = (y1 + y2) / 2;
      y1 = c - minSize / 2;
      y2 = c + minSize / 2;
    }
    return { type: 'rect', rect: { x1, y1, x2, y2 } };
  }
  return { ...shape, r: Math.max(shape.r + padding, minSize / 2) };
}

export function containsPoint(shape: WorldShape, p: WorldPoint): boolean {
  if (shape.type === 'rect') {
    const r = shape.rect;
    return p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2;
  }
  const dx = p.x - shape.cx;
  const dy = p.y - shape.cy;
  return dx * dx + dy * dy <= shape.r * shape.r;
}

export function shapeArea(shape: WorldShape): number {
  if (shape.type === 'rect') return (shape.rect.x2 - shape.rect.x1) * (shape.rect.y2 - shape.rect.y1);
  return Math.PI * shape.r * shape.r;
}

export interface Segment {
  x1: number;
  x2: number;
  y: number;
}

/** Surface segments (relative to the pivot) to absolute world segments. */
export function absoluteSegment(seg: Segment, t: Pick<Transform, 'x' | 'y' | 'scale' | 'flipX'>): Segment {
  const s = t.scale ?? 1;
  const fx = t.flipX ? -1 : 1;
  const a = t.x + fx * seg.x1 * s;
  const b = t.x + fx * seg.x2 * s;
  return { x1: Math.min(a, b), x2: Math.max(a, b), y: t.y + seg.y * s };
}
