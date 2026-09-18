import type { Entity } from '../core/entity';
import type { EntityId, WorldPoint } from '../core/types';
import type { World } from '../core/world';
import { containsPoint, expandShape, shapeArea, toWorldShape } from '../scene/geometry';
import { sortForRender } from '../scene/render-order';

/** HU-GAME-026 R3: default hitbox padding in world units. */
export const DEFAULT_HIT_PADDING = 12;
/** INPUT_SYSTEM §8: minimum touch size of world objects, in dp (converted with the current scale). */
export const MIN_HIT_DP = 44;

export interface HitCandidate {
  id: EntityId;
  /** Zone under the point: smallest-area zone containing it, else "body" (INTERACTION_SYSTEM §3). */
  zone: string;
}

export interface HitTestOptions {
  sceneId: string;
  /** minHitDp converted to world units (44 / scale). Pure: the caller knows the scale. */
  minHitWorld?: number;
  /** Entities that are never candidates (the dragged source and what it carries). */
  exclude?: Set<EntityId>;
  /** Has tap/longPress rules (RuleIndex); decoration without them and without draggable is transparent. */
  hasDirectRules?: (entity: Entity) => boolean;
  /** World transform of an item held by a character of the scene (drawn at its hand anchor, HU-GAME-016). */
  heldTransform?: (entity: Entity) => Entity['components']['transform'] | undefined;
}

function isInteractive(e: Entity, hasDirectRules?: (entity: Entity) => boolean): boolean {
  const d = e.components.draggable;
  if (d && d.enabled !== false) return true;
  return hasDirectRules ? hasDirectRules(e) : false;
}

/** Transform of an entity for hit testing: its own in the scene, or container + slot when shown inside it. */
function effectiveTransform(world: World, e: Entity, options: HitTestOptions) {
  if (e.location.kind === 'scene') return e.components.transform;
  if (e.location.kind === 'held') return options.heldTransform?.(e);
  if (e.location.kind !== 'container') return undefined;
  const container = world.get(e.location.containerId);
  const c = container?.components.container;
  const ct = container?.components.transform;
  if (!container || !c || !ct || container.location.kind !== 'scene') return undefined;
  const openable = container.components.openable;
  const open = !openable || container.components.states?.current === openable.openState;
  const slot = c.slots?.[e.location.slot];
  if (!open || c.showContentsWhenOpen === false || !slot) return undefined;
  return { ...(e.components.transform ?? {}), x: ct.x + slot.x, y: ct.y + slot.y };
}

function zoneAt(e: Entity, t: NonNullable<Entity['components']['transform']>, p: WorldPoint): string {
  let best: { name: string; area: number } | undefined;
  for (const [name, shape] of Object.entries(e.components.hitbox?.zones ?? {})) {
    const ws = toWorldShape(shape, t);
    if (!ws || !containsPoint(ws, p)) continue;
    const area = shapeArea(ws);
    if (!best || area < best.area || (area === best.area && name < best.name)) best = { name, area };
  }
  return best?.name ?? 'body';
}

/**
 * Hit testing in world units (INPUT_SYSTEM §5, HU-GAME-026). Returns interactive candidates front-most
 * first. Items shown inside an open container come before the container itself.
 */
export function hitTest(world: World, point: WorldPoint, options: HitTestOptions): HitCandidate[] {
  const scene = world.query({ sceneId: options.sceneId }).filter((e) => e.components.sprite);
  const contents = world
    .query({ locationKind: 'container' })
    .filter((e) => {
      if (e.location.kind !== 'container') return false;
      const c = world.get(e.location.containerId);
      return c?.location.kind === 'scene' && c.location.sceneId === options.sceneId;
    });
  // Items in a hand are drawn inside their holder's group: they come before the holder (front-most first).
  const held = world.query({ locationKind: 'held' }).filter((e) => {
    const holder = e.location.kind === 'held' ? world.get(e.location.holderId) : undefined;
    return holder?.location.kind === 'scene' && holder.location.sceneId === options.sceneId;
  });
  const ordered = [...contents, ...held, ...sortForRender(scene, { supportOf: world.index.supportOf }).reverse()];
  const out: HitCandidate[] = [];
  for (const e of ordered) {
    if (options.exclude?.has(e.id)) continue;
    const hitbox = e.components.hitbox;
    const t = effectiveTransform(world, e, options);
    if (!hitbox || !t) continue;
    if (!isInteractive(e, options.hasDirectRules)) continue;
    const base = toWorldShape(hitbox.shape, t);
    if (!base) continue;
    const shape = expandShape(base, hitbox.padding ?? DEFAULT_HIT_PADDING, options.minHitWorld ?? 0);
    if (!containsPoint(shape, point)) continue;
    out.push({ id: e.id, zone: zoneAt(e, t, point) });
  }
  return out;
}

/** First candidate for a drag (HU-GAME-026 R5b): the front-most interactive entity must itself be draggable. */
export function pickDraggable(world: World, point: WorldPoint, options: HitTestOptions): EntityId | undefined {
  const first = hitTest(world, point, options)[0];
  if (!first) return undefined;
  const d = world.get(first.id)?.components.draggable;
  return d && d.enabled !== false ? first.id : undefined;
}
