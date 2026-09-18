import { z } from 'zod';

import { fail, PASS, resolveRole, type ActionHandler } from './types';

const Role = z.enum(['$source', '$target']);
const TeleportParams = z.strictObject({ traveler: Role.default('$source'), portal: Role.default('$target') });

/**
 * SceneService: the character (and what it holds and wears) goes through the portal (HU-GAME-049).
 * The scene change itself runs after the interaction: the action only hands the request back to the
 * engine, which plays the transition (HU-GAME-050).
 */
export const teleportAction: ActionHandler<z.infer<typeof TeleportParams>> = {
  type: 'teleport',
  params: TeleportParams,
  validate(ctx, p) {
    const traveler = resolveRole(ctx, p.traveler);
    const portal = resolveRole(ctx, p.portal);
    if (!traveler || !portal) return fail('entityNotFound');
    const spec = portal.components.portal;
    if (!spec) return fail('notPortal');
    const accepts = spec.accepts ?? ['character'];
    if (!accepts.some((tag) => traveler.tags.includes(tag) || (tag === 'character' && !!traveler.components.character))) {
      return fail('notAccepted');
    }
    // RN-10: an unpaid product never leaves the store in a hand.
    const unpaid = ctx.env.world.index
      .heldBy(traveler.id)
      .some((id) => ctx.env.world.get(id)?.components.purchasable?.purchased === false);
    return unpaid ? fail('notPurchased') : PASS;
  },
  execute(ctx, p) {
    const spec = resolveRole(ctx, p.portal)!.components.portal!;
    ctx.output.travel = { sceneId: spec.targetSceneId, spawnId: spec.targetSpawnId, travelers: [resolveRole(ctx, p.traveler)!.id] };
  },
};
