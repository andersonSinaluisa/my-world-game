import type { RawPack } from '@/engine/content/raw-pack';

/**
 * Character parts for the `test` pack (HU-GAME-013..023): two body types, few options per list,
 * three wearables and a sit pose that only defines some layers (to test the idle fallback).
 */

const bodyLayers = (body: string, pose: string, layers: string[]) =>
  Object.fromEntries(layers.map((l) => [l, `chr_body_${body}_${pose}_${l.toLowerCase()}`]));

const ALL_BODY = ['legs', 'torso', 'armL', 'armR', 'head'];

export const TEST_PARTS = {
  bodyTypes: [
    {
      id: 'child',
      name: 'body.child.name',
      icon: 'ui_body_child',
      height: 300,
      layers: { idle: bodyLayers('child', 'idle', ALL_BODY), sit: bodyLayers('child', 'sit', ['legs', 'torso']) },
      handAnchors: { idle: { left: { x: 50, y: -150 }, right: { x: -50, y: -150 } }, sit: { left: { x: 45, y: -120 }, right: { x: -45, y: -120 } } },
    },
    {
      id: 'adult',
      name: 'body.adult.name',
      icon: 'ui_body_adult',
      height: 420,
      layers: { idle: bodyLayers('adult', 'idle', ALL_BODY) },
      handAnchors: { idle: { left: { x: 60, y: -200 }, right: { x: -60, y: -200 } } },
      faceOffset: { x: 0, y: -120 },
    },
  ],
  skinTones: [
    { id: 'skin_01', color: '#F9D7C0' },
    { id: 'skin_04', color: '#C68642' },
    { id: 'skin_06', color: '#6B3E26' },
  ],
  eyes: [
    { id: 'eyes_round', icon: 'chr_eyes_round', asset: 'chr_eyes_round', closedAsset: 'chr_eyes_round_closed' },
    { id: 'eyes_dot', icon: 'chr_eyes_dot', asset: 'chr_eyes_dot' },
  ],
  mouths: [
    { id: 'mouth_smile', icon: 'chr_mouth_smile', asset: 'chr_mouth_smile', byExpression: { yum: 'chr_mouth_smile_yum', happy: 'chr_mouth_smile_happy' } },
    { id: 'mouth_flat', icon: 'chr_mouth_flat', asset: 'chr_mouth_flat' },
  ],
  hairStyles: [
    { id: 'hair_buns', icon: 'chr_hair_buns_front', front: 'chr_hair_buns_front', back: 'chr_hair_buns_back', byBodyType: { adult: { front: 'chr_hair_buns_front_adult', back: 'chr_hair_buns_back_adult' } } },
    { id: 'hair_short', icon: 'chr_hair_short_front', front: 'chr_hair_short_front' },
  ],
  hairColors: [
    { id: 'hair_black', color: '#2B2B2B' },
    { id: 'hair_berry', color: '#B0306A' },
  ],
  starterClothes: ['shirt_star', 'shirt_plain', 'pants_blue', 'shoes_red'],
  colorTags: ['#FFB5C2', '#9ED8FF', '#B8F2A0'],
  defaults: {
    bodyType: 'child',
    skinTone: 'skin_01',
    eyes: 'eyes_round',
    mouth: 'mouth_smile',
    hairStyle: 'hair_buns',
    hairColor: 'hair_black',
    outfit: { top: 'shirt_star', bottom: 'pants_blue', shoes: 'shoes_red' },
  },
};

const wearablePrefab = (id: string, slot: string, loose: string, layers: Record<string, string>, bodyVariants?: Record<string, Record<string, string>>) => ({
  file: `prefabs/clothing/${id}.json`,
  data: {
    id,
    category: 'clothing',
    tags: ['clothing'],
    components: {
      sprite: { asset: loose, layer: 'props' },
      hitbox: { shape: { type: 'rect', x: -40, y: -60, w: 80, h: 60 } },
      draggable: {},
      wearable: { slot, layers, ...(bodyVariants ? { bodyVariants } : {}) },
    },
    metadata: { name: `object.${id}.name` },
  },
});

export const TEST_WEARABLES = [
  wearablePrefab(
    'shirt_star',
    'top',
    'obj_shirt_star',
    { torsoClothes: 'chr_top_star', armClothesL: 'chr_top_star_arm_l', armClothesR: 'chr_top_star_arm_r' },
    { adult: { torsoClothes: 'chr_top_star_adult', armClothesL: 'chr_top_star_arm_l_adult', armClothesR: 'chr_top_star_arm_r_adult' } },
  ),
  wearablePrefab('shirt_plain', 'top', 'obj_shirt_plain', { torsoClothes: 'chr_top_plain' }),
  wearablePrefab('pants_blue', 'bottom', 'obj_pants_blue', { bottomClothes: 'chr_bottom_blue' }),
  wearablePrefab('shoes_red', 'shoes', 'obj_shoes_red', { shoes: 'chr_shoes_red' }),
];

function allAssetKeys(): string[] {
  const keys = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string' && /^(chr_|ui_body_|obj_)/.test(v)) keys.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(TEST_PARTS);
  walk(TEST_WEARABLES);
  keys.add('chr_body_child_sit_legs_sit'); // not used: pose variants only for clothes
  keys.add('chr_top_star_sit'); // pose variant of a garment (HU-GAME-013 R3)
  return [...keys];
}

/** Adds the character catalog, wearables, their assets and i18n keys to a raw test pack. */
export function withCharacters(pack: RawPack): RawPack {
  pack.characters = { file: 'characters/parts.json', data: JSON.parse(JSON.stringify(TEST_PARTS)) };
  pack.prefabs.push(...JSON.parse(JSON.stringify(TEST_WEARABLES)));
  const images = (pack.assets!.data as { images: Record<string, unknown> }).images;
  for (const key of allAssetKeys()) images[key] = { file: `assets/images/${key}.webp`, w: 240, h: 460 };
  const names = ['body.child.name', 'body.adult.name', ...TEST_WEARABLES.map((w) => w.data.metadata.name)];
  for (const loc of ['es', 'en'] as const) {
    const data = pack.locales[loc]!.data as Record<string, string>;
    for (const n of names) data[n] = n;
  }
  return pack;
}
