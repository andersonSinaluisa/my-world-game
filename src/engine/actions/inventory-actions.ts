import { z } from 'zod';

import type { Entity } from '../core/entity';
import type { World } from '../core/world';
import { fail, resolveRole, type ActionHandler, type Check } from './types';

/** MVP backpack size (INVENTORY_SYSTEM §2); the save's player.inventory.capacity wins. */
export const DEFAULT_INVENTORY_CAPACITY = 12;

/** First free backpack slot, or containerFull-like `inventoryFull` (HU-GAME-037 R2, R4). */
export function inventoryCheck(world: World, capacity: number, item: Entity): Check & { slot?: number } {
  // Same anti-nesting rule as containers (INVENTORY_SYSTEM §2).
  if (item.components.container) return fail('notAccepted');
  const occupied = world.index.inventory();
  for (let slot = 0; slot < capacity; slot++) if (!occupied[slot] || occupied[slot] === item.id) return { ok: true, slot };
  return fail('inventoryFull');
}

const Params = z.strictObject({ item: z.enum(['$source', '$target']).default('$source') });

/** Location → inventory, first free slot (INTERACTION_SCHEMA §5). One transaction even from a hand. */
export const addToInventoryAction: ActionHandler<z.infer<typeof Params>> = {
  type: 'addToInventory',
  params: Params,
  validate(ctx, p) {
    const item = resolveRole(ctx, p.item);
    if (!item) return fail('entityNotFound');
    return inventoryCheck(ctx.env.world, ctx.env.inventoryCapacity(), item);
  },
  execute(ctx, p) {
    const item = resolveRole(ctx, p.item)!;
    const { slot } = inventoryCheck(ctx.env.world, ctx.env.inventoryCapacity(), item) as { slot: number };
    const { parentId: _parent, ...t } = item.components.transform ?? { x: 0, y: 0 };
    void _parent;
    ctx.env.world.transaction(() => {
      if (item.components.transform?.parentId) ctx.env.world.update(item.id, { transform: t });
      ctx.env.world.setSupport(item.id, undefined);
      ctx.env.locations.move(item.id, { kind: 'inventory', slot });
    });
  },
};

