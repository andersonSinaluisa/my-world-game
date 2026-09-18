import { z } from 'zod';

import type { Entity } from '../core/entity';
import type { EntityId, PrefabId } from '../core/types';
import { placeItem } from '../systems/surface-system';
import { chooseHand } from './character-actions';
import { fail, PASS, resolveRole, type ActionHandler, type Check, type InteractionContext } from './types';

const Role = z.enum(['$source', '$target']);

/** HU-GAME-044 R3: default spawner limit. */
export const DEFAULT_MAX_ALIVE = 3;

type Kind = 'edible' | 'drinkable';

function left(e: Entity, kind: Kind): number | undefined {
  if (kind === 'edible') return e.components.edible ? (e.components.edible.bitesLeft ?? e.components.edible.bites) : undefined;
  return e.components.drinkable ? (e.components.drinkable.sipsLeft ?? e.components.drinkable.sips) : undefined;
}

/**
 * Puts an item in the eater's free hand (right first, CHARACTER_SYSTEM §6), else at their feet
 * (HU-GAME-042 R6). Used after a bite and for the result of `replace`.
 */
function toHandOrFeet(ctx: InteractionContext, eater: Entity, itemId: EntityId): void {
  const hand = chooseHand(ctx.env.world, eater, undefined);
  if (hand) {
    ctx.env.world.setSupport(itemId, undefined);
    ctx.env.locations.move(itemId, { kind: 'held', holderId: eater.id, hand });
    return;
  }
  const t = eater.components.transform ?? { x: 0, y: 960 };
  const at = { x: Math.min(t.x + 70, ctx.env.scene.size.width), y: t.y };
  const sceneId = eater.location.kind === 'scene' ? eater.location.sceneId : ctx.env.scene.id;
  ctx.env.locations.move(itemId, { kind: 'scene', sceneId });
  ctx.env.world.update(itemId, { transform: { x: at.x, y: at.y } });
  if (sceneId === ctx.env.scene.id) placeItem(ctx.env.world, ctx.env.scene, itemId, at, ctx.env.logger);
}

function consumeValidate(ctx: InteractionContext, kind: Kind, itemRole: '$source' | '$target', eaterRole: '$source' | '$target'): Check {
  const item = resolveRole(ctx, itemRole);
  const eater = resolveRole(ctx, eaterRole);
  if (!item || !eater) return fail('entityNotFound');
  if (!eater.components.character) return fail('notCharacter');
  const n = left(item, kind);
  if (n === undefined || n <= 0) return fail(kind === 'edible' ? 'notEdible' : 'notDrinkable');
  const finish = item.components[kind]?.onFinish;
  if (n === 1 && finish?.type === 'replace' && !ctx.env.instantiate(finish.prefabId, item)) return fail('unknownPrefab');
  return PASS;
}

/**
 * ConsumeSystem (HU-GAME-042/043): one bite or sip, a temporary eat/drink pose with yum, then the food goes
 * to a free hand or the feet; at 0 onFinish applies (remove by default, or replace with a new prefab).
 */
function consumeExecute(ctx: InteractionContext, kind: Kind, item: Entity, eater: Entity): void {
  const world = ctx.env.world;
  const n = left(item, kind)! - 1;
  const component = item.components[kind]!;
  world.transaction(() => {
    if (n > 0) {
      world.update(item.id, kind === 'edible' ? { edible: { ...item.components.edible!, bitesLeft: n } } : { drinkable: { ...item.components.drinkable!, sipsLeft: n } });
      toHandOrFeet(ctx, eater, item.id);
      return;
    }
    const finish = component.onFinish ?? { type: 'remove' as const };
    // Scene-declared ids are recorded as removed by the save; runtime ones just disappear (SAVE_SCHEMA §4).
    world.remove(item.id);
    if (finish.type === 'replace') {
      const init = ctx.env.instantiate(finish.prefabId as PrefabId, item)!;
      const t = eater.components.transform ?? { x: 0, y: 960 };
      const sceneId = eater.location.kind === 'scene' ? eater.location.sceneId : ctx.env.scene.id;
      world.create({ ...init, location: { kind: 'scene', sceneId }, components: { ...init.components, transform: { x: t.x, y: t.y } } });
      toHandOrFeet(ctx, eater, init.id);
    }
  });
  ctx.env.characters.playTemporaryPose(eater.id, kind === 'edible' ? 'eat' : 'drink');
  ctx.env.effects.trigger(eater.id, 'use');
}

const EatParams = z.strictObject({ food: Role.default('$source'), eater: Role.default('$target') });
export const eatAction: ActionHandler<z.infer<typeof EatParams>> = {
  type: 'eat',
  params: EatParams,
  validate: (ctx, p) => consumeValidate(ctx, 'edible', p.food, p.eater),
  execute: (ctx, p) => consumeExecute(ctx, 'edible', resolveRole(ctx, p.food)!, resolveRole(ctx, p.eater)!),
};

const DrinkParams = z.strictObject({ drink: Role.default('$source'), drinker: Role.default('$target') });
export const drinkAction: ActionHandler<z.infer<typeof DrinkParams>> = {
  type: 'drink',
  params: DrinkParams,
  validate: (ctx, p) => consumeValidate(ctx, 'drinkable', p.drink, p.drinker),
  execute: (ctx, p) => consumeExecute(ctx, 'drinkable', resolveRole(ctx, p.drink)!, resolveRole(ctx, p.drinker)!),
};

/** Live instances of a spawner: spawnedFrom = spawner, anywhere, not in limbo (HU-GAME-044 R4). */
export function aliveFrom(ctx: Pick<InteractionContext, 'env'>, spawnerId: EntityId): number {
  return ctx.env.world.all().filter((e) => e.components.spawnedFrom?.spawnerId === spawnerId && e.location.kind !== 'limbo').length;
}

const SpawnParams = z.strictObject({ spawner: Role.default('$target') });

/** SpawnSystem: a new rt_ instance next to the spawner, resting on a surface or the floor (HU-GAME-044 R2). */
export const spawnAction: ActionHandler<z.infer<typeof SpawnParams>> = {
  type: 'spawn',
  params: SpawnParams,
  validate(ctx, p) {
    const s = resolveRole(ctx, p.spawner);
    const spec = s?.components.spawner;
    if (!s || !spec) return fail('notSpawner');
    if (!ctx.env.instantiate(spec.prefabId, s)) return fail('unknownPrefab');
    return aliveFrom(ctx, s.id) < (spec.maxAlive ?? DEFAULT_MAX_ALIVE) ? PASS : fail('belowMax');
  },
  execute(ctx, p) {
    const s = resolveRole(ctx, p.spawner)!;
    const spec = s.components.spawner!;
    const init = ctx.env.instantiate(spec.prefabId, s)!;
    const t = s.components.transform ?? { x: 0, y: 960 };
    const at = { x: t.x + (spec.spawnOffset?.x ?? 0), y: t.y + (spec.spawnOffset?.y ?? 0) };
    ctx.env.world.transaction(() => {
      ctx.env.world.create({
        ...init,
        location: { kind: 'scene', sceneId: ctx.env.scene.id },
        components: { ...init.components, transform: { x: at.x, y: at.y }, spawnedFrom: { spawnerId: s.id } },
      });
      placeItem(ctx.env.world, ctx.env.scene, init.id, at, ctx.env.logger);
      ctx.env.world.emit({ type: 'visualEffect', entityId: init.id, preset: 'bounce' });
    });
    ctx.env.effects.trigger(s.id, 'use');
  },
};
