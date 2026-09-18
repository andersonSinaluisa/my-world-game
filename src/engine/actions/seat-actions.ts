import { z } from 'zod';

import type { Entity } from '../core/entity';
import type { EntityId } from '../core/types';
import type { World } from '../core/world';
import { absoluteTransform } from '../scene/parenting';
import { fail, PASS, resolveRole, type ActionHandler, type Check, type InteractionContext } from './types';

const Role = z.enum(['$source', '$target']);

/** seat or bed of an entity (ENTITY_SCHEMA §5.11). */
export function seatSpec(e: Entity | undefined) {
  return e?.components.seat ?? e?.components.bed;
}

/** Nobody sits or sleeps there (occupancy is derived from pose.seatId, ECS §4). */
export function seatIsFree(world: World, seatId: EntityId, except?: EntityId): boolean {
  return world.all().every((e) => e.id === except || e.components.pose?.seatId !== seatId);
}

/** World transform of a character on a seat: seat pivot + anchor, facing from the seat (HU-GAME-045 R2). */
export function seatedTransform(world: World, seat: Entity, character: Entity) {
  const spec = seatSpec(seat)!;
  const st = absoluteTransform((id) => world.get(id), seat) ?? { x: 0, y: 0 };
  const flip = st.flipX ? -1 : 1;
  const own = character.components.transform ?? { x: 0, y: 0 };
  const facing = 'facing' in spec ? spec.facing : undefined;
  const flipX = facing === 'left' ? true : facing === 'right' ? false : own.flipX;
  return { ...own, x: st.x + flip * spec.anchor.x, y: st.y + spec.anchor.y, flipX };
}

function validateSeat(ctx: InteractionContext, charRole: '$source' | '$target', seatRole: '$source' | '$target', kind: 'seat' | 'bed'): Check {
  const c = resolveRole(ctx, charRole);
  const s = resolveRole(ctx, seatRole);
  if (!c || !s) return fail('entityNotFound');
  if (!c.components.character || !c.components.pose) return fail('notCharacter');
  if (!s.components[kind]) return fail(kind === 'seat' ? 'notSeat' : 'notBed');
  return seatIsFree(ctx.env.world, s.id, c.id) ? PASS : fail('seatFree');
}

function settle(ctx: InteractionContext, character: Entity, seat: Entity, pose: 'sit' | 'sleep'): void {
  const world = ctx.env.world;
  world.transaction(() => {
    world.update(character.id, { transform: seatedTransform(world, seat, character) });
    world.setSupport(character.id, undefined);
    ctx.env.characters.setPose(character.id, pose, { seatId: seat.id, force: true });
  });
}

const SitParams = z.strictObject({ character: Role.default('$source'), seat: Role.default('$target') });

/** SeatSystem: anchor at seat.anchor with pose sit (HU-GAME-045). */
export const sitAction: ActionHandler<z.infer<typeof SitParams>> = {
  type: 'sit',
  params: SitParams,
  validate: (ctx, p) => validateSeat(ctx, p.character, p.seat, 'seat'),
  execute: (ctx, p) => settle(ctx, resolveRole(ctx, p.character)!, resolveRole(ctx, p.seat)!, 'sit'),
};

const SleepParams = z.strictObject({ character: Role.default('$source'), bed: Role.default('$target') });

/** SeatSystem: anchor at bed.anchor with pose sleep; sleepy comes with the pose (HU-GAME-046). */
export const sleepAction: ActionHandler<z.infer<typeof SleepParams>> = {
  type: 'sleep',
  params: SleepParams,
  validate: (ctx, p) => validateSeat(ctx, p.character, p.bed, 'bed'),
  execute: (ctx, p) => settle(ctx, resolveRole(ctx, p.character)!, resolveRole(ctx, p.bed)!, 'sleep'),
};

const StandUpParams = z.strictObject({ character: Role.default('$source') });

/** Frees the seat; the character stands where it is (explicit form of the implicit standUp on drag). */
export const standUpAction: ActionHandler<z.infer<typeof StandUpParams>> = {
  type: 'standUp',
  params: StandUpParams,
  validate(ctx, p) {
    const c = resolveRole(ctx, p.character);
    if (!c?.components.pose) return fail('notCharacter');
    return c.components.pose.seatId ? PASS : fail('notSeated');
  },
  execute(ctx, p) {
    const c = resolveRole(ctx, p.character)!;
    ctx.env.characters.setPose(c.id, 'idle', { force: true });
  },
};
