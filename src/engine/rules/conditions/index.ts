import { z } from 'zod';

import { chooseHand } from '../../actions/character-actions';
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

/** Closed set of conditions (INTERACTION_SCHEMA §4). No expressions, no scripting. */
export const CONDITIONS: Record<string, ConditionHandler<never>> = Object.fromEntries(
  [stateIs, isOpen, handFree].map((c) => [c.type, c as unknown as ConditionHandler<never>]),
);

export const CONDITION_TYPES = Object.keys(CONDITIONS);
