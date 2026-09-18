import { z } from 'zod';

import type { Entity } from '../core/entity';
import type { EntityId } from '../core/types';
import type { World } from '../core/world';
import { fail, PASS, resolveRole, type ActionHandler, type Check, type InteractionContext } from './types';

const Role = z.enum(['$source', '$target']);

/** Default `rejects` of a container (ENTITY_SCHEMA §5.8). */
export const DEFAULT_REJECTS = ['character', 'furniture'];

/**
 * Can `item` go into `container` (HU-GAME-035 R2, R7)? Tag filters first (notAccepted), then space
 * (containerFull). Entities that are containers themselves never go into another one.
 */
export function storeCheck(world: World, container: Entity, item: Entity): Check & { slot?: number } {
  const c = container.components.container;
  if (!c) return fail('notContainer');
  if (item.components.container || item.id === container.id) return fail('notAccepted');
  if (c.accepts && !c.accepts.some((t) => item.tags.includes(t))) return fail('notAccepted');
  if ((c.rejects ?? DEFAULT_REJECTS).some((t) => item.tags.includes(t))) return fail('notAccepted');
  const occupied = world.index.inContainer(container.id);
  for (let slot = 0; slot < c.capacity; slot++) if (!occupied[slot] || occupied[slot] === item.id) return { ok: true, slot };
  return fail('containerFull');
}

/** Open / closed by `openable` (no openable = always open, INTERACTION_SCHEMA §4). */
export function isOpenEntity(e: Entity): boolean {
  const o = e.components.openable;
  return !o || e.components.states?.current === o.openState;
}

// ---------- open / close / toggleOpen (HU-GAME-034) ----------

const EntityParams = z.strictObject({ entity: Role.default('$target') });

function setOpen(ctx: InteractionContext, id: EntityId, open: boolean): void {
  const e = ctx.env.world.get(id)!;
  const o = e.components.openable!;
  const state = open ? o.openState : o.closedState;
  if (e.components.states!.current === state) return;
  ctx.env.world.update(id, { states: { ...e.components.states!, current: state } });
  ctx.env.effects.trigger(id, open ? 'open' : 'close');
}

function validateOpenable(ctx: InteractionContext, role: '$source' | '$target'): Check {
  const e = resolveRole(ctx, role);
  if (!e) return fail('entityNotFound');
  if (!e.components.openable || !e.components.states) return fail('notOpenable');
  return PASS;
}

export const toggleOpenAction: ActionHandler<z.infer<typeof EntityParams>> = {
  type: 'toggleOpen',
  params: EntityParams,
  validate: (ctx, p) => validateOpenable(ctx, p.entity),
  execute(ctx, p) {
    const e = resolveRole(ctx, p.entity)!;
    setOpen(ctx, e.id, !isOpenEntity(e));
  },
};

export const openAction: ActionHandler<z.infer<typeof EntityParams>> = {
  type: 'open',
  params: EntityParams,
  validate: (ctx, p) => validateOpenable(ctx, p.entity),
  execute: (ctx, p) => setOpen(ctx, resolveRole(ctx, p.entity)!.id, true),
};

export const closeAction: ActionHandler<z.infer<typeof EntityParams>> = {
  type: 'close',
  params: EntityParams,
  validate: (ctx, p) => validateOpenable(ctx, p.entity),
  execute: (ctx, p) => setOpen(ctx, resolveRole(ctx, p.entity)!.id, false),
};

// ---------- toggleSwitch (HU-GAME-047) ----------

export const toggleSwitchAction: ActionHandler<z.infer<typeof EntityParams>> = {
  type: 'toggleSwitch',
  params: EntityParams,
  validate(ctx, p) {
    const e = resolveRole(ctx, p.entity);
    if (!e) return fail('entityNotFound');
    if (!e.components.switchable || !e.components.states) return fail('notSwitchable');
    return PASS;
  },
  execute(ctx, p) {
    const e = resolveRole(ctx, p.entity)!;
    const s = e.components.switchable!;
    const next = e.components.states!.current === s.onState ? s.offState : s.onState;
    ctx.env.world.update(e.id, { states: { ...e.components.states!, current: next } });
    ctx.env.effects.trigger(e.id, 'use');
  },
};

// ---------- store (HU-GAME-035) ----------

const StoreParams = z.strictObject({ item: Role.default('$source'), container: Role.default('$target') });

export const storeAction: ActionHandler<z.infer<typeof StoreParams>> = {
  type: 'store',
  params: StoreParams,
  validate(ctx, p) {
    const item = resolveRole(ctx, p.item);
    const container = resolveRole(ctx, p.container);
    if (!item || !container) return fail('entityNotFound');
    return storeCheck(ctx.env.world, container, item);
  },
  execute(ctx, p) {
    const item = resolveRole(ctx, p.item)!;
    const container = resolveRole(ctx, p.container)!;
    const { slot } = storeCheck(ctx.env.world, container, item) as { slot: number };
    const { parentId: _parent, ...t } = item.components.transform ?? { x: 0, y: 0 };
    void _parent;
    ctx.env.world.transaction(() => {
      if (item.components.transform?.parentId) ctx.env.world.update(item.id, { transform: t });
      ctx.env.world.setSupport(item.id, undefined);
      // One transaction even from a hand (HU-GAME-035 R8): the move frees the hand slot.
      ctx.env.locations.move(item.id, { kind: 'container', containerId: container.id, slot });
    });
  },
};
