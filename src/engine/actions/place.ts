import { z } from 'zod';

import { placeItem } from '../systems/surface-system';
import { fail, PASS, resolveRole, type ActionHandler } from './types';

const Params = z.strictObject({ item: z.enum(['$source', '$target']).default('$source') });

/** Rest an item on the surface or floor under the point (HU-GAME-028). Also the drop fallback. */
export const placeAction: ActionHandler<z.infer<typeof Params>> = {
  type: 'place',
  params: Params,
  validate(ctx, p) {
    const item = resolveRole(ctx, p.item);
    if (!item) return fail('entityNotFound');
    if (item.location.kind !== 'scene') return fail('notInScene');
    return PASS;
  },
  execute(ctx, p) {
    const item = resolveRole(ctx, p.item)!;
    placeItem(ctx.env.world, ctx.env.scene, item.id, ctx.point, ctx.env.logger);
  },
};
