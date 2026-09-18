import { z } from 'zod';

import { chooseHand } from '../../actions/character-actions';
import { storeCheck } from '../../actions/container-actions';
import { inventoryCheck } from '../../actions/inventory-actions';
import { fail, PASS, resolveRole, type ConditionHandler } from '../../actions/types';

const Role = z.enum(['$source', '$target']);

const StateIsParams = z.strictObject({ type: z.literal('stateIs'), of: Role.default('$target'), state: z.string().min(1) });
const IsOpenParams = z.strictObject({ type: z.literal('isOpen'), of: Role.default('$target') });

export const stateIs: ConditionHandler<z.infer<typeof StateIsParams>> = {
  type: 'stateIs',
  params: StateIsParams,
  evaluate(ctx, p) {
    const e = resolveRole(ctx, p.of);
    return e?.components.states?.current === p.state ? PASS : fail('stateIs');
  },
};

/** Passes when the entity has no `openable` (always open) or is in its openState (INTERACTION_SCHEMA §4). */
export const isOpen: ConditionHandler<z.infer<typeof IsOpenParams>> = {
  type: 'isOpen',
  params: IsOpenParams,
  evaluate(ctx, p) {
    const e = resolveRole(ctx, p.of);
    if (!e) return fail('entityNotFound');
    const openable = e.components.openable;
    if (!openable) return PASS;
    return e.components.states?.current === openable.openState ? PASS : fail('isOpen');
  },
};

const HandFreeParams = z.strictObject({ type: z.literal('handFree'), of: Role.default('$target') });

/** At least one free hand; with a hand zone, that hand or the other one (HU-GAME-016 R2). */
export const handFree: ConditionHandler<z.infer<typeof HandFreeParams>> = {
  type: 'handFree',
  params: HandFreeParams,
  evaluate(ctx, p) {
    const e = resolveRole(ctx, p.of);
    if (!e?.components.holder) return fail('handFree');
    return chooseHand(ctx.env.world, e, ctx.zone) ? PASS : fail('handFree');
  },
};

const ContainerHasSpaceParams = z.strictObject({ type: z.literal('containerHasSpace'), of: Role.default('$target') });

/** A free slot and the source's tags accepted (HU-GAME-035 R2). Reasons: containerFull, notAccepted. */
export const containerHasSpace: ConditionHandler<z.infer<typeof ContainerHasSpaceParams>> = {
  type: 'containerHasSpace',
  params: ContainerHasSpaceParams,
  evaluate(ctx, p) {
    const container = resolveRole(ctx, p.of);
    const item = ctx.sourceId ? ctx.env.world.get(ctx.sourceId) : undefined;
    if (!container || !item) return fail('entityNotFound');
    const r = storeCheck(ctx.env.world, container, item);
    return r.ok ? PASS : fail(r.reason);
  },
};

const InventoryHasSpaceParams = z.strictObject({ type: z.literal('inventoryHasSpace') });

/** A free backpack slot for the source (HU-GAME-037). Reason: inventoryFull (or notAccepted for containers). */
export const inventoryHasSpace: ConditionHandler<z.infer<typeof InventoryHasSpaceParams>> = {
  type: 'inventoryHasSpace',
  params: InventoryHasSpaceParams,
  evaluate(ctx) {
    const item = ctx.sourceId ? ctx.env.world.get(ctx.sourceId) : undefined;
    if (!item) return fail('entityNotFound');
    const r = inventoryCheck(ctx.env.world, ctx.env.inventoryCapacity(), item);
    return r.ok ? PASS : fail(r.reason);
  },
};

const IsPurchasedParams = z.strictObject({
  type: z.literal('isPurchased'),
  item: Role.default('$source'),
  value: z.boolean().default(true),
  ifMissing: z.boolean().default(true),
});

/** purchasable.purchased === value; without purchasable → ifMissing (INTERACTION_SCHEMA §4). */
export const isPurchased: ConditionHandler<z.infer<typeof IsPurchasedParams>> = {
  type: 'isPurchased',
  params: IsPurchasedParams,
  evaluate(ctx, p) {
    const e = resolveRole(ctx, p.item);
    if (!e) return fail('entityNotFound');
    const purchasable = e.components.purchasable;
    const result = purchasable ? (purchasable.purchased ?? false) === p.value : p.ifMissing;
    return result ? PASS : fail('notPurchased');
  },
};

/** Closed set of conditions (INTERACTION_SCHEMA §4). No expressions, no scripting. */
export const CONDITIONS: Record<string, ConditionHandler<never>> = Object.fromEntries(
  [stateIs, isOpen, handFree, containerHasSpace, inventoryHasSpace, isPurchased].map((c) => [c.type, c as unknown as ConditionHandler<never>]),
);

export const CONDITION_TYPES = Object.keys(CONDITIONS);
