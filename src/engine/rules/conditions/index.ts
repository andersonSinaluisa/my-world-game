import { z } from 'zod';

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

/** Closed set of conditions (INTERACTION_SCHEMA §4). No expressions, no scripting. */
export const CONDITIONS: Record<string, ConditionHandler<never>> = Object.fromEntries(
  [stateIs, isOpen].map((c) => [c.type, c as unknown as ConditionHandler<never>]),
);

export const CONDITION_TYPES = Object.keys(CONDITIONS);
