import { z } from 'zod';

import type { Entity } from '../core/entity';
import { WEAR_SLOTS, type WearSlot } from '../core/location';
import { placeItem } from '../systems/surface-system';
import { fail, PASS, resolveRole, type ActionHandler, type Check, type InteractionContext } from './types';

const Role = z.enum(['$source', '$target']);

/** Character hitbox bands → slot (CHARACTER_SCHEMA §4, HU-GAME-040 R3). */
export const ZONE_SLOT: Record<string, WearSlot> = { torso: 'top', legs: 'bottom', feet: 'shoes' };

/** HU-GAME-039 R5: receiving a garment → happy for 1 s. */
export const WEAR_HAPPY_MS = 1000;
/** Where a replaced garment lands, relative to the character (CHARACTER_SYSTEM §7). */
export const FEET_OFFSET_X = 70;

/** The slot exists and the garment has sprites for the character's body (HU-GAME-039 R2). */
export function canWearCheck(item: Entity, character: Entity): Check {
  const w = item.components.wearable;
  const a = character.components.appearance;
  if (!w || !a) return fail('canWear');
  if (!WEAR_SLOTS.includes(w.slot)) return fail('canWear');
  const layers = w.bodyVariants?.[a.bodyType] ?? w.layers;
  return Object.keys(layers ?? {}).length ? PASS : fail('canWear');
}

/** Puts a worn garment down next to the character's feet, with a pop (CHARACTER_SYSTEM §7). */
export function dropNearFeet(ctx: Pick<InteractionContext, 'env'>, character: Entity, item: Entity): void {
  const t = character.components.transform ?? { x: 0, y: 960 };
  const sceneId = character.location.kind === 'scene' ? character.location.sceneId : ctx.env.scene.id;
  const at = { x: Math.min(Math.max(t.x + FEET_OFFSET_X, 0), ctx.env.scene.size.width), y: t.y };
  ctx.env.locations.move(item.id, { kind: 'scene', sceneId });
  ctx.env.world.update(item.id, { transform: { x: at.x, y: at.y } });
  if (sceneId === ctx.env.scene.id) placeItem(ctx.env.world, ctx.env.scene, item.id, at, ctx.env.logger);
  ctx.env.world.emit({ type: 'visualEffect', entityId: item.id, preset: 'bounce' });
}

const WearParams = z.strictObject({ item: Role.default('$source'), character: Role.default('$target') });

/** OutfitSystem: garment → worn in its own slot; the previous one drops by the feet (HU-GAME-039 R3, R6). */
export const wearAction: ActionHandler<z.infer<typeof WearParams>> = {
  type: 'wear',
  params: WearParams,
  validate(ctx, p) {
    const item = resolveRole(ctx, p.item);
    const character = resolveRole(ctx, p.character);
    if (!item || !character) return fail('entityNotFound');
    return canWearCheck(item, character);
  },
  execute(ctx, p) {
    const item = resolveRole(ctx, p.item)!;
    const character = resolveRole(ctx, p.character)!;
    const slot = item.components.wearable!.slot;
    const world = ctx.env.world;
    world.transaction(() => {
      const previousId = world.index.wornBy(character.id)[slot];
      const previous = previousId ? world.get(previousId) : undefined;
      if (previous && previous.id !== item.id) dropNearFeet(ctx, character, previous);
      if (item.components.transform?.parentId) {
        const { parentId: _p, ...t } = item.components.transform;
        void _p;
        world.update(item.id, { transform: t });
      }
      world.setSupport(item.id, undefined);
      // held → worn (or scene → worn) in one transaction (R7).
      ctx.env.locations.move(item.id, { kind: 'worn', characterId: character.id, slot });
    });
    ctx.env.characters.setExpression(character.id, 'happy', WEAR_HAPPY_MS);
  },
};

const UnwearParams = z.strictObject({ character: Role.default('$target'), slot: z.enum(WEAR_SLOTS).optional() });

/**
 * Takes off the garment of the touched band (or of `slot`) and leaves it at the finger; the command that
 * ran the rule returns `startDrag: itemId` so the gesture continues as a drag (HU-GAME-040 R4).
 */
export const unwearAction: ActionHandler<z.infer<typeof UnwearParams>> = {
  type: 'unwear',
  params: UnwearParams,
  validate(ctx, p) {
    const c = resolveRole(ctx, p.character);
    if (!c) return fail('entityNotFound');
    const slot = p.slot ?? (ctx.zone ? ZONE_SLOT[ctx.zone] : undefined);
    if (!slot || !ctx.env.world.index.wornBy(c.id)[slot]) return fail('slotWorn');
    return PASS;
  },
  execute(ctx, p) {
    const c = resolveRole(ctx, p.character)!;
    const slot = (p.slot ?? ZONE_SLOT[ctx.zone!])!;
    const itemId = ctx.env.world.index.wornBy(c.id)[slot]!;
    const sceneId = c.location.kind === 'scene' ? c.location.sceneId : ctx.env.scene.id;
    ctx.env.world.transaction(() => {
      ctx.env.locations.move(itemId, { kind: 'scene', sceneId });
      ctx.env.world.update(itemId, { transform: { x: ctx.point.x, y: ctx.point.y } });
      ctx.env.world.emit({ type: 'visualEffect', entityId: itemId, preset: 'bounce' });
    });
    ctx.output.startDrag = itemId;
  },
};
