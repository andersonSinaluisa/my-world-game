import { z } from 'zod';

import { EXPRESSIONS } from '../components/base';
import type { Entity } from '../core/entity';
import type { Hand } from '../core/location';
import type { World } from '../core/world';
import { placeItem } from '../systems/surface-system';
import { fail, PASS, resolveRole, type ActionHandler, type InteractionContext } from './types';

const Role = z.enum(['$source', '$target']);

/** Free hands of a holder in preference order (CHARACTER_SYSTEM §6, HU-GAME-016 R2-R3). */
export function chooseHand(world: World, holder: Entity, zone: string | undefined): Hand | undefined {
  const hands = holder.components.holder?.hands ?? [];
  const free = (h: Hand) => hands.includes(h) && !world.index.occupantOf({ kind: 'held', holderId: holder.id, hand: h });
  const order: Hand[] = zone === 'handL' ? ['left', 'right'] : ['right', 'left']; // handR or body: right first
  return order.find(free);
}

const HoldParams = z.strictObject({ item: Role.default('$source'), holder: Role.default('$target') });

/** HoldSystem: item → location held in the chosen hand (INTERACTION_SCHEMA §5). */
export const holdAction: ActionHandler<z.infer<typeof HoldParams>> = {
  type: 'hold',
  params: HoldParams,
  validate(ctx, p) {
    const item = resolveRole(ctx, p.item);
    const holder = resolveRole(ctx, p.holder);
    if (!item || !holder) return fail('entityNotFound');
    if (!holder.components.holder) return fail('notHolder');
    if (item.id === holder.id) return fail('invalidTarget');
    if (!chooseHand(ctx.env.world, holder, ctx.zone)) return fail('handFree');
    return PASS;
  },
  execute(ctx, p) {
    const item = resolveRole(ctx, p.item)!;
    const holder = resolveRole(ctx, p.holder)!;
    const hand = chooseHand(ctx.env.world, holder, ctx.zone)!;
    ctx.env.world.setSupport(item.id, undefined);
    ctx.env.locations.move(item.id, { kind: 'held', holderId: holder.id, hand });
  },
};

const ReleaseParams = z.strictObject({ item: Role.default('$source') });

/** Drops a held item on the floor/surface under its holder (INTERACTION_SCHEMA §5). */
export const releaseAction: ActionHandler<z.infer<typeof ReleaseParams>> = {
  type: 'release',
  params: ReleaseParams,
  validate(ctx, p) {
    const item = resolveRole(ctx, p.item);
    if (!item) return fail('entityNotFound');
    if (item.location.kind !== 'held') return fail('notHeld');
    return PASS;
  },
  execute(ctx, p) {
    releaseItem(ctx, resolveRole(ctx, p.item)!);
  },
};

export function releaseItem(ctx: Pick<InteractionContext, 'env'>, item: Entity): void {
  if (item.location.kind !== 'held') return;
  const holder = ctx.env.world.get(item.location.holderId);
  const t = holder?.components.transform ?? { x: 0, y: 0 };
  const sceneId = holder?.location.kind === 'scene' ? holder.location.sceneId : ctx.env.scene.id;
  ctx.env.world.transaction(() => {
    ctx.env.locations.move(item.id, { kind: 'scene', sceneId });
    ctx.env.world.update(item.id, { transform: { ...(item.components.transform ?? {}), x: t.x, y: t.y } });
    if (sceneId === ctx.env.scene.id) placeItem(ctx.env.world, ctx.env.scene, item.id, { x: t.x, y: t.y }, ctx.env.logger);
  });
}

const SetExpressionParams = z.strictObject({
  character: Role.default('$target'),
  expression: z.enum(EXPRESSIONS),
  durationMs: z.number().int().positive().optional(),
});

/** CharacterSystem.setExpression (HU-GAME-015). */
export const setExpressionAction: ActionHandler<z.infer<typeof SetExpressionParams>> = {
  type: 'setExpression',
  params: SetExpressionParams,
  validate(ctx, p) {
    const c = resolveRole(ctx, p.character);
    if (!c) return fail('entityNotFound');
    if (!c.components.character) return fail('notCharacter');
    return PASS;
  },
  execute(ctx, p) {
    ctx.env.characters.setExpression(resolveRole(ctx, p.character)!.id, p.expression, p.durationMs);
  },
};
