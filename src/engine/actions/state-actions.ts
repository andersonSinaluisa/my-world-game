import { z } from 'zod';

import { fail, PASS, resolveRole, type ActionHandler } from './types';

const Role = z.enum(['$source', '$target']);

const SetStateParams = z.strictObject({ entity: Role.default('$target'), state: z.string().min(1) });
const CycleStateParams = z.strictObject({ entity: Role.default('$target') });

/**
 * StateSystem actions (HU-GAME-025). The system has no idea what "open" or "on" mean;
 * openable/switchable give states their meaning (R8).
 */
export const setStateAction: ActionHandler<z.infer<typeof SetStateParams>> = {
  type: 'setState',
  params: SetStateParams,
  validate(ctx, p) {
    const e = resolveRole(ctx, p.entity);
    if (!e) return fail('entityNotFound');
    const states = e.components.states;
    if (!states) return fail('noStates');
    if (!states.values.includes(p.state)) return fail('unknownState');
    return PASS;
  },
  execute(ctx, p) {
    const e = resolveRole(ctx, p.entity)!;
    const states = e.components.states!;
    if (states.current === p.state) return; // no-op: no event, nothing dirty
    ctx.env.world.update(e.id, { states: { ...states, current: p.state } });
  },
};

export const cycleStateAction: ActionHandler<z.infer<typeof CycleStateParams>> = {
  type: 'cycleState',
  params: CycleStateParams,
  validate(ctx, p) {
    const e = resolveRole(ctx, p.entity);
    if (!e) return fail('entityNotFound');
    if (!e.components.states) return fail('noStates');
    return PASS;
  },
  execute(ctx, p) {
    const e = resolveRole(ctx, p.entity)!;
    const states = e.components.states!;
    if (states.values.length < 2) return;
    const next = states.values[(states.values.indexOf(states.current) + 1) % states.values.length];
    ctx.env.world.update(e.id, { states: { ...states, current: next } });
  },
};
