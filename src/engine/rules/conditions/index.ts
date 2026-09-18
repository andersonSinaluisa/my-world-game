import { z } from 'zod';

import { chooseHand } from '../../actions/character-actions';
import { storeCheck } from '../../actions/container-actions';
import { inventoryCheck } from '../../actions/inventory-actions';
import { canWearCheck, ZONE_SLOT } from '../../actions/outfit-actions';
import { seatIsFree, seatSpec } from '../../actions/seat-actions';
import { aliveFrom, DEFAULT_MAX_ALIVE } from '../../actions/consume-actions';
import { POSES } from '../../components/base';
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

const CanWearParams = z.strictObject({ type: z.literal('canWear'), item: Role.default('$source'), character: Role.default('$target') });

/** The garment has a slot and sprites for the character's body (HU-GAME-039 R2). */
export const canWear: ConditionHandler<z.infer<typeof CanWearParams>> = {
  type: 'canWear',
  params: CanWearParams,
  evaluate(ctx, p) {
    const item = resolveRole(ctx, p.item);
    const character = resolveRole(ctx, p.character);
    return item && character ? canWearCheck(item, character) : fail('entityNotFound');
  },
};

const SlotWornParams = z.strictObject({ type: z.literal('slotWorn'), of: Role.default('$target') });

/** There is a garment in the slot of the touched band: torso → top, legs → bottom, feet → shoes. */
export const slotWorn: ConditionHandler<z.infer<typeof SlotWornParams>> = {
  type: 'slotWorn',
  params: SlotWornParams,
  evaluate(ctx, p) {
    const c = resolveRole(ctx, p.of);
    const slot = ctx.zone ? ZONE_SLOT[ctx.zone] : undefined;
    return c && slot && ctx.env.world.index.wornBy(c.id)[slot] ? PASS : fail('slotWorn');
  },
};

const PoseIsNotParams = z.strictObject({ type: z.literal('poseIsNot'), of: Role.default('$target'), poses: z.array(z.enum(POSES)).min(1) });

/** The character's pose is not in the list (no eating while asleep, HU-GAME-042 R7b). */
export const poseIsNot: ConditionHandler<z.infer<typeof PoseIsNotParams>> = {
  type: 'poseIsNot',
  params: PoseIsNotParams,
  evaluate(ctx, p) {
    const e = resolveRole(ctx, p.of);
    const pose = e?.components.pose?.current;
    return pose && p.poses.includes(pose) ? fail('poseIsNot') : PASS;
  },
};

const BelowMaxParams = z.strictObject({ type: z.literal('belowMax'), of: Role.default('$target') });

/** Live instances of this spawner < maxAlive (default 3, HU-GAME-044 R3). */
export const belowMax: ConditionHandler<z.infer<typeof BelowMaxParams>> = {
  type: 'belowMax',
  params: BelowMaxParams,
  evaluate(ctx, p) {
    const s = resolveRole(ctx, p.of);
    const spec = s?.components.spawner;
    if (!s || !spec) return fail('notSpawner');
    return aliveFrom(ctx, s.id) < (spec.maxAlive ?? DEFAULT_MAX_ALIVE) ? PASS : fail('belowMax');
  },
};

const SeatFreeParams = z.strictObject({ type: z.literal('seatFree'), of: Role.default('$target') });

/** Nobody occupies the seat or bed (HU-GAME-045/046). The dragged character itself does not count. */
export const seatFree: ConditionHandler<z.infer<typeof SeatFreeParams>> = {
  type: 'seatFree',
  params: SeatFreeParams,
  evaluate(ctx, p) {
    const s = resolveRole(ctx, p.of);
    if (!s || !seatSpec(s)) return fail('seatFree');
    return seatIsFree(ctx.env.world, s.id, ctx.sourceId) ? PASS : fail('seatFree');
  },
};

/** Closed set of conditions (INTERACTION_SCHEMA §4). No expressions, no scripting. */
export const CONDITIONS: Record<string, ConditionHandler<never>> = Object.fromEntries(
  [stateIs, isOpen, handFree, containerHasSpace, inventoryHasSpace, isPurchased, canWear, slotWorn, poseIsNot, belowMax, seatFree].map((c) => [c.type, c as unknown as ConditionHandler<never>]),
);

export const CONDITION_TYPES = Object.keys(CONDITIONS);
