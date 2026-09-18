import type { Transform } from '../components/base';
import type { Entity } from '../core/entity';
import type { AssetKey } from '../core/types';
import type { BackgroundChunk, BackgroundLayer } from './scene-types';

/**
 * Viewport culling (RENDERING §7, HU-GAME-008). Pure functions.
 */

export const CULLING_MARGIN_RATIO = 0.25;
export const CULLING_RECOMPUTE_RATIO = 0.1;

export interface HorizontalRange {
  x1: number;
  x2: number;
}

export interface Aabb {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type AssetSizeLookup = (key: AssetKey) => { w: number; h: number } | undefined;
/** World transform of an entity (items carried by furniture are relative, HU-GAME-030). */
export type TransformOf = (entity: Entity) => Transform | undefined;

export function cullingRange(cameraX: number, viewportW: number, marginRatio = CULLING_MARGIN_RATIO): HorizontalRange {
  const margin = viewportW * marginRatio;
  return { x1: cameraX - margin, x2: cameraX + viewportW + margin };
}

/** World-space AABB of an entity's sprite (pivot, size or native asset size, scale). */
export function spriteAabb(entity: Entity, assetSize: AssetSizeLookup, transformOf?: TransformOf): Aabb | undefined {
  const sprite = entity.components.sprite;
  const t = transformOf ? transformOf(entity) : entity.components.transform;
  if (!sprite || !t) return undefined;
  const size = sprite.size ?? assetSize(sprite.asset);
  if (!size) return undefined;
  const scale = t.scale ?? 1;
  const w = size.w * scale;
  const h = size.h * scale;
  const pivot = sprite.pivot ?? { x: 0.5, y: 1 };
  const x1 = t.x - pivot.x * w;
  const y1 = t.y - pivot.y * h;
  return { x1, y1, x2: x1 + w, y2: y1 + h };
}

export function intersects(aabb: Aabb, range: HorizontalRange): boolean {
  return aabb.x2 >= range.x1 && aabb.x1 <= range.x2;
}

/** Entities whose AABB intersects the range. Entities without a known size are kept (never hidden by mistake). */
export function cullEntities(entities: Entity[], range: HorizontalRange, assetSize: AssetSizeLookup, transformOf?: TransformOf): Entity[] {
  return entities.filter((e) => {
    const box = spriteAabb(e, assetSize, transformOf);
    return box === undefined || intersects(box, range);
  });
}

/** Screen-relative x of a chunk with parallax: chunk.x − cameraX × parallax (in world units, before the camera group). */
export function visibleChunks(layer: BackgroundLayer, cameraX: number, viewportW: number): BackgroundChunk[] {
  const parallax = layer.parallax ?? 1;
  const range = cullingRange(cameraX * parallax, viewportW);
  return layer.chunks.filter((c) => c.x + c.width >= range.x1 && c.x <= range.x2);
}

/**
 * Decides when the visible set must be recomputed: only when the camera moved more than
 * 10 % of the viewport since the last computation (RENDERING §7), or when forced.
 */
export class CullingTracker {
  private lastCameraX: number | undefined;
  private lastViewportW: number | undefined;

  shouldRecompute(cameraX: number, viewportW: number): boolean {
    if (this.lastCameraX === undefined || this.lastViewportW !== viewportW) return true;
    return Math.abs(cameraX - this.lastCameraX) > viewportW * CULLING_RECOMPUTE_RATIO;
  }

  markComputed(cameraX: number, viewportW: number): void {
    this.lastCameraX = cameraX;
    this.lastViewportW = viewportW;
  }

  reset(): void {
    this.lastCameraX = undefined;
    this.lastViewportW = undefined;
  }
}
