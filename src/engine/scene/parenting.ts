import type { Transform } from '../components/base';
import type { Entity } from '../core/entity';
import type { EntityId } from '../core/types';
import type { World } from '../core/world';

/**
 * Items carried by furniture (HU-GAME-030): `transform.parentId` + coordinates relative to the parent's
 * pivot. Only surfaces with `carriesItems` link, and only one level deep (R6). Everything that needs a
 * world position (render, hit test, surfaces, culling) goes through `absoluteTransform`.
 */

export type EntityLookup = (id: EntityId) => Entity | undefined;

/** World-space transform: parent + relative for linked items; the transform itself otherwise (R3). */
export function absoluteTransform(get: EntityLookup, e: Entity): Transform | undefined {
  const t = e.components.transform;
  if (!t?.parentId) return t;
  const parent = get(t.parentId);
  const p = parent?.components.transform;
  if (!p) return t;
  const { parentId: _p, ...rest } = t;
  void _p;
  return { ...rest, x: p.x + t.x, y: p.y + t.y };
}

export function childrenOf(world: World, parentId: EntityId): Entity[] {
  return world.all().filter((e) => e.components.transform?.parentId === parentId);
}

export function hasChildren(world: World, id: EntityId): boolean {
  return world.all().some((e) => e.components.transform?.parentId === id);
}

/** Can `item` be linked to `supporter`? Only carriers, depth 1, no characters (R1, R6). */
export function canCarry(world: World, supporter: Entity, item: Entity): boolean {
  if (!supporter.components.surface?.carriesItems) return false;
  if (supporter.components.transform?.parentId) return false;
  if (item.components.character || hasChildren(world, item.id)) return false;
  return supporter.id !== item.id;
}

/** Turns a linked item back into absolute coordinates (R5, R7). Returns the absolute transform. */
export function unlink(world: World, id: EntityId): Transform | undefined {
  const e = world.get(id);
  if (!e?.components.transform?.parentId) return e?.components.transform;
  const abs = absoluteTransform((x) => world.get(x), e)!;
  world.update(id, { transform: abs });
  return abs;
}
