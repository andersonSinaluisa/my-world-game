import { z } from 'zod';

import { CHARACTER_LAYERS, EXPRESSIONS, POSES, type CharacterLayer, type PoseId } from '../components/base';
import { WEAR_SLOTS } from '../core/location';

/**
 * Character parts catalog: `content/<pack>/characters/parts.json` (CHARACTER_SCHEMA §1).
 * Read-only content that says which options exist; the player's choices live in `appearance`.
 *
 * Extensions over CHARACTER_SCHEMA v1 (documented there):
 * - `faceOffset`: face parts (eyes, mouth, hair without byBodyType) are drawn on the canvas of the
 *   first body type; other body types move them by this offset, so faces are shared between bodies.
 * - optional `name` (i18n) on colors and face parts, for accessibility labels in the creator.
 * - `colorTags`: palette for the character frame color (HU-GAME-022 R3).
 */

const key = z.string().min(1);
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const point = z.strictObject({ x: z.number().finite(), y: z.number().finite() });
const layerAssets = z.partialRecord(z.enum(CHARACTER_LAYERS), key);
const idPart = z.string().regex(/^[a-z0-9_]+$/);

const withIdle = <T extends z.ZodType>(value: T) =>
  z.partialRecord(z.enum(POSES), value).refine((r) => r.idle !== undefined, { message: 'the "idle" pose is required' });

export const BodyTypeSchema = z.strictObject({
  id: idPart,
  name: key,
  icon: key,
  /** Height in world units; the standard hitbox is generated from it (CHARACTER_SCHEMA §4). */
  height: z.number().positive(),
  layers: withIdle(layerAssets),
  handAnchors: withIdle(z.strictObject({ left: point, right: point })),
  mouthAnchor: z.partialRecord(z.enum(POSES), point).optional(),
  faceOffset: point.optional(),
});

export const CharacterPartsSchema = z.strictObject({
  bodyTypes: z.array(BodyTypeSchema).min(1),
  skinTones: z.array(z.strictObject({ id: idPart, color, name: key.optional() })).min(1),
  eyes: z.array(z.strictObject({ id: idPart, icon: key, asset: key, closedAsset: key.optional(), name: key.optional() })).min(1),
  mouths: z
    .array(
      z.strictObject({
        id: idPart,
        icon: key,
        asset: key,
        byExpression: z.partialRecord(z.enum(EXPRESSIONS), key).optional(),
        name: key.optional(),
      }),
    )
    .min(1),
  hairStyles: z
    .array(
      z.strictObject({
        id: idPart,
        icon: key,
        back: key.optional(),
        front: key,
        byBodyType: z.record(z.string(), z.strictObject({ back: key.optional(), front: key })).optional(),
        name: key.optional(),
      }),
    )
    .min(1),
  hairColors: z.array(z.strictObject({ id: idPart, color, name: key.optional() })).min(1),
  starterClothes: z.array(key),
  colorTags: z.array(color).optional(),
  defaults: z.strictObject({
    bodyType: key,
    skinTone: key,
    eyes: key,
    mouth: key,
    hairStyle: key,
    hairColor: key,
    outfit: z.partialRecord(z.enum(WEAR_SLOTS), key),
  }),
});

export type CharacterPartsCatalog = z.infer<typeof CharacterPartsSchema>;
export type BodyTypeDef = z.infer<typeof BodyTypeSchema>;

/** Body layers that take the skin tint; hair layers take the hair tint (CHARACTER_SCHEMA §3). */
export const SKIN_LAYERS: readonly CharacterLayer[] = ['legs', 'torso', 'armL', 'armR', 'head'];
export const HAIR_LAYERS: readonly CharacterLayer[] = ['hairBack', 'hairFront'];

/** Body layers resolved from bodyTypes[].layers[pose] (CHARACTER_SYSTEM §3 step 1). */
export const BODY_LAYERS: readonly CharacterLayer[] = SKIN_LAYERS;

/** Clothing layers resolved from the worn wearables (step 2). */
export const CLOTHING_LAYERS: readonly CharacterLayer[] = ['bottomClothes', 'shoes', 'torsoClothes', 'armClothesL', 'armClothesR'];

export function handAnchor(body: BodyTypeDef, pose: PoseId, hand: 'left' | 'right'): { x: number; y: number } {
  return (body.handAnchors[pose] ?? body.handAnchors.idle)![hand];
}

/** Every asset key referenced by the catalog, with a JSON path, for the validator. */
export function catalogAssetRefs(c: CharacterPartsCatalog): { path: (string | number)[]; key: string }[] {
  const out: { path: (string | number)[]; key: string }[] = [];
  c.bodyTypes.forEach((b, i) => {
    out.push({ path: ['bodyTypes', i, 'icon'], key: b.icon });
    for (const [pose, layers] of Object.entries(b.layers)) {
      for (const [layer, k] of Object.entries(layers ?? {})) out.push({ path: ['bodyTypes', i, 'layers', pose, layer], key: k! });
    }
  });
  c.eyes.forEach((e, i) => {
    out.push({ path: ['eyes', i, 'icon'], key: e.icon }, { path: ['eyes', i, 'asset'], key: e.asset });
    if (e.closedAsset) out.push({ path: ['eyes', i, 'closedAsset'], key: e.closedAsset });
  });
  c.mouths.forEach((m, i) => {
    out.push({ path: ['mouths', i, 'icon'], key: m.icon }, { path: ['mouths', i, 'asset'], key: m.asset });
    for (const [expr, k] of Object.entries(m.byExpression ?? {})) out.push({ path: ['mouths', i, 'byExpression', expr], key: k! });
  });
  c.hairStyles.forEach((h, i) => {
    out.push({ path: ['hairStyles', i, 'icon'], key: h.icon }, { path: ['hairStyles', i, 'front'], key: h.front });
    if (h.back) out.push({ path: ['hairStyles', i, 'back'], key: h.back });
    for (const [bt, v] of Object.entries(h.byBodyType ?? {})) {
      out.push({ path: ['hairStyles', i, 'byBodyType', bt, 'front'], key: v.front });
      if (v.back) out.push({ path: ['hairStyles', i, 'byBodyType', bt, 'back'], key: v.back });
    }
  });
  return out;
}
