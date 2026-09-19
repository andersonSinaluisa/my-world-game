import { z } from 'zod';

import type { Purchasable } from '../components/base';
import type { Entity } from '../core/entity';
import type { EntityId } from '../core/types';
import { placeItem } from '../systems/surface-system';
import { fail, PASS, resolveRole, type ActionEnv, type ActionHandler, type InteractionContext } from './types';

const Role = z.enum(['$source', '$target']);

/** Wallet cap: the counter shows at most 3 digits (HU-GAME-065 RN-3). */
export const MAX_COINS = 999;

/** An unpaid product (purchasable.purchased === false). Items without purchasable belong to the player. */
export const isUnpaid = (e: Entity | undefined) => e?.components.purchasable?.purchased === false;

/**
 * Puts an unpaid product back where the store shows it (ENTITY_SCHEMA §5.14): its shelf point or its
 * container slot. Used by the returnToOrigin fallback and when a product would leave the store. Paid items
 * are the player's: they never go back (false, the caller places them instead).
 */
export function returnToOrigin(env: ActionEnv, id: EntityId): boolean {
  const e = env.world.get(id);
  const origin = e?.components.purchasable?.origin;
  if (!e || !origin || !isUnpaid(e)) return false;
  if ('containerId' in origin) {
    if (!env.world.has(origin.containerId)) return false;
    const taken = env.world.index.inContainer(origin.containerId)[origin.slot];
    if (taken && taken !== id) return false;
    env.locations.move(id, { kind: 'container', containerId: origin.containerId, slot: origin.slot });
    return true;
  }
  if (e.location.kind !== 'scene' || e.location.sceneId !== env.scene.id) env.locations.move(id, { kind: 'scene', sceneId: env.scene.id });
  const t = env.world.get(id)!.components.transform ?? { x: origin.x, y: origin.y };
  env.world.update(id, { transform: { ...t, x: origin.x, y: origin.y } });
  placeItem(env.world, env.scene, id, { x: origin.x, y: origin.y - 1 }, env.logger);
  return true;
}

const PurchaseParams = z.strictObject({ item: Role.default('$source'), register: Role.default('$target') });

/** EconomySystem: pay at the register (HU-GAME-066). Coins go down, the product becomes the player's. */
export const purchaseAction: ActionHandler<z.infer<typeof PurchaseParams>> = {
  type: 'purchase',
  params: PurchaseParams,
  validate(ctx, p) {
    const item = resolveRole(ctx, p.item);
    if (!item || !resolveRole(ctx, p.register)) return fail('entityNotFound');
    const spec = item.components.purchasable;
    if (!spec) return fail('notPurchasable');
    if (spec.purchased) return fail('alreadyPurchased');
    return ctx.env.wallet.coins() >= spec.price ? PASS : fail('canAfford');
  },
  execute(ctx, p) {
    const item = resolveRole(ctx, p.item)!;
    const spec = item.components.purchasable!;
    const env = ctx.env;
    env.world.transaction(() => {
      env.wallet.add(-spec.price);
      env.world.update(item.id, { purchasable: { ...spec, purchased: true } });
      // On the counter of the register (RN-2): place at the drop point finds its surface.
      if (env.world.get(item.id)?.location.kind === 'scene') placeItem(env.world, env.scene, item.id, ctx.point, env.logger);
      if (spec.restock !== false) restock(ctx, item, spec);
    });
  },
};

/** A fresh unpaid copy at the product's origin: infinite, simple stock for the MVP (ENTITY_SCHEMA §5.14). */
function restock(ctx: InteractionContext, item: Entity, spec: Purchasable): void {
  const env = ctx.env;
  const origin = spec.origin;
  if (!origin) return;
  const base = item.prefabId ? env.instantiate(item.prefabId, item) : undefined;
  if (!base) return;
  const copy = {
    ...base,
    tags: [...item.tags],
    components: { ...base.components, ...pickCopy(item), purchasable: { ...spec, purchased: false } },
  };
  if ('containerId' in origin) {
    const taken = env.world.index.inContainer(origin.containerId)[origin.slot];
    if (taken || !env.world.has(origin.containerId)) return;
    env.world.create({ ...copy, location: { kind: 'container', containerId: origin.containerId, slot: origin.slot } });
    return;
  }
  const created = env.world.create({ ...copy, location: { kind: 'scene', sceneId: env.scene.id }, components: { ...copy.components, transform: { x: origin.x, y: origin.y } } });
  if (created) placeItem(env.world, env.scene, copy.id, { x: origin.x, y: origin.y - 1 }, env.logger);
}

/** Content overrides of the product that the prefab lacks (sprite variants, sizes…), without player state. */
function pickCopy(item: Entity): Record<string, unknown> {
  const c = item.components as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of ['sprite', 'hitbox', 'draggable', 'animations', 'sounds', 'wearable']) if (c[key] !== undefined) out[key] = c[key];
  return out;
}

const CollectParams = z.strictObject({ entity: Role.default('$target') });

/** EconomySystem: a hidden coin (or any collectible) gives its reward and disappears for good (HU-GAME-067). */
export const collectAction: ActionHandler<z.infer<typeof CollectParams>> = {
  type: 'collect',
  params: CollectParams,
  validate(ctx, p) {
    const e = resolveRole(ctx, p.entity);
    if (!e) return fail('entityNotFound');
    return e.components.collectible ? PASS : fail('notCollectible');
  },
  execute(ctx, p) {
    const e = resolveRole(ctx, p.entity)!;
    const reward = e.components.collectible!.reward;
    ctx.env.world.transaction(() => {
      if (reward.coins) ctx.env.wallet.add(reward.coins);
      if (reward.prefabId) {
        const init = ctx.env.instantiate(reward.prefabId, e);
        const t = e.components.transform ?? { x: ctx.point.x, y: ctx.point.y };
        if (init) ctx.env.world.create({ ...init, location: { kind: 'scene', sceneId: ctx.env.scene.id }, components: { ...init.components, transform: { x: t.x, y: t.y } } });
      }
      // Declared ids are recorded in entity_removed by the save (SAVE_SCHEMA §4).
      ctx.env.world.remove(e.id);
    });
  },
};
