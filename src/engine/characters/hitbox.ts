import type { Hitbox, Shape, Sprite } from '../components/base';
import { handAnchor, type BodyTypeDef } from './catalog';

/**
 * Standard character hitbox, generated from bodyTypes[].height (CHARACTER_SCHEMA §4, HU-GAME-013 R8).
 * Shapes are relative to the pivot (feet). Proportions are a proposal documented in CHARACTER_SCHEMA §4:
 * head = top 38 %, torso = shoulders → waist, legs = waist → ankles, feet = bottom 12 %.
 */
export function characterHitbox(body: BodyTypeDef): Hitbox {
  const h = body.height;
  const halfW = h * 0.22;
  const band = (top: number, bottom: number): Shape => ({ type: 'rect', x: -halfW, y: -h * top, w: halfW * 2, h: h * (top - bottom) });
  const hand = (side: 'left' | 'right'): Shape => {
    const a = handAnchor(body, 'idle', side);
    return { type: 'circle', x: a.x, y: a.y, r: h * 0.09 };
  };
  return {
    shape: { type: 'rect', x: -halfW, y: -h, w: halfW * 2, h },
    padding: 0,
    zones: {
      head: { type: 'rect', x: -h * 0.17, y: -h, w: h * 0.34, h: h * 0.38 },
      mouth: { type: 'rect', x: -h * 0.07, y: -h * 0.75, w: h * 0.14, h: h * 0.08 },
      handL: hand('left'),
      handR: hand('right'),
      torso: band(0.62, 0.36),
      legs: band(0.36, 0.12),
      feet: band(0.12, 0),
    },
  };
}

/**
 * Derived sprite of a character: never drawn as such (the renderer draws the layer stack) but it gives
 * characters their render layer (`characters`, z = y), culling size and scene membership.
 */
export function characterSprite(body: BodyTypeDef): Sprite {
  const asset = body.layers.idle?.torso ?? Object.values(body.layers.idle ?? {})[0] ?? body.icon;
  return { asset, layer: 'characters' };
}
