/**
 * Placeholder content of the playable house (EPIC-017, HU-GAME-059..062, HU-GAME-041). NOT final art.
 * Glitch CC0 SVGs where a good match exists, simple own vector drawings otherwise, plus derived state
 * sprites (open, on, bites). Writes images, assets.json entries, prefabs, the home scene and i18n.
 *
 * Usage: npx tsx scripts/generate-home-content.ts   (then npm run content:assets && npm run content:validate)
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const PACK = path.resolve(__dirname, '..', 'content', 'core');
const GLITCH = path.resolve(__dirname, '..', '..', 'assets', 'vendor', 'glitch', 'svg');
const GLITCH_FURNITURE = 'https://opengameart.org/content/glitch-furniture-svg';
const GLITCH_FOOD = 'https://opengameart.org/content/glitch-food-drink-items-svg';
const OWN = 'MyWorld placeholder (scripts/generate-home-content.ts)';
const INK = '#3E2C4A';

interface ImageEntry { file: string; w: number; h: number; placeholder: true; license: string; source: string }
const images: Record<string, ImageEntry> = {};
const i18n: { es: Record<string, string>; en: Record<string, string> } = { es: {}, en: {} };

async function save(key: string, png: Buffer, license: string, source: string): Promise<{ w: number; h: number }> {
  const file = `assets/images/${key}.webp`;
  const buf = await sharp(png).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
  fs.writeFileSync(path.join(PACK, file), buf);
  const m = await sharp(buf).metadata();
  images[key] = { file, w: m.width!, h: m.height!, placeholder: true, license, source };
  return { w: m.width!, h: m.height! };
}

/** Glitch SVG → trimmed, 4 px padded, `height` world units tall (1 px = 1 unit). */
async function glitch(key: string, rel: string, height: number, source = GLITCH_FURNITURE) {
  const raster = await sharp(path.join(GLITCH, rel), { density: 300 }).trim().png().toBuffer();
  const sized = await sharp(raster).resize({ height: height - 8 }).extend({ top: 4, bottom: 4, left: 4, right: 4, background: '#00000000' }).png().toBuffer();
  return save(key, sized, 'CC0', source);
}

/** Own drawing: SVG body in a w × h canvas whose (0,0) is the bottom center (pivot). */
async function own(key: string, w: number, h: number, body: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${-w / 2} ${-h} ${w} ${h}">${body}</svg>`;
  return save(key, Buffer.from(svg), 'own', OWN);
}

const r = (x: number, y: number, w: number, h: number, fill: string, rx = 6, sw = 4, stroke = INK) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const c = (x: number, y: number, rad: number, fill: string, sw = 4) => `<circle cx="${x}" cy="${y}" r="${rad}" fill="${fill}" stroke="${INK}" stroke-width="${sw}"/>`;
const e = (x: number, y: number, rx: number, ry: number, fill: string, sw = 4) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${INK}" stroke-width="${sw}"/>`;
const p = (d: string, fill: string, sw = 4) => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;

// ---------- own drawings ----------

const fridge = (open: boolean) =>
  open
    ? r(-100, -400, 200, 396, '#F4F8FB', 16) + r(-88, -388, 176, 372, '#DCEAF5', 10, 3) + [-300, -210, -120].map((y) => r(-84, y, 168, 8, '#FFFFFF', 3, 2)).join('') + r(92, -392, 70, 380, '#EAF2F8', 10)
    : r(-100, -400, 200, 396, '#F4F8FB', 16) + `<line x1="-96" y1="-260" x2="96" y2="-260" stroke="${INK}" stroke-width="4"/>` + r(-80, -380, 10, 90, '#B0BEC5', 4, 2) + r(-80, -240, 10, 100, '#B0BEC5', 4, 2);
const tv = (on: boolean) =>
  r(-150, -120, 300, 116, '#8D6E63', 10) + r(-40, -150, 80, 32, '#5D4037', 6) + r(-170, -300, 340, 170, '#37303F', 14) + r(-155, -287, 310, 144, on ? '#9EE6FF' : '#1B1B24', 8, 2) + (on ? c(-60, -225, 26, '#FFE08A', 2) + p('M-20 -190 Q40 -250 120 -190 Z', '#7ED957', 2) : '');
const stove = (on: boolean) =>
  r(-100, -200, 200, 196, '#ECEFF1', 12) + r(-80, -150, 160, 100, '#CFD8DC', 8, 3) + [-50, 50].map((x) => e(x, -200, 34, 8, '#607D8B', 3)).join('') + (on ? [-50, 50].map((x) => p(`M${x - 20} -205 Q${x - 10} -245 ${x} -222 Q${x + 10} -250 ${x + 20} -205 Z`, '#FF8A3D', 2)).join('') : '');
const cupboard = () => r(-110, -300, 220, 296, '#D7A86E', 12) + [-210, -110].map((y) => r(-100, y, 200, 8, '#A1734A', 3, 2)).join('') + r(-100, -290, 200, 76, '#F3E1C7', 6, 2) + r(-100, -196, 200, 76, '#F3E1C7', 6, 2) + r(-100, -100, 200, 86, '#F3E1C7', 6, 2);
const wardrobe = (open: boolean) =>
  open
    ? r(-130, -420, 260, 416, '#C98E5B', 14) + r(-116, -404, 232, 388, '#5B3A29', 8, 3) + `<line x1="-110" y1="-380" x2="110" y2="-380" stroke="#D7CCC8" stroke-width="6"/>` + r(-190, -410, 64, 400, '#D9A274', 8) + r(126, -410, 64, 400, '#D9A274', 8)
    : r(-130, -420, 260, 416, '#C98E5B', 14) + `<line x1="0" y1="-410" x2="0" y2="-14" stroke="${INK}" stroke-width="4"/>` + c(-16, -220, 7, '#FFD23F', 2) + c(16, -220, 7, '#FFD23F', 2);
const toilet = () => r(-40, -170, 80, 70, '#FFFFFF', 12) + p('M-60 -100 L60 -100 L44 -30 L-44 -30 Z', '#FFFFFF') + r(-30, -30, 60, 26, '#ECEFF1', 6);
const bathtub = () => r(-210, -170, 420, 150, '#FFFFFF', 40) + r(-190, -160, 380, 30, '#B3E5FC', 14, 2) + [-160, 160].map((x) => r(x - 12, -24, 24, 24, '#CFD8DC', 6, 3)).join('');
const sink = (on: boolean) =>
  r(-20, -150, 40, 146, '#ECEFF1', 8) + p('M-90 -170 L90 -170 L70 -130 L-70 -130 Z', '#FFFFFF') + r(-6, -210, 12, 40, '#B0BEC5', 4, 3) + r(-6, -210, 40, 10, '#B0BEC5', 4, 3) + (on ? r(28, -200, 8, 40, '#81D4FA', 3, 1) : '');
const basket = () => p('M-60 -110 L60 -110 L48 -4 L-48 -4 Z', '#E0C097') + [-80, -50, -20].map((y) => `<line x1="-56" y1="${y}" x2="56" y2="${y}" stroke="#A1734A" stroke-width="3"/>`).join('');
const towel = () => r(-40, -70, 80, 66, '#4FB3F6', 10) + r(-40, -30, 80, 10, '#FFFFFF', 3, 2);
const toothbrush = () => r(-40, -16, 80, 12, '#FF7EB6', 6, 3) + r(24, -30, 18, 16, '#FFFFFF', 4, 2);
const duck = () => e(0, -30, 40, 28, '#FFD23F') + c(22, -62, 20, '#FFD23F') + p('M40 -64 L58 -58 L40 -52 Z', '#FF8A3D', 3) + c(26, -66, 3, INK, 1);
const book = () => r(-40, -60, 80, 56, '#E94F4F', 6) + r(-34, -54, 10, 44, '#FFFFFF', 2, 2);
const pillow = () => r(-60, -44, 120, 40, '#FFFFFF', 20) + e(0, -24, 18, 6, '#E3F2FD', 2);
const clock = () => c(0, -44, 38, '#FF7EB6') + c(0, -44, 28, '#FFFFFF', 3) + p('M0 -44 L0 -62 M0 -44 L14 -44', 'none', 3) + [-22, 22].map((x) => c(x, -84, 10, '#FFD23F', 3)).join('');
const cookie = () => c(0, -26, 24, '#D9A274') + [[-8, -32], [8, -22], [2, -38]].map(([x, y]) => c(x, y, 4, '#5D4037', 1)).join('');
const sandwich = () => p('M-50 -10 L50 -10 L0 -70 Z', '#F3D19E') + p('M-42 -18 L42 -18 L0 -58 Z', '#7ED957', 2) + p('M-36 -22 L36 -22 L0 -52 Z', '#F3D19E', 3);
const glass = (level: number) =>
  (level > 0 ? p(`M-22 ${-10 - 60 * level} L22 ${-10 - 60 * level} L20 -10 L-20 -10 Z`, '#FF9F43', 0) : '') + p('M-26 -80 L26 -80 L22 -6 L-22 -6 Z', 'rgba(225,245,254,0.55)', 4);
const milk = (empty: boolean) =>
  r(-26, -90, 52, 86, empty ? '#ECEFF1' : '#FFFFFF', 4) + p('M-26 -90 L0 -114 L26 -90 Z', '#4FB3F6') + (empty ? '' : r(-18, -60, 36, 26, '#4FB3F6', 4, 2));
const appleCore = () => r(-8, -60, 16, 44, '#FFF3C4', 8, 3) + e(0, -64, 16, 8, '#E94F4F', 3) + e(0, -14, 14, 7, '#E94F4F', 3) + r(-2, -80, 4, 12, '#5D4037', 2, 1);
const toyBlocks = () => r(-50, -44, 44, 40, '#E94F4F', 6) + r(6, -44, 44, 40, '#4FB3F6', 6) + r(-22, -84, 44, 40, '#FFD23F', 6);
const bowlPlate = () => e(0, -18, 70, 16, '#FFFFFF') + p('M-66 -20 Q0 20 66 -20', '#FFFFFF');

/** Path of a pack image generated here or earlier (assets/images/<key>.webp). */
const srcOf = (key: string) => path.join(PACK, images[key]?.file ?? `assets/images/${key}.webp`);

/** A bite taken from an image: transparent circles cut on the right side (HU-GAME-042 R2). */
async function bitten(fromKey: string, key: string, bites: number) {
  const src = srcOf(fromKey);
  const { width: w, height: h } = await sharp(src).metadata();
  const cuts = Array.from({ length: bites }, (_, i) => `<circle cx="${w! - 4}" cy="${h! * (0.3 + i * 0.25)}" r="${w! * 0.22}" fill="black"/>`).join('');
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="white"/>${cuts}</svg>`);
  // dest-in keeps the sprite only where the mask is opaque; the black circles are made transparent first.
  const alphaMask = await sharp(mask).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = alphaMask.data;
  for (let i = 0; i < px.length; i += 4) px[i + 3] = px[i]; // white → opaque, black → transparent
  const maskPng = await sharp(px, { raw: { width: w!, height: h!, channels: 4 } }).png().toBuffer();
  const png = await sharp(src).ensureAlpha().composite([{ input: maskPng, blend: 'dest-in' }]).png().toBuffer();
  return save(key, png, 'own', OWN);
}

/** Bed blanket: the lower part of the bed sprite, drawn in front of a sleeping character (HU-GAME-046 R3). */
async function bedCover(fromKey: string, key: string, fromRatio: number) {
  const src = srcOf(fromKey);
  const meta = await sharp(src).metadata();
  const top = Math.round(meta.height! * fromRatio);
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}"><rect y="${top}" width="${meta.width}" height="${meta.height! - top}" fill="white"/></svg>`);
  const png = await sharp(src).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return save(key, png, 'own', OWN);
}

// ---------- prefabs ----------

type Json = Record<string, unknown>;
const prefabs: { dir: string; data: Json }[] = [];
function prefab(dir: string, id: string, category: string, tags: string[], components: Json, es: string, en: string) {
  i18n.es[`object.${id}.name`] = es;
  i18n.en[`object.${id}.name`] = en;
  prefabs.push({ dir, data: { id, category, tags, components, metadata: { name: `object.${id}.name`, placeholder: true } } });
}
const box = (w: number, h: number, pad = 0): Json => ({ shape: { type: 'rect', x: -w / 2, y: -h, w, h }, ...(pad ? { padding: pad } : {}) });
const sprite = (asset: string, layer: string, extra: Json = {}): Json => ({ asset, layer, ...extra });
const slotsRow = (n: number, y: number, spacing: number) => Array.from({ length: n }, (_, i) => ({ x: (i - (n - 1) / 2) * spacing, y }));
const grid = (cols: number, rows: number, x0: number, y0: number, dx: number, dy: number) =>
  Array.from({ length: cols * rows }, (_, i) => ({ x: x0 + (i % cols) * dx, y: y0 + Math.floor(i / cols) * dy }));

async function main() {
  fs.mkdirSync(path.join(PACK, 'assets', 'images'), { recursive: true });
  const F = 'furniture/furniture';

  // Indoor room backgrounds (the Kenney outdoor placeholders did not fit a house).
  const rooms: [string, string, string, string][] = [
    ['living', '#FFE3C2', '#C98E5B', '#FFB5C2'],
    ['kitchen', '#D8F3DC', '#E9E4DA', '#9ED8FF'],
    ['bedroom', '#E3D7FF', '#B98A64', '#FFE08A'],
    ['bathroom', '#CFF3F6', '#FFFFFF', '#FFB5C2'],
  ];
  for (const [room, wall, floor, accent] of rooms) {
    const tiles = room === 'kitchen' || room === 'bathroom';
    const floorPattern = tiles
      ? Array.from({ length: 24 }, (_, i) => `<line x1="${i * 80}" y1="960" x2="${i * 80}" y2="1080" stroke="#00000014" stroke-width="3"/>`).join('') + `<line x1="0" y1="1020" x2="1920" y2="1020" stroke="#00000014" stroke-width="3"/>`
      : Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="${960 + i * 12}" x2="1920" y2="${960 + i * 12}" stroke="#00000012" stroke-width="2"/>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
      <rect width="1920" height="960" fill="${wall}"/>
      ${Array.from({ length: 16 }, (_, i) => `<rect x="${i * 120 + 50}" y="0" width="20" height="930" fill="#FFFFFF" opacity="0.18"/>`).join('')}
      <rect x="0" y="930" width="1920" height="30" fill="#FFFFFF" stroke="${INK}" stroke-width="4"/>
      <rect x="0" y="960" width="1920" height="120" fill="${floor}"/>${floorPattern}
      <rect x="700" y="190" width="420" height="330" rx="18" fill="#BEE9FF" stroke="${INK}" stroke-width="8"/>
      <line x1="910" y1="190" x2="910" y2="520" stroke="${INK}" stroke-width="6"/><line x1="700" y1="355" x2="1120" y2="355" stroke="${INK}" stroke-width="6"/>
      <rect x="680" y="520" width="460" height="24" rx="8" fill="#FFFFFF" stroke="${INK}" stroke-width="5"/>
      <rect x="1440" y="260" width="200" height="150" rx="10" fill="${accent}" stroke="${INK}" stroke-width="6"/>
      <circle cx="1540" cy="335" r="40" fill="#FFFFFF" opacity="0.8"/>
      <rect x="260" y="300" width="130" height="170" rx="10" fill="${accent}" stroke="${INK}" stroke-width="6"/>
    </svg>`;
    await save(`env_home_bg_${room}_01`, Buffer.from(svg), 'own', OWN);
  }

  // Living room
  const sofa = await glitch('env_home_sofa', `${F}/furniture_sofa_danish_modern_sofa.svg`, 190);
  const armchair = await glitch('env_home_armchair', `${F}/furniture_armchair_classic_green_armchair.svg`, 240);
  const coffee = await glitch('env_home_coffee_table', `${F}/furniture_coffeetable_danish_modern_coffee_table.svg`, 90);
  await own('env_home_tv_off', 340, 304, tv(false));
  await own('env_home_tv_on', 340, 304, tv(true));
  const teddy = await glitch('obj_toy_teddy', `${F}/furniture_tabledeco_couple_bears.svg`, 100);
  await own('obj_toy_book', 90, 70, book());
  const plant = await glitch('env_home_plant', `${F}/furniture_roomdeco_warp_pipe_plant_pot.svg`, 150);

  // Kitchen
  await own('env_home_fridge_closed', 210, 408, fridge(false));
  await own('env_home_fridge_open', 330, 408, fridge(true));
  await own('env_home_stove_off', 210, 260, stove(false));
  await own('env_home_stove_on', 210, 260, stove(true));
  await own('env_home_cupboard', 230, 308, cupboard());
  const chair = await glitch('env_home_chair', `${F}/furniture_chair_basic_padded_chair.svg`, 210);
  await glitch('env_home_fruit_bowl', 'food/food/berry_bowl.svg', 80, GLITCH_FOOD);
  await glitch('obj_food_banana', 'food/food/banana.svg', 60, GLITCH_FOOD);
  await own('obj_food_sandwich', 110, 80, sandwich());
  await glitch('obj_food_cake', 'food/food/pumpkin_pie.svg', 60, GLITCH_FOOD);
  await own('obj_food_cookie', 60, 56, cookie());
  await own('obj_food_apple_core', 50, 90, appleCore());
  await bitten('obj_food_apple_red', 'obj_food_apple_red_bite_2', 1);
  await bitten('obj_food_apple_red', 'obj_food_apple_red_bite_1', 2);
  await bitten('obj_food_banana', 'obj_food_banana_bite_1', 1);
  await bitten('obj_food_sandwich', 'obj_food_sandwich_bite_1', 1);
  for (const [k, lvl] of [['obj_drink_juice', 1], ['obj_drink_juice_2', 0.66], ['obj_drink_juice_1', 0.33], ['obj_drink_glass_empty', 0]] as const) await own(k, 64, 88, glass(lvl));
  await own('obj_drink_milk', 64, 120, milk(false));
  await own('obj_drink_milk_empty', 64, 120, milk(true));

  // Bedroom
  const bed = await glitch('env_home_bed', `${F}/furniture_bed_bed_woodwithstripedsheets.svg`, 170);
  await bedCover('env_home_bed', 'env_home_bed_cover', 0.45);
  await own('env_home_wardrobe_closed', 270, 428, wardrobe(false));
  await own('env_home_wardrobe_open', 400, 428, wardrobe(true));
  const nightstand = await glitch('env_home_nightstand', `${F}/furniture_sidetable_baroque_side_table_pink.svg`, 120);
  await glitch('env_home_table_lamp_off', `${F}/furniture_tablelamp_danish_modern_lamp.svg`, 130);
  await own('obj_toy_pillow', 130, 50, pillow());
  await own('obj_decor_clock', 100, 100, clock());
  await own('obj_toy_blocks', 110, 90, toyBlocks());

  // Bathroom
  await own('env_home_toilet', 140, 176, toilet());
  await own('env_home_bathtub', 440, 176, bathtub());
  await own('env_home_sink_off', 200, 216, sink(false));
  await own('env_home_sink_on', 200, 216, sink(true));
  await own('env_home_laundry_basket', 136, 116, basket());
  await own('obj_bath_towel', 90, 76, towel());
  await own('obj_bath_toothbrush', 96, 36, toothbrush());
  await own('obj_toy_duck', 110, 100, duck());
  void bowlPlate;

  // Table lamp "on": the off sprite with a warm glow behind it.
  {
    const off = srcOf('env_home_table_lamp_off');
    const m = await sharp(off).metadata();
    const glow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${m.width}" height="${m.height}"><defs><radialGradient id="g"><stop offset="0" stop-color="#FFE08A" stop-opacity="0.9"/><stop offset="1" stop-color="#FFE08A" stop-opacity="0"/></radialGradient></defs><ellipse cx="${m.width! / 2}" cy="${m.height! * 0.3}" rx="${m.width! / 2}" ry="${m.height! * 0.3}" fill="url(#g)"/></svg>`);
    const png = await sharp(glow).composite([{ input: off }]).png().toBuffer();
    await save('env_home_table_lamp_on', png, 'own', OWN);
  }

  const S = (asset: string, h: number, w: number) => ({ sprite: sprite(asset, 'furniture'), hitbox: box(w, h) });
  const prop = (asset: string, w: number, h: number, extra: Json = {}): Json => ({
    sprite: sprite(asset, 'props'),
    hitbox: box(Math.max(w, 60), Math.max(h, 50), 10),
    draggable: {},
    animations: { drop: 'squash', tap: 'wiggle' },
    ...extra,
  });

  // ----- living room (10 with the existing toybox, ball and floor lamp) -----
  prefab('furniture', 'sofa', 'furniture', ['furniture'], { ...S('env_home_sofa', sofa.h, sofa.w), seat: { anchor: { x: 0, y: -95 } }, draggable: { mode: 'floorOnly' } }, 'Sofá', 'Sofa');
  prefab('furniture', 'armchair', 'furniture', ['furniture'], { ...S('env_home_armchair', armchair.h, armchair.w), seat: { anchor: { x: 0, y: -100 } }, draggable: { mode: 'floorOnly' } }, 'Sillón', 'Armchair');
  prefab('furniture', 'coffee_table', 'furniture', ['furniture'], { ...S('env_home_coffee_table', coffee.h, coffee.w), surface: { segments: [{ x1: -coffee.w / 2 + 12, x2: coffee.w / 2 - 12, y: -coffee.h + 10 }], carriesItems: true }, draggable: { mode: 'floorOnly' } }, 'Mesa de centro', 'Coffee table');
  prefab('appliance', 'tv', 'appliance', ['furniture', 'appliance'], { sprite: sprite('env_home_tv_off', 'furniture', { byState: { on: 'env_home_tv_on' } }), hitbox: box(340, 300), states: { current: 'off', values: ['off', 'on'] }, switchable: { onState: 'on', offState: 'off' } }, 'Tele', 'TV');
  prefab('toy', 'teddy', 'toy', ['toy'], prop('obj_toy_teddy', teddy.w, teddy.h), 'Osito', 'Teddy bear');
  prefab('toy', 'book', 'toy', ['toy'], prop('obj_toy_book', 90, 70), 'Libro', 'Book');
  prefab('decor', 'plant', 'decor', ['decor'], prop('env_home_plant', plant.w, plant.h, { draggable: { mode: 'floorOnly' } }), 'Maceta', 'Plant pot');

  // ----- kitchen (14 with the existing round table and apple) -----
  prefab('container', 'fridge', 'container', ['furniture', 'appliance'], {
    sprite: sprite('env_home_fridge_closed', 'furniture', { byState: { open: 'env_home_fridge_open' }, pivot: { x: 0.5, y: 1 } }),
    hitbox: { shape: { type: 'rect', x: -100, y: -400, w: 200, h: 400 }, zones: { inside: { type: 'rect', x: -88, y: -388, w: 176, h: 372 } } },
    states: { current: 'closed', values: ['closed', 'open'] },
    openable: { openState: 'open', closedState: 'closed' },
    container: { capacity: 6, accepts: ['food', 'drink'], slots: grid(2, 3, -45, -310, 90, 90) },
  }, 'Nevera', 'Fridge');
  prefab('appliance', 'stove', 'appliance', ['furniture', 'appliance'], { sprite: sprite('env_home_stove_off', 'furniture', { byState: { on: 'env_home_stove_on' } }), hitbox: box(200, 200), states: { current: 'off', values: ['off', 'on'] }, switchable: { onState: 'on', offState: 'off' } }, 'Cocina', 'Stove');
  prefab('container', 'cupboard', 'container', ['furniture'], {
    sprite: sprite('env_home_cupboard', 'furniture'),
    hitbox: { shape: { type: 'rect', x: -110, y: -300, w: 220, h: 300 }, zones: { inside: { type: 'rect', x: -100, y: -290, w: 200, h: 276 } } },
    container: { capacity: 6, accepts: ['food', 'drink'], slots: grid(3, 2, -64, -220, 64, 96) },
  }, 'Alacena', 'Cupboard');
  prefab('furniture', 'chair', 'furniture', ['furniture'], { ...S('env_home_chair', chair.h, chair.w), seat: { anchor: { x: 0, y: -95 } }, draggable: { mode: 'floorOnly' } }, 'Silla', 'Chair');
  prefab('decor', 'fruit_bowl', 'decor', ['decor'], { sprite: sprite('env_home_fruit_bowl', 'props'), hitbox: box(120, 80, 10), spawner: { prefabId: 'apple_red', spawnOffset: { x: 80, y: 0 } } }, 'Frutero', 'Fruit bowl');
  prefab('food', 'banana', 'food', ['food', 'fruit'], prop('obj_food_banana', 80, 60, { edible: { bites: 2, spriteByBitesLeft: { '1': 'obj_food_banana_bite_1' } } }), 'Plátano', 'Banana');
  prefab('food', 'sandwich', 'food', ['food'], prop('obj_food_sandwich', 110, 80, { edible: { bites: 2, spriteByBitesLeft: { '1': 'obj_food_sandwich_bite_1' } } }), 'Sándwich', 'Sandwich');
  prefab('food', 'cake_slice', 'food', ['food', 'sweet'], prop('obj_food_cake', 90, 60, { edible: { bites: 2 } }), 'Porción de pastel', 'Slice of cake');
  prefab('food', 'cookie', 'food', ['food', 'sweet'], prop('obj_food_cookie', 60, 56, { edible: { bites: 1, onFinish: { type: 'remove' } } }), 'Galleta', 'Cookie');
  prefab('food', 'apple_core', 'food', ['food', 'misc'], prop('obj_food_apple_core', 50, 90), 'Corazón de manzana', 'Apple core');
  prefab('drink', 'milk_carton', 'drink', ['drink'], prop('obj_drink_milk', 64, 120, { drinkable: { sips: 3, onFinish: { type: 'replace', prefabId: 'milk_carton_empty' } } }), 'Cartón de leche', 'Milk carton');
  prefab('drink', 'milk_carton_empty', 'misc', ['misc'], prop('obj_drink_milk_empty', 64, 120), 'Cartón vacío', 'Empty carton');
  prefab('drink', 'juice_glass', 'drink', ['drink'], prop('obj_drink_juice', 64, 88, { drinkable: { sips: 3, spriteBySipsLeft: { '2': 'obj_drink_juice_2', '1': 'obj_drink_juice_1' }, onFinish: { type: 'replace', prefabId: 'glass_empty' } } }), 'Vaso de jugo', 'Glass of juice');
  prefab('drink', 'glass_empty', 'misc', ['misc'], prop('obj_drink_glass_empty', 64, 88), 'Vaso vacío', 'Empty glass');

  // ----- bedroom (7) -----
  prefab('furniture', 'bed', 'furniture', ['furniture'], {
    ...S('env_home_bed', bed.h, bed.w),
    surface: { segments: [{ x1: -bed.w / 2 + 30, x2: bed.w / 2 - 30, y: -bed.h * 0.55 }] },
    bed: { anchor: { x: 0, y: -Math.round(bed.h * 0.55) }, coverAsset: 'env_home_bed_cover' },
  }, 'Cama', 'Bed');
  prefab('container', 'wardrobe', 'container', ['furniture'], {
    sprite: sprite('env_home_wardrobe_closed', 'furniture', { byState: { open: 'env_home_wardrobe_open' } }),
    hitbox: { shape: { type: 'rect', x: -130, y: -420, w: 260, h: 420 }, zones: { inside: { type: 'rect', x: -116, y: -404, w: 232, h: 388 } } },
    states: { current: 'closed', values: ['closed', 'open'] },
    openable: { openState: 'open', closedState: 'closed' },
    container: { capacity: 12, accepts: ['clothing'], slots: grid(3, 4, -72, -300, 72, 90) },
  }, 'Armario', 'Wardrobe');
  prefab('furniture', 'nightstand', 'furniture', ['furniture'], { ...S('env_home_nightstand', nightstand.h, nightstand.w), surface: { segments: [{ x1: -nightstand.w / 2 + 10, x2: nightstand.w / 2 - 10, y: -nightstand.h + 8 }], carriesItems: true } }, 'Mesita de noche', 'Nightstand');
  prefab('decor', 'table_lamp', 'decor', ['furniture', 'light'], { sprite: sprite('env_home_table_lamp_off', 'props', { byState: { on: 'env_home_table_lamp_on' } }), hitbox: box(90, 130, 10), draggable: {}, states: { current: 'off', values: ['off', 'on'] }, switchable: { onState: 'on', offState: 'off' } }, 'Lámpara de mesa', 'Table lamp');
  prefab('toy', 'pillow', 'toy', ['toy', 'decor'], prop('obj_toy_pillow', 130, 50), 'Almohada', 'Pillow');
  prefab('decor', 'alarm_clock', 'decor', ['decor'], prop('obj_decor_clock', 100, 100), 'Despertador', 'Alarm clock');
  prefab('toy', 'toy_blocks', 'toy', ['toy'], prop('obj_toy_blocks', 110, 90), 'Bloques de juguete', 'Toy blocks');

  // ----- bathroom (7) -----
  prefab('furniture', 'toilet', 'furniture', ['furniture'], { ...S('env_home_toilet', 176, 140), seat: { anchor: { x: 0, y: -85 } } }, 'Inodoro', 'Toilet');
  prefab('furniture', 'bathtub', 'furniture', ['furniture'], { ...S('env_home_bathtub', 176, 440), seat: { anchor: { x: -60, y: -60 } } }, 'Bañera', 'Bathtub');
  prefab('appliance', 'sink', 'appliance', ['furniture'], { sprite: sprite('env_home_sink_off', 'furniture', { byState: { on: 'env_home_sink_on' } }), hitbox: box(200, 216), states: { current: 'off', values: ['off', 'on'] }, switchable: { onState: 'on', offState: 'off' } }, 'Lavabo', 'Sink');
  prefab('bath', 'towel', 'misc', ['bath'], prop('obj_bath_towel', 90, 76), 'Toalla', 'Towel');
  prefab('bath', 'toothbrush', 'misc', ['bath'], prop('obj_bath_toothbrush', 96, 50), 'Cepillo de dientes', 'Toothbrush');
  prefab('toy', 'rubber_duck', 'toy', ['toy'], prop('obj_toy_duck', 110, 100), 'Patito de goma', 'Rubber duck');
  prefab('container', 'laundry_basket', 'container', ['furniture'], {
    sprite: sprite('env_home_laundry_basket', 'furniture'),
    hitbox: { shape: { type: 'rect', x: -68, y: -116, w: 136, h: 116 }, zones: { inside: { type: 'rect', x: -56, y: -108, w: 112, h: 90 } } },
    draggable: { mode: 'floorOnly' },
    container: { capacity: 4, accepts: ['clothing'], slots: slotsRow(4, -40, 30) },
  }, 'Cesta de ropa', 'Laundry basket');

  // existing prefabs gain food behaviour (HU-GAME-042 R5)
  const applePath = path.join(PACK, 'prefabs', 'food', 'apple_red.json');
  const apple = JSON.parse(fs.readFileSync(applePath, 'utf8'));
  apple.components.edible = { bites: 3, spriteByBitesLeft: { '2': 'obj_food_apple_red_bite_2', '1': 'obj_food_apple_red_bite_1' }, onFinish: { type: 'replace', prefabId: 'apple_core' } };
  fs.writeFileSync(applePath, JSON.stringify(apple, null, 2) + '\n');

  // ---------- write ----------
  for (const pf of prefabs) {
    const dir = path.join(PACK, 'prefabs', pf.dir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${pf.data.id}.json`), JSON.stringify(pf.data, null, 2) + '\n');
  }
  const assetsFile = path.join(PACK, 'assets.json');
  const assets = JSON.parse(fs.readFileSync(assetsFile, 'utf8'));
  Object.assign(assets.images, images);
  assets.images = Object.fromEntries(Object.entries(assets.images).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(assetsFile, JSON.stringify(assets, null, 2) + '\n');
  for (const loc of ['es', 'en'] as const) {
    const file = path.join(PACK, 'locales', `${loc}.json`);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    Object.assign(data, i18n[loc]);
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
  writeScene();
  console.log(`Wrote ${Object.keys(images).length} images and ${prefabs.length} prefabs`);
}

/** The house: 4 rooms of 1920 units (SCENE_SCHEMA §5), everything placed on the floor at y = 960. */
function writeScene() {
  const file = path.join(PACK, 'scenes', 'home.json');
  const scene = JSON.parse(fs.readFileSync(file, 'utf8'));
  const at = (localId: string, prefabId: string, x: number, y = 960, extra: Json = {}) => ({ localId, prefabId, transform: { x, y }, ...extra });
  const inside = (localId: string, prefabId: string, container: string, slot: number) => ({ localId, prefabId, inContainer: { localId: container, slot } });
  scene.entities = [
    // living room 0..1920
    at('sofa', 'sofa', 420),
    at('armchair', 'armchair', 900),
    at('coffee_table', 'coffee_table', 640),
    at('tv', 'tv', 1250),
    at('lamp', 'lamp_floor', 1560),
    at('toybox', 'toybox', 1780),
    inside('toybox_ball', 'ball', 'toybox', 0),
    inside('toybox_book', 'book', 'toybox', 1),
    at('teddy', 'teddy', 1050),
    at('plant', 'plant', 120),
    at('book', 'book', 640, 960 - 80),
    // kitchen 1920..3840
    at('fridge', 'fridge', 2080),
    inside('fridge_milk', 'milk_carton', 'fridge', 0),
    inside('fridge_juice', 'juice_glass', 'fridge', 1),
    inside('fridge_cake', 'cake_slice', 'fridge', 2),
    at('stove', 'stove', 2380),
    at('cupboard', 'cupboard', 2640),
    inside('cupboard_cookie_1', 'cookie', 'cupboard', 0),
    inside('cupboard_cookie_2', 'cookie', 'cupboard', 1),
    inside('cupboard_sandwich', 'sandwich', 'cupboard', 2),
    at('kitchen_table', 'table_round', 3150),
    at('fruit_bowl', 'fruit_bowl', 3120, 960 - 115),
    at('apple_1', 'apple_red', 3270, 960 - 115),
    at('apple_2', 'apple_red', 3200, 960 - 115),
    at('banana', 'banana', 3060, 960 - 115),
    at('chair', 'chair', 3480),
    at('glass', 'glass_empty', 3010, 960 - 115),
    // bedroom 3840..5760
    at('bed', 'bed', 4250),
    at('nightstand', 'nightstand', 4620),
    at('table_lamp', 'table_lamp', 4620, 960 - 112),
    at('alarm_clock', 'alarm_clock', 4000, 960),
    at('pillow', 'pillow', 4300, 960 - 94),
    at('wardrobe', 'wardrobe', 5100),
    inside('wardrobe_top_1', 'shirt_stripe_blue', 'wardrobe', 0),
    inside('wardrobe_top_2', 'shirt_heart_pink', 'wardrobe', 1),
    inside('wardrobe_top_3', 'hoodie_purple', 'wardrobe', 2),
    inside('wardrobe_bottom_1', 'shorts_red', 'wardrobe', 3),
    inside('wardrobe_bottom_2', 'skirt_pink', 'wardrobe', 4),
    inside('wardrobe_bottom_3', 'leggings_yellow', 'wardrobe', 5),
    inside('wardrobe_shoes_1', 'boots_brown', 'wardrobe', 6),
    inside('wardrobe_shoes_2', 'sandals_blue', 'wardrobe', 7),
    at('toy_blocks', 'toy_blocks', 5500),
    // bathroom 5760..7680
    at('toilet', 'toilet', 5950),
    at('bathtub', 'bathtub', 6450),
    at('sink', 'sink', 7000),
    at('towel', 'towel', 7180),
    at('toothbrush', 'toothbrush', 7000, 960 - 172),
    at('rubber_duck', 'rubber_duck', 6450, 960 - 60),
    at('laundry_basket', 'laundry_basket', 7450),
    at('bath_lamp', 'lamp_floor', 7620),
  ];
  fs.writeFileSync(file, JSON.stringify(scene, null, 2) + '\n');
}

void main();
