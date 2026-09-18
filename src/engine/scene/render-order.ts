import { RENDER_LAYERS, type RenderLayer } from '../components/base';
import type { Entity } from '../core/entity';
import type { EntityId } from '../core/types';

/**
 * Render ordering (RENDERING §4, HU-GAME-006). Pure: the render adapter only consumes the result.
 * Order: layer (semantic) → per-layer key → id (stable final tie-break).
 */

const LAYER_INDEX: Record<RenderLayer, number> = Object.fromEntries(RENDER_LAYERS.map((l, i) => [l, i])) as Record<
  RenderLayer,
  number
>;

export interface RenderOrderContext {
  /** Entity supporting another one (SurfaceSystem, HU-GAME-028). Absent until then. */
  supportOf?: (id: EntityId) => EntityId | undefined;
  /** World transform (items carried by furniture are relative to it, HU-GAME-030). */
  transformOf?: (entity: Entity) => Entity['components']['transform'];
}

/** Returns [primary, secondary] keys for ordering inside a layer. */
function layerKeys(entity: Entity, ctx: RenderOrderContext, getEntity: (id: EntityId) => Entity | undefined): [number, number] {
  const sprite = entity.components.sprite!;
  const t = ctx.transformOf ? ctx.transformOf(entity) : entity.components.transform;
  const z = sprite.z ?? 0;
  const x = t?.x ?? 0;
  const y = t?.y ?? 0;
  switch (sprite.layer) {
    case 'wallDecor':
      return [z, x];
    case 'furniture':
      return [z, y];
    case 'props': {
      const supportId = ctx.supportOf?.(entity.id);
      const support = supportId ? getEntity(supportId) : undefined;
      const supportZ = support?.components.sprite?.z ?? 0;
      // Supported props: max(own z, support z + 1) as tie-break after y (RENDERING §4 "regla de apoyo").
      return [y, support ? Math.max(z, supportZ + 1) : z];
    }
    case 'characters':
      return [y, z];
    default:
      return [z, 0];
  }
}

export function compareRenderOrder(
  a: Entity,
  b: Entity,
  ctx: RenderOrderContext = {},
  getEntity: (id: EntityId) => Entity | undefined = () => undefined,
): number {
  const la = LAYER_INDEX[a.components.sprite!.layer];
  const lb = LAYER_INDEX[b.components.sprite!.layer];
  if (la !== lb) return la - lb;
  const [a1, a2] = layerKeys(a, ctx, getEntity);
  const [b1, b2] = layerKeys(b, ctx, getEntity);
  if (a1 !== b1) return a1 - b1;
  if (a2 !== b2) return a2 - b2;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Entities drawn as standalone sprites: in a scene, with a sprite (HU-GAME-006 R4). */
export function isRenderable(entity: Entity, sceneId: string): boolean {
  return entity.location.kind === 'scene' && entity.location.sceneId === sceneId && entity.components.sprite !== undefined;
}

export function sortForRender(entities: Entity[], ctx: RenderOrderContext = {}): Entity[] {
  const byId = new Map(entities.map((e) => [e.id, e]));
  return [...entities].sort((a, b) => compareRenderOrder(a, b, ctx, (id) => byId.get(id)));
}
