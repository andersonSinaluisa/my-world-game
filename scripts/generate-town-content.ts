/**
 * Placeholder content of the street and the store building (EPIC-014/018/019, HU-GAME-049/063/064). NOT
 * final art: simple own vector drawings plus a Glitch CC0 bench. Writes images, assets.json entries,
 * prefabs, the street and store scenes, the home front door, map icons, locations and i18n.
 *
 * Usage: npx tsx scripts/generate-town-content.ts   (then npm run content:assets && npm run content:validate)
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const PACK = path.resolve(__dirname, '..', 'content', 'core');
const GLITCH = path.resolve(__dirname, '..', '..', 'assets', 'vendor', 'glitch', 'svg');
const GLITCH_FURNITURE = 'https://opengameart.org/content/glitch-furniture-svg';
const OWN = 'MyWorld placeholder (scripts/generate-town-content.ts)';
const INK = '#3E2C4A';

interface ImageEntry { file: string; w: number; h: number; placeholder: true; license: string; source: string }
const images: Record<string, ImageEntry> = {};
const i18n: { es: Record<string, string>; en: Record<string, string> } = { es: {}, en: {} };
type Json = Record<string, unknown>;

async function save(key: string, png: Buffer, license: string, source: string) {
  const file = `assets/images/${key}.webp`;
  const buf = await sharp(png).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
  fs.writeFileSync(path.join(PACK, file), buf);
  const m = await sharp(buf).metadata();
  images[key] = { file, w: m.width!, h: m.height!, placeholder: true, license, source };
  return { w: m.width!, h: m.height! };
}

async function glitch(key: string, rel: string, height: number) {
  const raster = await sharp(path.join(GLITCH, rel), { density: 300 }).trim().png().toBuffer();
  const sized = await sharp(raster).resize({ height: height - 8 }).extend({ top: 4, bottom: 4, left: 4, right: 4, background: '#00000000' }).png().toBuffer();
  return save(key, sized, 'CC0', GLITCH_FURNITURE);
}

/** Own drawing: SVG body in a w × h canvas whose (0,0) is the bottom center (pivot). */
async function own(key: string, w: number, h: number, body: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${-w / 2} ${-h} ${w} ${h}">${body}</svg>`;
  return save(key, Buffer.from(svg), 'own', OWN);
}

/** Full-size background chunk (1920 × 1080, top-left origin). */
async function background(key: string, body: string) {
  return save(key, Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">${body}</svg>`), 'own', OWN);
}

const r = (x: number, y: number, w: number, h: number, fill: string, rx = 6, sw = 4, stroke = INK) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const c = (x: number, y: number, rad: number, fill: string, sw = 4) => `<circle cx="${x}" cy="${y}" r="${rad}" fill="${fill}" stroke="${INK}" stroke-width="${sw}"/>`;
const p = (d: string, fill: string, sw = 4) => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;

// ---------- drawings ----------

/** A door in its frame; open shows the dark doorway and the leaf swung to the side. */
const door = (color: string, open: boolean, glass = false) =>
  r(-100, -400, 200, 396, '#F3E1C7', 10) +
  (open
    ? r(-88, -388, 176, 384, '#3E2C4A', 6, 2) + p('M88 -388 L150 -370 L150 -20 L88 -4 Z', color)
    : r(-88, -388, 176, 384, color, 6) + (glass ? r(-70, -360, 140, 200, '#BEE9FF', 8, 3) : r(-66, -360, 132, 120, '#00000018', 8, 2) + r(-66, -210, 132, 150, '#00000018', 8, 2)) + c(60, -190, 9, '#FFD23F', 3));
const streetLamp = (on: boolean) =>
  (on ? `<ellipse cx="0" cy="-470" rx="110" ry="80" fill="#FFE08A" opacity="0.55"/>` : '') +
  r(-14, -440, 28, 436, '#546E7A', 6) + r(-40, -20, 80, 20, '#455A64', 6) + p('M-46 -440 L46 -440 L30 -500 L-30 -500 Z', on ? '#FFE08A' : '#CFD8DC') + r(-50, -514, 100, 18, '#455A64', 6);
const mailbox = (open: boolean) =>
  r(-12, -120, 24, 116, '#546E7A', 4) + r(-70, -250, 140, 130, '#4FB3F6', 18) + (open ? p('M-60 -226 L60 -226 L70 -270 L-50 -270 Z', '#81C8F8') + r(-56, -222, 112, 20, '#1B1B24', 4, 2) : r(-56, -222, 112, 16, '#1B1B24', 4, 2)) + r(-50, -170, 100, 10, '#FFFFFF', 3, 2);
const shelf = () =>
  r(-160, -420, 320, 416, '#C98E5B', 10) + [-300, -180, -60].map((y) => r(-150, y, 300, 14, '#A1734A', 4, 3)).join('') + r(-150, -408, 300, 100, '#F3E1C7', 6, 2) + r(-150, -286, 300, 100, '#F3E1C7', 6, 2) + r(-150, -166, 300, 100, '#F3E1C7', 6, 2);
const register = () =>
  r(-220, -170, 440, 166, '#FF8A3D', 16) + r(-200, -150, 400, 20, '#FFB27A', 6, 2) + r(-60, -300, 170, 130, '#ECEFF1', 12) + r(-44, -284, 138, 50, '#9EE6FF', 6, 3) + [0, 1, 2].map((i) => r(-40 + i * 44, -222, 36, 30, '#FFFFFF', 5, 2)).join('');
const fridgeDisplay = (open: boolean) =>
  r(-150, -420, 300, 416, '#ECEFF1', 16) + r(-134, -404, 268, 384, open ? '#DCEAF5' : '#BEE9FF', 10, 3) + [-300, -190, -80].map((y) => r(-130, y, 260, 8, '#FFFFFF', 3, 2)).join('') + (open ? r(134, -404, 70, 384, '#EAF2F8', 10) : r(110, -260, 10, 80, '#B0BEC5', 4, 2));

/** Map icons: a round tile with a little picture (ui, HU-GAME-051). */
const tile = (bg: string, picture: string) => `<circle cx="0" cy="-100" r="92" fill="${bg}" stroke="${INK}" stroke-width="8"/>` + picture;
const houseIcon = () => tile('#FFE3C2', p('M-60 -100 L0 -160 L60 -100 Z', '#E94F4F') + r(-48, -100, 96, 70, '#FFF6E9') + r(-14, -76, 28, 46, '#8D6E63', 4, 3));
const streetIcon = () => tile('#BEE9FF', r(-80, -60, 160, 30, '#90A4AE', 4) + `<line x1="-60" y1="-45" x2="-20" y2="-45" stroke="#FFFFFF" stroke-width="6"/><line x1="20" y1="-45" x2="60" y2="-45" stroke="#FFFFFF" stroke-width="6"/>` + c(-40, -120, 30, '#7ED957') + r(-44, -90, 8, 30, '#8D6E63', 2, 2) + r(30, -150, 10, 90, '#546E7A', 3, 2) + c(35, -156, 12, '#FFE08A', 3));
const storeIcon = () => tile('#D8F3DC', r(-64, -130, 128, 100, '#FFF6E9') + p('M-72 -130 L72 -130 L64 -160 L-64 -160 Z', '#FF8A3D') + r(-18, -84, 36, 54, '#4FB3F6', 4, 3) + c(0, -110, 14, '#FFD23F', 3));

// ---------- backgrounds ----------

const sky = () =>
  `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FD3FF"/><stop offset="1" stop-color="#E3F6FF"/></linearGradient></defs><rect width="1920" height="1080" fill="url(#s)"/>` +
  [[260, 170], [900, 110], [1500, 210]].map(([x, y]) => `<g fill="#FFFFFF" opacity="0.9"><ellipse cx="${x}" cy="${y}" rx="120" ry="44"/><ellipse cx="${x + 70}" cy="${y - 26}" rx="80" ry="40"/><ellipse cx="${x - 70}" cy="${y - 10}" rx="70" ry="34"/></g>`).join('');
const sidewalk = () =>
  `<rect x="0" y="930" width="1920" height="40" fill="#CFD8DC" stroke="${INK}" stroke-width="4"/><rect x="0" y="970" width="1920" height="110" fill="#90A4AE"/>` +
  Array.from({ length: 12 }, (_, i) => `<rect x="${i * 170 + 40}" y="1016" width="90" height="12" rx="5" fill="#FFFFFF" opacity="0.8"/>`).join('');
const houseFacade = (x: number, w: number, wall: string, roof: string) =>
  `<rect x="${x}" y="420" width="${w}" height="510" fill="${wall}" stroke="${INK}" stroke-width="6"/>` +
  `<path d="M${x - 30} 430 L${x + w / 2} 250 L${x + w + 30} 430 Z" fill="${roof}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>` +
  [0.2, 0.62].map((f) => `<rect x="${x + w * f}" y="520" width="${w * 0.2}" height="140" rx="10" fill="#BEE9FF" stroke="${INK}" stroke-width="5"/>`).join('');
const tree = (x: number) => `<rect x="${x - 16}" y="700" width="32" height="240" fill="#8D6E63" stroke="${INK}" stroke-width="5"/><circle cx="${x}" cy="640" r="120" fill="#7ED957" stroke="${INK}" stroke-width="6"/><circle cx="${x - 70}" cy="700" r="70" fill="#6CC644" stroke="${INK}" stroke-width="5"/>`;
const storeWall = (checkout: boolean) =>
  `<rect width="1920" height="960" fill="#D8F3DC"/>` +
  Array.from({ length: 10 }, (_, i) => `<rect x="${i * 200 + 60}" y="0" width="80" height="930" fill="#FFFFFF" opacity="0.25"/>`).join('') +
  `<rect x="0" y="930" width="1920" height="30" fill="#FFFFFF" stroke="${INK}" stroke-width="4"/><rect x="0" y="960" width="1920" height="120" fill="#E9E4DA"/>` +
  Array.from({ length: 24 }, (_, i) => `<line x1="${i * 80}" y1="960" x2="${i * 80}" y2="1080" stroke="#00000014" stroke-width="3"/>`).join('') +
  (checkout
    ? `<rect x="1050" y="160" width="520" height="120" rx="20" fill="#FF8A3D" stroke="${INK}" stroke-width="6"/><circle cx="1310" cy="220" r="40" fill="#FFD23F" stroke="${INK}" stroke-width="5"/>`
    : `<rect x="560" y="200" width="640" height="300" rx="18" fill="#BEE9FF" stroke="${INK}" stroke-width="8"/><line x1="880" y1="200" x2="880" y2="500" stroke="${INK}" stroke-width="6"/>`);

// ---------- prefabs ----------

const prefabs: { dir: string; data: Json }[] = [];
function prefab(dir: string, id: string, category: string, tags: string[], components: Json, es: string, en: string) {
  i18n.es[`object.${id}.name`] = es;
  i18n.en[`object.${id}.name`] = en;
  prefabs.push({ dir, data: { id, category, tags, components, metadata: { name: `object.${id}.name`, placeholder: true } } });
}
const box = (w: number, h: number): Json => ({ shape: { type: 'rect', x: -w / 2, y: -h, w, h } });
const openableDoor = (closed: string, open: string): Json => ({
  sprite: { asset: closed, layer: 'furniture', byState: { open } },
  hitbox: box(200, 400),
  states: { current: 'closed', values: ['closed', 'open'] },
  openable: { openState: 'open', closedState: 'closed' },
});
const grid = (cols: number, rows: number, x0: number, y0: number, dx: number, dy: number) =>
  Array.from({ length: cols * rows }, (_, i) => ({ x: x0 + (i % cols) * dx, y: y0 + Math.floor(i / cols) * dy }));

async function main() {
  // Doors (inside the house, street side and store) — HU-GAME-049 RN-11.
  for (const [key, color, glass] of [
    ['env_home_door_front', '#C98E5B', false],
    ['env_street_door_home', '#E94F4F', false],
    ['env_street_door_store', '#4FB3F6', true],
    ['env_store_door_entrance', '#4FB3F6', true],
  ] as const) {
    await own(key, 320, 408, door(color, false, glass));
    await own(`${key}_open`, 320, 408, door(color, true, glass));
  }
  await own('env_street_lamp_off', 240, 530, streetLamp(false));
  await own('env_street_lamp_on', 240, 560, streetLamp(true));
  await own('env_street_mailbox_blue_closed', 160, 280, mailbox(false));
  await own('env_street_mailbox_blue_open', 160, 280, mailbox(true));
  const bench = await glitch('env_street_bench_park_green', 'furniture/furniture/furniture_bench_firebog_green_bench.svg', 150);
  await own('env_store_shelf_wood', 330, 428, shelf());
  await own('env_store_register_01', 460, 308, register());
  await own('env_store_fridge_display_closed', 310, 428, fridgeDisplay(false));
  await own('env_store_fridge_display_open', 390, 428, fridgeDisplay(true));
  await own('ui_map_home', 200, 200, houseIcon());
  await own('ui_map_street', 200, 200, streetIcon());
  await own('ui_map_store', 200, 200, storeIcon());

  await background('env_street_sky_01', sky());
  await background('env_street_bg_home_01', houseFacade(80, 520, '#FFE3C2', '#E94F4F') + houseFacade(1200, 560, '#E3D7FF', '#7E57C2') + sidewalk());
  await background('env_street_bg_park_01', `<rect x="0" y="780" width="1920" height="150" fill="#9BE07B"/>` + tree(300) + tree(900) + tree(1600) + sidewalk());
  await background('env_street_bg_store_01', `<rect x="500" y="360" width="1200" height="570" fill="#FFF6E9" stroke="${INK}" stroke-width="6"/><path d="M460 380 L1740 380 L1700 300 L500 300 Z" fill="#FF8A3D" stroke="${INK}" stroke-width="6"/>` + [0, 1, 2, 3, 4, 5].map((i) => `<rect x="${520 + i * 200}" y="380" width="100" height="60" fill="#FFFFFF" opacity="0.8"/>`).join('') + `<rect x="1000" y="480" width="420" height="260" rx="16" fill="#BEE9FF" stroke="${INK}" stroke-width="6"/>` + sidewalk());
  await background('env_store_bg_entrance_01', storeWall(false));
  await background('env_store_bg_checkout_01', storeWall(true));

  prefab('door', 'door_front', 'furniture', ['door'], { ...openableDoor('env_home_door_front', 'env_home_door_front_open'), portal: { targetSceneId: 'core:street', targetSpawnId: 'home_door' } }, 'Puerta de entrada', 'Front door');
  prefab('door', 'door_home_outside', 'furniture', ['door'], { ...openableDoor('env_street_door_home', 'env_street_door_home_open'), portal: { targetSceneId: 'core:home', targetSpawnId: 'front_door' } }, 'Puerta de casa', 'Home door');
  prefab('door', 'door_store', 'furniture', ['door'], { ...openableDoor('env_street_door_store', 'env_street_door_store_open'), portal: { targetSceneId: 'core:store', targetSpawnId: 'entrance' } }, 'Puerta de la tienda', 'Store door');
  prefab('door', 'door_store_inside', 'furniture', ['door'], { ...openableDoor('env_store_door_entrance', 'env_store_door_entrance_open'), portal: { targetSceneId: 'core:street', targetSpawnId: 'store_door' } }, 'Salida de la tienda', 'Store exit');
  prefab('furniture', 'bench_park', 'furniture', ['furniture'], {
    sprite: { asset: 'env_street_bench_park_green', layer: 'furniture' },
    hitbox: box(bench.w, bench.h),
    seat: { anchor: { x: 0, y: -Math.round(bench.h * 0.55) } },
    surface: { segments: [{ x1: -bench.w / 2 + 20, x2: bench.w / 2 - 20, y: -Math.round(bench.h * 0.55) }] },
  }, 'Banco del parque', 'Park bench');
  prefab('furniture', 'street_lamp', 'furniture', ['furniture', 'light'], {
    sprite: { asset: 'env_street_lamp_off', layer: 'furniture', byState: { on: 'env_street_lamp_on' } },
    hitbox: box(120, 520),
    states: { current: 'off', values: ['off', 'on'] },
    switchable: { onState: 'on', offState: 'off' },
  }, 'Farola', 'Street lamp');
  prefab('container', 'mailbox', 'container', ['furniture'], {
    sprite: { asset: 'env_street_mailbox_blue_closed', layer: 'furniture', byState: { open: 'env_street_mailbox_blue_open' } },
    hitbox: { shape: { type: 'rect', x: -70, y: -260, w: 140, h: 260 }, zones: { inside: { type: 'rect', x: -64, y: -250, w: 128, h: 120 } } },
    states: { current: 'closed', values: ['closed', 'open'] },
    openable: { openState: 'open', closedState: 'closed' },
    container: { capacity: 4, slots: grid(2, 2, -30, -200, 60, 50) },
  }, 'Buzón', 'Mailbox');
  prefab('furniture', 'store_shelf', 'furniture', ['furniture'], {
    sprite: { asset: 'env_store_shelf_wood', layer: 'furniture' },
    hitbox: box(320, 420),
    surface: { segments: [-300, -180, -60].map((y) => ({ x1: -140, x2: 140, y })) },
  }, 'Estante', 'Shelf');
  prefab('furniture', 'cash_register', 'furniture', ['furniture', 'checkout'], {
    sprite: { asset: 'env_store_register_01', layer: 'furniture' },
    hitbox: { shape: { type: 'rect', x: -220, y: -300, w: 440, h: 300 }, zones: { body: { type: 'rect', x: -220, y: -300, w: 440, h: 300 } } },
    surface: { segments: [{ x1: -200, x2: -70, y: -170 }, { x1: 120, x2: 200, y: -170 }] },
  }, 'Caja registradora', 'Cash register');
  prefab('container', 'fridge_display', 'container', ['furniture', 'appliance'], {
    sprite: { asset: 'env_store_fridge_display_closed', layer: 'furniture', byState: { open: 'env_store_fridge_display_open' } },
    hitbox: { shape: { type: 'rect', x: -150, y: -420, w: 300, h: 420 }, zones: { inside: { type: 'rect', x: -134, y: -404, w: 268, h: 384 } } },
    states: { current: 'closed', values: ['closed', 'open'] },
    openable: { openState: 'open', closedState: 'closed' },
    container: { capacity: 6, accepts: ['food', 'drink'], slots: grid(2, 3, -60, -330, 120, 110) },
  }, 'Nevera de la tienda', 'Store fridge');

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

  Object.assign(i18n.es, {
    'scene.street.name': 'Calle', 'scene.store.name': 'Tienda',
    'location.home.name': 'Casa', 'location.street.name': 'Calle', 'location.store.name': 'Tienda',
    'zone.home_front.name': 'Frente a casa', 'zone.park.name': 'Parque', 'zone.store_front.name': 'Frente a la tienda',
    'zone.entrance.name': 'Entrada', 'zone.shelves.name': 'Estantes', 'zone.checkout.name': 'Caja',
  });
  Object.assign(i18n.en, {
    'scene.street.name': 'Street', 'scene.store.name': 'Store',
    'location.home.name': 'Home', 'location.street.name': 'Street', 'location.store.name': 'Store',
    'zone.home_front.name': 'In front of home', 'zone.park.name': 'Park', 'zone.store_front.name': 'In front of the store',
    'zone.entrance.name': 'Entrance', 'zone.shelves.name': 'Shelves', 'zone.checkout.name': 'Checkout',
  });
  for (const loc of ['es', 'en'] as const) {
    const file = path.join(PACK, 'locales', `${loc}.json`);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    Object.assign(data, i18n[loc]);
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
  writeScenes();
  writeManifest();
  console.log(`Wrote ${Object.keys(images).length} images and ${prefabs.length} prefabs`);
}

const at = (localId: string, prefabId: string, x: number, y = 960) => ({ localId, prefabId, transform: { x, y } });

function writeScenes() {
  const street = {
    id: 'street',
    name: 'scene.street.name',
    location: 'street',
    size: { width: 5760, height: 1080 },
    background: {
      layers: [
        { id: 'sky', parallax: 0.5, chunks: [0, 1920, 3840].map((x) => ({ asset: 'env_street_sky_01', x, width: 1920 })) },
        {
          id: 'street',
          chunks: [
            { asset: 'env_street_bg_home_01', x: 0, width: 1920 },
            { asset: 'env_street_bg_park_01', x: 1920, width: 1920 },
            { asset: 'env_street_bg_store_01', x: 3840, width: 1920 },
          ],
        },
      ],
    },
    floor: [{ y: 960 }],
    zones: [
      { id: 'home_front', name: 'zone.home_front.name', x1: 0, x2: 1920, snapCameraX: 960 },
      { id: 'park', name: 'zone.park.name', x1: 1920, x2: 3840, snapCameraX: 2880 },
      { id: 'store_front', name: 'zone.store_front.name', x1: 3840, x2: 5760, snapCameraX: 4800 },
    ],
    spawnPoints: [
      { id: 'default', x: 960, y: 960 },
      { id: 'home_door', x: 820, y: 960, facing: 'right' },
      { id: 'store_door', x: 4700, y: 960, facing: 'left' },
    ],
    entities: [
      at('home_door', 'door_home_outside', 700),
      at('mailbox', 'mailbox', 1500),
      at('bench', 'bench_park', 2700),
      at('street_lamp', 'street_lamp', 3200),
      at('store_door', 'door_store', 4820),
    ],
    audio: { music: 'mus_street_day_01', ambience: 'amb_street_birds_01' },
    transitionColor: '#BEE9FF',
    metadata: { placeholder: true },
  };
  const store = {
    id: 'store',
    name: 'scene.store.name',
    location: 'store',
    size: { width: 3840, height: 1080 },
    background: {
      layers: [
        {
          id: 'walls',
          chunks: [
            { asset: 'env_store_bg_entrance_01', x: 0, width: 1920 },
            { asset: 'env_store_bg_checkout_01', x: 1920, width: 1920 },
          ],
        },
      ],
    },
    floor: [{ y: 960 }],
    zones: [
      { id: 'entrance', name: 'zone.entrance.name', x1: 0, x2: 1280, snapCameraX: 640 },
      { id: 'shelves', name: 'zone.shelves.name', x1: 1280, x2: 2560, snapCameraX: 1920 },
      { id: 'checkout', name: 'zone.checkout.name', x1: 2560, x2: 3840, snapCameraX: 3200 },
    ],
    spawnPoints: [
      { id: 'default', x: 500, y: 960 },
      { id: 'entrance', x: 360, y: 960, facing: 'right' },
    ],
    entities: [
      at('entrance_door', 'door_store_inside', 200),
      at('fridge_display', 'fridge_display', 850),
      at('shelf_1', 'store_shelf', 1350),
      at('shelf_2', 'store_shelf', 1900),
      at('shelf_3', 'store_shelf', 2450),
      at('register', 'cash_register', 3200),
    ],
    audio: { music: 'mus_store_happy_01', ambience: 'amb_store_murmur_01' },
    transitionColor: '#D8F3DC',
    metadata: { placeholder: true },
  };
  // Only the parts this script owns are replaced: a later epic adds the products to the store.
  const storeFile = path.join(PACK, 'scenes', 'store.json');
  if (fs.existsSync(storeFile)) {
    const old = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
    const mine = new Set(store.entities.map((e) => e.localId));
    store.entities.push(...old.entities.filter((e: { localId: string }) => !mine.has(e.localId)));
  }
  fs.writeFileSync(path.join(PACK, 'scenes', 'street.json'), JSON.stringify(street, null, 2) + '\n');
  fs.writeFileSync(storeFile, JSON.stringify(store, null, 2) + '\n');

  // The house gets its front door (HU-GAME-059 RN-6, now with the portal of HU-GAME-049).
  const homeFile = path.join(PACK, 'scenes', 'home.json');
  const home = JSON.parse(fs.readFileSync(homeFile, 'utf8'));
  home.entities = home.entities.filter((e: { localId: string }) => e.localId !== 'front_door');
  const plant = home.entities.find((e: { localId: string }) => e.localId === 'plant');
  if (plant) plant.transform.x = 1660;
  home.entities.unshift(at('front_door', 'door_front', 120));
  home.transitionColor = '#FFE3C2';
  fs.writeFileSync(homeFile, JSON.stringify(home, null, 2) + '\n');
}

function writeManifest() {
  const file = path.join(PACK, 'manifest.json');
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  m.provides.scenes = ['home', 'street', 'store'];
  m.provides.locations = [
    { id: 'home', name: 'location.home.name', icon: 'ui_map_home', entrySceneId: 'core:home', entrySpawnId: 'front_door' },
    { id: 'street', name: 'location.street.name', icon: 'ui_map_street', entrySceneId: 'core:street', entrySpawnId: 'default' },
    { id: 'store', name: 'location.store.name', icon: 'ui_map_store', entrySceneId: 'core:store', entrySpawnId: 'entrance' },
  ];
  m.newGame.unlocks = ['core:home', 'core:street', 'core:store'];
  fs.writeFileSync(file, JSON.stringify(m, null, 2) + '\n');
}

void main();
