import type { Entity } from '../core/entity';
import type { AssetKey } from '../core/types';

/**
 * The sprite an entity shows now (single rule for the renderer, the hand and the backpack):
 * food by bites left (ENTITY_SCHEMA §5.9), drinks by sips left, then sprite.byState, then sprite.asset.
 */
export function spriteAssetOf(entity: Entity): AssetKey | undefined {
  const c = entity.components;
  const sprite = c.sprite;
  if (!sprite) return undefined;
  if (c.edible) {
    const left = c.edible.bitesLeft ?? c.edible.bites;
    const byBites = c.edible.spriteByBitesLeft?.[String(left)];
    if (byBites) return byBites;
  }
  if (c.drinkable) {
    const left = c.drinkable.sipsLeft ?? c.drinkable.sips;
    const bySips = c.drinkable.spriteBySipsLeft?.[String(left)];
    if (bySips) return bySips;
  }
  const state = c.states?.current;
  return (state && sprite.byState?.[state]) || sprite.asset;
}
