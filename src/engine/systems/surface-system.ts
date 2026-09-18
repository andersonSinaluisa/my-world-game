import type { Entity } from '../core/entity';
import type { Logger } from '../core/runtime';
import type { EntityId, WorldPoint } from '../core/types';
import type { World } from '../core/world';
import { absoluteSegment } from '../scene/geometry';
import { absoluteTransform, canCarry } from '../scene/parenting';
import { sortForRender } from '../scene/render-order';
import { DEFAULT_FLOOR_Y, type ActiveSceneInfo } from '../scene/scene-types';

/** INPUT_SYSTEM §7: dropping up to 40 units below a surface still lands on it. */
export const SURFACE_TOLERANCE = 40;

export interface RestingPlace {
  x: number;
  y: number;
  supporterId?: EntityId;
}

function floorYAt(scene: ActiveSceneInfo, x: number, logger: Logger): number {
  const floor = scene.floor?.length ? scene.floor : [{ y: DEFAULT_FLOOR_Y }];
  const covering = floor.find((s) => (s.x1 ?? -Infinity) <= x && x <= (s.x2 ?? Infinity));
  if (covering) return covering.y;
  // Safety net: the validator forbids floor gaps (SCENE_SCHEMA §3.5b).
  logger.warn(`No floor segment covers x=${x} in ${scene.id}; using the nearest one`);
  let best = floor[0];
  let bestDist = Infinity;
  for (const s of floor) {
    const d = Math.min(Math.abs(x - (s.x1 ?? x)), Math.abs(x - (s.x2 ?? x)));
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best.y;
}

/** Entities that are (transitively) supported by `id` cannot hold it up (HU-GAME-028 R3). */
function carriedBy(world: World, id: EntityId, candidates: Entity[]): Set<EntityId> {
  const carried = new Set<EntityId>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const e of candidates) {
      const sup = world.index.supportOf(e.id);
      if (sup && carried.has(sup) && !carried.has(e.id)) {
        carried.add(e.id);
        grew = true;
      }
    }
  }
  return carried;
}

/**
 * Where an item dropped at `point` comes to rest (HU-GAME-028 R1): the highest surface segment covering x
 * whose y is ≥ point.y − 40, otherwise the floor. `floorOnly` items skip surfaces. x is clamped to the scene.
 */
export function findRestingPlace(
  world: World,
  scene: ActiveSceneInfo,
  itemId: EntityId,
  point: WorldPoint,
  logger: Logger,
): RestingPlace {
  const x = Math.min(Math.max(point.x, 0), scene.size.width);
  const item = world.get(itemId);
  const floorOnly = item?.components.draggable?.mode === 'floorOnly';
  if (!floorOnly) {
    const sceneEntities = world.query({ sceneId: scene.id });
    const excluded = carriedBy(world, itemId, sceneEntities);
    // Front-most first, so ties at the same height resolve to the entity drawn on top.
    const ordered = sortForRender(sceneEntities.filter((e) => e.components.sprite)).reverse();
    const withoutSprite = sceneEntities.filter((e) => !e.components.sprite);
    let best: RestingPlace | undefined;
    for (const e of [...ordered, ...withoutSprite]) {
      if (excluded.has(e.id)) continue;
      const surface = e.components.surface;
      const t = absoluteTransform((id) => world.get(id), e);
      if (!surface || !t) continue;
      for (const seg of surface.segments) {
        const abs = absoluteSegment(seg, t);
        if (x < abs.x1 || x > abs.x2) continue;
        if (abs.y < point.y - SURFACE_TOLERANCE) continue;
        if (!best || abs.y < best.y) best = { x, y: abs.y, supporterId: e.id };
      }
    }
    if (best) return best;
  }
  return { x, y: floorYAt(scene, x, logger) };
}

/** Moves an item to its resting place and updates the derived support index. */
export function placeItem(
  world: World,
  scene: ActiveSceneInfo,
  itemId: EntityId,
  point: WorldPoint,
  logger: Logger,
): RestingPlace | undefined {
  const item = world.get(itemId);
  if (!item) return undefined;
  const rest = findRestingPlace(world, scene, itemId, point, logger);
  const { parentId: _old, ...current } = item.components.transform ?? { x: 0, y: 0 };
  void _old;
  const supporter = rest.supporterId ? world.get(rest.supporterId) : undefined;
  const st = supporter?.components.transform;
  world.transaction(() => {
    // Carriers link the item with coordinates relative to their pivot (HU-GAME-030 R2).
    if (supporter && st && canCarry(world, supporter, item)) {
      world.update(itemId, { transform: { ...current, x: rest.x - st.x, y: rest.y - st.y, parentId: supporter.id } });
    } else {
      world.update(itemId, { transform: { ...current, x: rest.x, y: rest.y } });
    }
    world.setSupport(itemId, rest.supporterId);
  });
  return rest;
}

/**
 * Rebuilds the support index of a scene from geometry (HU-GAME-028 R6): an item rests on a surface when
 * its y matches a segment covering its x. Called after loading a scene; nothing about support is persisted.
 */
export function recomputeSupport(world: World, scene: ActiveSceneInfo): void {
  const entities = world.query({ sceneId: scene.id });
  const surfaces = entities.filter((e) => e.components.surface && e.components.transform);
  const abs = (e: (typeof entities)[number]) => absoluteTransform((id) => world.get(id), e);
  for (const item of entities) {
    const own = item.components.transform;
    // Linked items: parentId is the only source of the relation (HU-GAME-030 R2b).
    if (own?.parentId) {
      world.setSupport(item.id, world.has(own.parentId) ? own.parentId : undefined);
      continue;
    }
    const t = abs(item);
    if (!t || item.components.draggable?.mode === 'floorOnly') {
      world.setSupport(item.id, undefined);
      continue;
    }
    let supporter: EntityId | undefined;
    for (const s of surfaces) {
      if (s.id === item.id) continue;
      for (const seg of s.components.surface!.segments) {
        const a = absoluteSegment(seg, abs(s)!);
        if (t.x >= a.x1 && t.x <= a.x2 && Math.abs(t.y - a.y) < 0.5) supporter = s.id;
      }
    }
    world.setSupport(item.id, supporter);
  }
}
