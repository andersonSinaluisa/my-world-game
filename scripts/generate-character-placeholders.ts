/**
 * Placeholder character art for the core pack (HU-GAME-013..021). NOT final art (ART_DIRECTION):
 * simple vector shapes rasterized to WebP so the character system, the creator and the clothes can be
 * developed and tested before the production batch arrives.
 *
 * Writes:
 *   content/core/assets/images/{chr_*,obj_clothing_*,ui_creator_*}.webp
 *   content/core/assets.json          (entries with placeholder: true)
 *   content/core/characters/parts.json
 *   content/core/prefabs/clothing/*.json
 *   content/core/locales/{es,en}.json (names)
 *
 * Usage: npx tsx scripts/generate-character-placeholders.ts   (then npm run content:assets)
 * Body parts, skin and hair are grayscale: the game tints them (CHARACTER_SYSTEM §4). Clothes are colored.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const PACK = path.resolve(__dirname, '..', 'content', 'core');
const IMAGES = path.join(PACK, 'assets', 'images');
const SOURCE = 'MyWorld placeholder (scripts/generate-character-placeholders.ts)';

// ---------- geometry (world units; pivot = bottom center, y up is negative) ----------

interface Body {
  id: 'child' | 'adult';
  canvasH: number;
  height: number;
  legTop: number;
  legW: number;
  legGap: number;
  torsoHalf: number;
  torsoTop: number;
  torsoBottom: number;
  armX1: number;
  armX2: number;
  handY: number;
  headY: number;
  headR: number;
}

const W = 240;
const BODIES: Body[] = [
  { id: 'child', canvasH: 340, height: 300, legTop: -110, legW: 22, legGap: 6, torsoHalf: 40, torsoTop: -192, torsoBottom: -100, armX1: 40, armX2: 58, handY: -148, headY: -245, headR: 55 },
  { id: 'adult', canvasH: 460, height: 420, legTop: -160, legW: 26, legGap: 8, torsoHalf: 48, torsoTop: -290, torsoBottom: -150, armX1: 48, armX2: 68, handY: -198, headY: -365, headR: 55 },
];
const CHILD = BODIES[0];
const faceOffset = (b: Body) => b.headY - CHILD.headY;

const SKIN = { fill: '#F2F2F2', stroke: '#8C8C8C', shade: '#BDBDBD' };
const HAIR = { fill: '#DCDCDC', stroke: '#7A7A7A' };
const INK = '#3E2C4A';

/** SVG with the pivot at the bottom center of a W × H canvas. */
function svg(h: number, body: string, width = W, viewBox?: string): string {
  const vb = viewBox ?? `${-width / 2} ${-h} ${width} ${h}`;
  const [, , vw, vh] = vb.split(' ').map(Number);
  const scale = width / vw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.round(vh * scale)}" viewBox="${vb}">${body}</svg>`;
}

const rect = (x: number, y: number, w: number, h: number, fill: string, stroke = 'none', r = 0, sw = 4) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const circle = (cx: number, cy: number, r: number, fill: string, stroke = 'none', sw = 4) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string, stroke = 'none', sw = 4) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const pathEl = (d: string, fill: string, stroke = 'none', sw = 4) =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;

// ---------- body layers (grayscale, tinted with the skin tone) ----------

function legs(b: Body): string {
  const lx = -b.legGap / 2 - b.legW;
  const rx = b.legGap / 2;
  const h = -b.legTop - 6;
  return (
    rect(lx, b.legTop, b.legW, h, SKIN.fill, SKIN.stroke, 8) +
    rect(rx, b.legTop, b.legW, h, SKIN.fill, SKIN.stroke, 8) +
    ellipse(lx + b.legW / 2 - 4, -8, b.legW / 2 + 6, 8, SKIN.fill, SKIN.stroke) +
    ellipse(rx + b.legW / 2 + 4, -8, b.legW / 2 + 6, 8, SKIN.fill, SKIN.stroke) +
    // underwear painted on the base body (CHARACTER_GUIDELINES: never shown bare)
    rect(lx - 2, b.legTop - 4, b.legW * 2 + b.legGap + 4, 30, SKIN.shade, SKIN.stroke, 8)
  );
}

function torso(b: Body): string {
  const h = b.torsoBottom - b.torsoTop;
  return (
    rect(-10, b.torsoTop - 14, 20, 20, SKIN.fill, SKIN.stroke, 6) + // neck
    rect(-b.torsoHalf, b.torsoTop, b.torsoHalf * 2, h + 8, SKIN.fill, SKIN.stroke, 18) +
    rect(-b.torsoHalf + 6, b.torsoTop + 6, b.torsoHalf * 2 - 12, h * 0.55, SKIN.shade, 'none', 14) // undershirt
  );
}

function arm(b: Body, side: 1 | -1): string {
  const x1 = side === 1 ? b.armX1 : -b.armX2;
  const w = b.armX2 - b.armX1;
  const top = b.torsoTop + 4;
  const cx = x1 + w / 2;
  return rect(x1, top, w, b.handY - top, SKIN.fill, SKIN.stroke, 9) + circle(cx, b.handY + 2, w / 2 + 2, SKIN.fill, SKIN.stroke);
}

function head(b: Body): string {
  const r = b.headR;
  return circle(-r + 4, b.headY + 4, 10, SKIN.fill, SKIN.stroke) + circle(r - 4, b.headY + 4, 10, SKIN.fill, SKIN.stroke) + circle(0, b.headY, r, SKIN.fill, SKIN.stroke);
}

// ---------- face (drawn on the child canvas; other bodies use faceOffset) ----------

const EYE_Y = CHILD.headY - 6;
const EYE_X = 20;
const MOUTH_Y = CHILD.headY + 24;

const EYES: Record<string, { open: string; closed: string; es: string; en: string }> = {
  eyes_round: { open: [-1, 1].map((s) => circle(s * EYE_X, EYE_Y, 9, '#FFFFFF', INK, 3) + circle(s * EYE_X, EYE_Y + 1, 5, INK)).join(''), closed: '', es: 'Ojos redondos', en: 'Round eyes' },
  eyes_dot: { open: [-1, 1].map((s) => circle(s * EYE_X, EYE_Y, 5, INK)).join(''), closed: '', es: 'Ojos de punto', en: 'Dot eyes' },
  eyes_big: {
    open: [-1, 1].map((s) => circle(s * EYE_X, EYE_Y, 12, '#FFFFFF', INK, 3) + circle(s * EYE_X, EYE_Y + 2, 7, INK) + circle(s * EYE_X + 3, EYE_Y - 2, 2.5, '#FFFFFF')).join(''),
    closed: '',
    es: 'Ojos grandes',
    en: 'Big eyes',
  },
  eyes_sleepy: {
    open: [-1, 1].map((s) => circle(s * EYE_X, EYE_Y + 2, 7, '#FFFFFF', INK, 3) + circle(s * EYE_X, EYE_Y + 3, 4, INK) + pathEl(`M${s * EYE_X - 9} ${EYE_Y - 1} L${s * EYE_X + 9} ${EYE_Y - 1}`, 'none', INK, 3)).join(''),
    closed: '',
    es: 'Ojos tranquilos',
    en: 'Calm eyes',
  },
  eyes_lashes: {
    open: [-1, 1]
      .map((s) => circle(s * EYE_X, EYE_Y, 9, '#FFFFFF', INK, 3) + circle(s * EYE_X, EYE_Y + 1, 5, INK) + pathEl(`M${s * EYE_X + s * 6} ${EYE_Y - 8} l${s * 5} -5 M${s * EYE_X} ${EYE_Y - 10} l0 -6`, 'none', INK, 2.5))
      .join(''),
    closed: '',
    es: 'Ojos con pestañas',
    en: 'Eyes with lashes',
  },
  eyes_star: {
    open: [-1, 1].map((s) => circle(s * EYE_X, EYE_Y, 10, '#FFFFFF', INK, 3) + pathEl(star(s * EYE_X, EYE_Y + 1, 6, 2.6), INK)).join(''),
    closed: '',
    es: 'Ojos de estrella',
    en: 'Star eyes',
  },
};
const CLOSED_EYES = [-1, 1].map((s) => pathEl(`M${s * EYE_X - 9} ${EYE_Y} Q${s * EYE_X} ${EYE_Y + 8} ${s * EYE_X + 9} ${EYE_Y}`, 'none', INK, 3)).join('');

const MOUTHS: Record<string, { svg: string; es: string; en: string }> = {
  mouth_smile: { svg: pathEl(`M-14 ${MOUTH_Y} Q0 ${MOUTH_Y + 14} 14 ${MOUTH_Y}`, 'none', INK, 3.5), es: 'Sonrisa', en: 'Smile' },
  mouth_grin: { svg: pathEl(`M-16 ${MOUTH_Y - 2} Q0 ${MOUTH_Y + 18} 16 ${MOUTH_Y - 2} Z`, '#FFFFFF', INK, 3), es: 'Sonrisa grande', en: 'Big grin' },
  mouth_flat: { svg: pathEl(`M-10 ${MOUTH_Y + 3} L10 ${MOUTH_Y + 3}`, 'none', INK, 3.5), es: 'Boca seria', en: 'Straight mouth' },
  mouth_o: { svg: ellipse(0, MOUTH_Y + 4, 6, 7, '#C0395A', INK, 3), es: 'Boca en O', en: 'O mouth' },
  mouth_cat: { svg: pathEl(`M-12 ${MOUTH_Y} q6 8 12 0 q6 8 12 0`, 'none', INK, 3.5), es: 'Boca de gato', en: 'Cat mouth' },
  mouth_tongue: {
    svg: pathEl(`M-14 ${MOUTH_Y} Q0 ${MOUTH_Y + 14} 14 ${MOUTH_Y}`, 'none', INK, 3.5) + ellipse(4, MOUTH_Y + 8, 5, 5, '#E86A8A', INK, 2),
    es: 'Lengua fuera',
    en: 'Tongue out',
  },
};
const EXPRESSION_MOUTHS: Record<string, string> = {
  happy: pathEl(`M-18 ${MOUTH_Y - 3} Q0 ${MOUTH_Y + 22} 18 ${MOUTH_Y - 3} Z`, '#C0395A', INK, 3),
  surprised: ellipse(0, MOUTH_Y + 5, 8, 10, '#C0395A', INK, 3),
  yum: pathEl(`M-14 ${MOUTH_Y} Q0 ${MOUTH_Y + 14} 14 ${MOUTH_Y}`, 'none', INK, 3.5) + ellipse(8, MOUTH_Y + 7, 6, 6, '#E86A8A', INK, 2),
};

function star(cx: number, cy: number, r: number, ri: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? ri : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}

// ---------- hair (grayscale, tinted with the hair color) ----------

const HY = CHILD.headY;
const HR = CHILD.headR;
const cap = pathEl(`M${-HR - 4} ${HY + 4} Q${-HR - 6} ${HY - HR - 12} 0 ${HY - HR - 10} Q${HR + 6} ${HY - HR - 12} ${HR + 4} ${HY + 4} Q${HR - 8} ${HY - 22} 0 ${HY - 26} Q${-HR + 8} ${HY - 22} ${-HR - 4} ${HY + 4} Z`, HAIR.fill, HAIR.stroke);

const HAIRS: Record<string, { front: string; back?: string; es: string; en: string }> = {
  hair_short: { front: cap, es: 'Pelo corto', en: 'Short hair' },
  hair_buns: { front: circle(-HR + 6, HY - HR + 2, 20, HAIR.fill, HAIR.stroke) + circle(HR - 6, HY - HR + 2, 20, HAIR.fill, HAIR.stroke) + cap, es: 'Moñitos', en: 'Buns' },
  hair_long: { front: cap, back: pathEl(`M${-HR - 8} ${HY - 10} Q0 ${HY - HR - 30} ${HR + 8} ${HY - 10} L${HR + 14} ${HY + 95} L${-HR - 14} ${HY + 95} Z`, HAIR.fill, HAIR.stroke), es: 'Pelo largo', en: 'Long hair' },
  hair_curly: {
    front: [-44, -26, -8, 10, 28, 46].map((x, i) => circle(x, HY - HR + (i % 2 ? 2 : -4) + Math.abs(x) * 0.35, 17, HAIR.fill, HAIR.stroke)).join(''),
    back: [-58, -60, 58, 60].map((x, i) => circle(x, HY + (i % 2 ? 26 : -4), 17, HAIR.fill, HAIR.stroke)).join(''),
    es: 'Pelo rizado',
    en: 'Curly hair',
  },
  hair_ponytail: { front: cap, back: pathEl(`M${HR - 10} ${HY - 30} Q${HR + 50} ${HY - 10} ${HR + 30} ${HY + 70} Q${HR + 10} ${HY + 20} ${HR - 10} ${HY - 10} Z`, HAIR.fill, HAIR.stroke), es: 'Coleta', en: 'Ponytail' },
  hair_bob: {
    front: cap + rect(-HR - 8, HY - 10, 18, 50, HAIR.fill, HAIR.stroke, 8) + rect(HR - 10, HY - 10, 18, 50, HAIR.fill, HAIR.stroke, 8),
    back: rect(-HR - 6, HY - 20, HR * 2 + 12, 62, HAIR.fill, HAIR.stroke, 20),
    es: 'Media melena',
    en: 'Bob',
  },
  hair_spiky: { front: pathEl(`M${-HR - 2} ${HY - 4} L${-HR + 4} ${HY - HR - 22} L-24 ${HY - HR - 4} L-10 ${HY - HR - 30} L6 ${HY - HR - 6} L22 ${HY - HR - 28} L32 ${HY - HR - 2} L${HR + 2} ${HY - HR - 14} L${HR + 2} ${HY - 4} Q0 ${HY - 32} ${-HR - 2} ${HY - 4} Z`, HAIR.fill, HAIR.stroke), es: 'Pelo de punta', en: 'Spiky hair' },
  hair_braids: {
    front: cap,
    back: [-1, 1].map((s) => [0, 1, 2, 3].map((i) => ellipse(s * (HR + 4), HY + 10 + i * 20, 11, 12, HAIR.fill, HAIR.stroke)).join('')).join(''),
    es: 'Trenzas',
    en: 'Braids',
  },
};

// ---------- clothes (colored) ----------

interface Top { id: string; color: string; accent: string; pattern: 'star' | 'stripe' | 'heart' | 'plain' | 'dino' | 'hoodie'; es: string; en: string }
const TOPS: Top[] = [
  { id: 'shirt_star_yellow', color: '#FFD23F', accent: '#FF8A3D', pattern: 'star', es: 'Camiseta estrella amarilla', en: 'Yellow star T-shirt' },
  { id: 'shirt_stripe_blue', color: '#4FB3F6', accent: '#FFFFFF', pattern: 'stripe', es: 'Camiseta de rayas azul', en: 'Blue striped T-shirt' },
  { id: 'shirt_heart_pink', color: '#FF9EC4', accent: '#E0245E', pattern: 'heart', es: 'Camiseta corazón rosa', en: 'Pink heart T-shirt' },
  { id: 'shirt_plain_green', color: '#7ED957', accent: '#4E9F2F', pattern: 'plain', es: 'Camiseta verde', en: 'Green T-shirt' },
  { id: 'shirt_dino_orange', color: '#FF9F43', accent: '#2E8B57', pattern: 'dino', es: 'Camiseta dinosaurio', en: 'Dino T-shirt' },
  { id: 'hoodie_purple', color: '#9B6DFF', accent: '#6A3FD6', pattern: 'hoodie', es: 'Sudadera morada', en: 'Purple hoodie' },
];
interface Bottom { id: string; color: string; kind: 'long' | 'shorts' | 'skirt' | 'leggings'; es: string; en: string }
const BOTTOMS: Bottom[] = [
  { id: 'jeans_blue', color: '#3D6FB6', kind: 'long', es: 'Vaqueros', en: 'Jeans' },
  { id: 'shorts_red', color: '#E94F4F', kind: 'shorts', es: 'Pantalón corto rojo', en: 'Red shorts' },
  { id: 'skirt_pink', color: '#FF7EB6', kind: 'skirt', es: 'Falda rosa', en: 'Pink skirt' },
  { id: 'pants_green', color: '#5BAE5B', kind: 'long', es: 'Pantalón verde', en: 'Green trousers' },
  { id: 'leggings_yellow', color: '#F7C948', kind: 'leggings', es: 'Mallas amarillas', en: 'Yellow leggings' },
];
interface Shoe { id: string; color: string; kind: 'sneaker' | 'boot' | 'sandal' | 'shoe'; es: string; en: string }
const SHOES: Shoe[] = [
  { id: 'sneakers_red', color: '#E53935', kind: 'sneaker', es: 'Zapatillas rojas', en: 'Red sneakers' },
  { id: 'boots_brown', color: '#8D5A3B', kind: 'boot', es: 'Botas marrones', en: 'Brown boots' },
  { id: 'sandals_blue', color: '#29B6F6', kind: 'sandal', es: 'Sandalias azules', en: 'Blue sandals' },
  { id: 'shoes_black', color: '#37303F', kind: 'shoe', es: 'Zapatos negros', en: 'Black shoes' },
];

function topTorso(b: Body, t: Top): string {
  const x = -b.torsoHalf - 4;
  const w = b.torsoHalf * 2 + 8;
  const top = b.torsoTop - 4;
  const h = b.torsoBottom - b.torsoTop + 16;
  const cy = top + h * 0.45;
  let deco = '';
  if (t.pattern === 'star') deco = pathEl(star(0, cy, 18, 8), t.accent, INK, 2);
  if (t.pattern === 'stripe') deco = [0.25, 0.5, 0.75].map((f) => rect(x + 3, top + h * f - 5, w - 6, 10, t.accent)).join('');
  if (t.pattern === 'heart') deco = pathEl(`M0 ${cy + 14} C-24 ${cy - 4} -12 ${cy - 22} 0 ${cy - 8} C12 ${cy - 22} 24 ${cy - 4} 0 ${cy + 14} Z`, t.accent, INK, 2);
  if (t.pattern === 'dino') deco = ellipse(-4, cy + 4, 20, 12, t.accent, INK, 2) + circle(16, cy - 8, 8, t.accent, INK, 2) + [-18, -6, 6].map((dx) => pathEl(`M${dx} ${cy - 6} l6 -10 l6 10 Z`, t.accent)).join('');
  if (t.pattern === 'hoodie') deco = rect(-24, cy + 6, 48, 20, t.accent, INK, 8, 2) + pathEl(`M-18 ${top + 6} Q0 ${top + 26} 18 ${top + 6}`, 'none', t.accent, 6);
  return rect(x, top, w, h, t.color, INK, 18, 3) + pathEl(`M-14 ${top + 1} Q0 ${top + 14} 14 ${top + 1}`, 'none', INK, 3) + deco;
}

function topSleeve(b: Body, t: Top, side: 1 | -1): string {
  const x1 = side === 1 ? b.armX1 - 3 : -b.armX2 - 3;
  const w = b.armX2 - b.armX1 + 6;
  const top = b.torsoTop - 2;
  const long = t.pattern === 'hoodie';
  const h = long ? b.handY - top - 8 : (b.handY - top) * 0.45;
  return rect(x1, top, w, h, t.color, INK, 9, 3);
}

function bottomLayer(b: Body, bt: Bottom): string {
  const lx = -b.legGap / 2 - b.legW - 4;
  const w = b.legW * 2 + b.legGap + 8;
  const top = b.legTop - 8;
  if (bt.kind === 'skirt') return pathEl(`M${lx + 4} ${top} L${-lx - 4} ${top} L${-lx + 18} ${top + 70} L${lx - 18} ${top + 70} Z`, bt.color, INK, 3);
  const legLen = bt.kind === 'shorts' ? 50 : -b.legTop - 22;
  const legW = bt.kind === 'leggings' ? b.legW + 4 : b.legW + 8;
  const left = rect(-b.legGap / 2 - legW - (bt.kind === 'leggings' ? 0 : 0), top + 10, legW, legLen, bt.color, INK, 8, 3);
  const right = rect(b.legGap / 2, top + 10, legW, legLen, bt.color, INK, 8, 3);
  return left + right + rect(lx, top, w, 22, bt.color, INK, 8, 3);
}

function shoeLayer(b: Body, s: Shoe): string {
  const feet = [-b.legGap / 2 - b.legW / 2 - 4, b.legGap / 2 + b.legW / 2 + 4];
  return feet
    .map((fx) => {
      if (s.kind === 'boot') return rect(fx - b.legW / 2 - 6, -46, b.legW + 12, 30, s.color, INK, 6, 3) + ellipse(fx, -10, b.legW / 2 + 10, 10, s.color, INK, 3);
      if (s.kind === 'sandal') return ellipse(fx, -6, b.legW / 2 + 9, 6, s.color, INK, 3) + rect(fx - b.legW / 2, -18, b.legW, 6, s.color, INK, 3, 2);
      const lace = s.kind === 'sneaker' ? rect(fx - 6, -20, 12, 4, '#FFFFFF') : '';
      return ellipse(fx, -10, b.legW / 2 + 10, 11, s.color, INK, 3) + lace;
    })
    .join('');
}

// ---------- loose sprites (clothes on the floor) and creator icons ----------

const LOOSE_H = 100;
const LOOSE_W = 120;
const looseTop = (t: Top) =>
  svg(LOOSE_H, pathEl(`M-50 -80 L-20 -92 Q0 -80 20 -92 L50 -80 L58 -50 L40 -46 L38 -6 L-38 -6 L-40 -46 L-58 -50 Z`, t.color, INK, 3) + (t.pattern === 'star' ? pathEl(star(0, -50, 14, 6), t.accent) : t.pattern === 'stripe' ? rect(-36, -58, 72, 8, t.accent) + rect(-36, -34, 72, 8, t.accent) : t.pattern === 'heart' ? pathEl('M0 -34 C-18 -48 -8 -62 0 -52 C8 -62 18 -48 0 -34 Z', t.accent) : t.pattern === 'dino' ? ellipse(0, -44, 16, 10, t.accent) : t.pattern === 'hoodie' ? rect(-18, -34, 36, 16, t.accent, INK, 6, 2) : ''), LOOSE_W);
const looseBottom = (b: Bottom) =>
  svg(LOOSE_H, b.kind === 'skirt' ? pathEl('M-28 -84 L28 -84 L46 -8 L-46 -8 Z', b.color, INK, 3) : rect(-34, -88, 68, 18, b.color, INK, 6, 3) + rect(-34, -74, 30, b.kind === 'shorts' ? 34 : 66, b.color, INK, 6, 3) + rect(4, -74, 30, b.kind === 'shorts' ? 34 : 66, b.color, INK, 6, 3), LOOSE_W);
const looseShoes = (s: Shoe) => svg(LOOSE_H, [-26, 26].map((x) => (s.kind === 'boot' ? rect(x - 16, -58, 30, 40, s.color, INK, 6, 3) : '') + ellipse(x, -20, 24, 14, s.color, INK, 3)).join(''), LOOSE_W);

const ICON = 128;
const headView = (b: Body) => `${-90} ${b.headY - 90} 180 180`;

// ---------- output ----------

interface ImageEntry { file: string; w: number; h: number; placeholder: true; license: string; source: string }
const images: Record<string, ImageEntry> = {};

async function write(key: string, svgText: string): Promise<void> {
  const file = `assets/images/${key}.webp`;
  const buf = await sharp(Buffer.from(svgText)).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
  fs.writeFileSync(path.join(PACK, file), buf);
  const meta = await sharp(buf).metadata();
  images[key] = { file, w: meta.width!, h: meta.height!, placeholder: true, license: 'own', source: SOURCE };
}

const SKIN_TONES = ['#FCE3D0', '#F5CBA7', '#E8B48A', '#C68642', '#A5673F', '#8D5524', '#6B3E26', '#4A2A1A'];
const HAIR_COLORS: [string, string, string, string][] = [
  ['hair_black', '#2B2B2B', 'Negro', 'Black'],
  ['hair_brown', '#6B4226', 'Castaño', 'Brown'],
  ['hair_blonde', '#E8C872', 'Rubio', 'Blonde'],
  ['hair_red', '#C1440E', 'Pelirrojo', 'Red'],
  ['hair_berry', '#B0306A', 'Frambuesa', 'Berry'],
  ['hair_blue', '#3F7FD9', 'Azul', 'Blue'],
  ['hair_white', '#F2F2F2', 'Blanco', 'White'],
  ['hair_green', '#4CAF50', 'Verde', 'Green'],
];
const SKIN_NAMES: [string, string][] = [
  ['Piel muy clara', 'Very light skin'],
  ['Piel clara', 'Light skin'],
  ['Piel clara cálida', 'Warm light skin'],
  ['Piel media', 'Medium skin'],
  ['Piel media oscura', 'Medium dark skin'],
  ['Piel morena', 'Tan skin'],
  ['Piel oscura', 'Dark skin'],
  ['Piel muy oscura', 'Very dark skin'],
];

async function main() {
  fs.mkdirSync(IMAGES, { recursive: true });
  const i18n: { es: Record<string, string>; en: Record<string, string> } = { es: {}, en: {} };
  const name = (k: string, es: string, en: string) => {
    i18n.es[k] = es;
    i18n.en[k] = en;
    return k;
  };

  for (const b of BODIES) {
    await write(`chr_body_${b.id}_idle_legs`, svg(b.canvasH, legs(b)));
    await write(`chr_body_${b.id}_idle_torso`, svg(b.canvasH, torso(b)));
    await write(`chr_body_${b.id}_idle_arml`, svg(b.canvasH, arm(b, 1)));
    await write(`chr_body_${b.id}_idle_armr`, svg(b.canvasH, arm(b, -1)));
    await write(`chr_body_${b.id}_idle_head`, svg(b.canvasH, head(b)));
    const whole = legs(b) + torso(b) + arm(b, 1) + arm(b, -1) + head(b);
    await write(`ui_creator_body_${b.id}`, svg(ICON, whole, ICON, `${-150} ${-b.canvasH - 10} 300 ${b.canvasH + 20}`));
  }
  const childHead = head(CHILD);
  for (const [id, e] of Object.entries(EYES)) {
    await write(`chr_${id}`, svg(CHILD.canvasH, e.open));
    await write(`chr_${id}_closed`, svg(CHILD.canvasH, CLOSED_EYES));
    await write(`ui_creator_${id}`, svg(ICON, childHead + e.open, ICON, headView(CHILD)));
  }
  for (const [id, m] of Object.entries(MOUTHS)) {
    await write(`chr_${id}`, svg(CHILD.canvasH, m.svg));
    await write(`ui_creator_${id}`, svg(ICON, childHead + m.svg, ICON, headView(CHILD)));
  }
  for (const [expr, m] of Object.entries(EXPRESSION_MOUTHS)) await write(`chr_mouth_expr_${expr}`, svg(CHILD.canvasH, m));
  for (const [id, h] of Object.entries(HAIRS)) {
    await write(`chr_${id}_front`, svg(CHILD.canvasH, h.front));
    if (h.back) await write(`chr_${id}_back`, svg(CHILD.canvasH, h.back));
    await write(`ui_creator_${id}`, svg(ICON, (h.back ?? '') + childHead + h.front, ICON, headView(CHILD)));
  }

  const prefabs: { id: string; data: unknown }[] = [];
  const wearablePrefab = (id: string, slot: string, layersFor: (b: Body) => Record<string, string>) => {
    const child = layersFor(CHILD);
    const adult = layersFor(BODIES[1]);
    prefabs.push({
      id,
      data: {
        id,
        category: 'clothing',
        tags: ['clothing', slot],
        components: {
          sprite: { asset: `obj_clothing_${id}`, layer: 'props' },
          hitbox: { shape: { type: 'rect', x: -56, y: -96, w: 112, h: 92 } },
          draggable: {},
          wearable: { slot, layers: child, bodyVariants: { adult } },
          animations: { drop: 'squash' },
        },
        metadata: { name: `object.${id}.name`, placeholder: true },
      },
    });
  };

  for (const t of TOPS) {
    for (const b of BODIES) {
      const sfx = b.id === 'child' ? '' : '_adult';
      await write(`chr_top_${t.id}${sfx}`, svg(b.canvasH, topTorso(b, t)));
      await write(`chr_top_${t.id}_arm_l${sfx}`, svg(b.canvasH, topSleeve(b, t, 1)));
      await write(`chr_top_${t.id}_arm_r${sfx}`, svg(b.canvasH, topSleeve(b, t, -1)));
    }
    await write(`obj_clothing_${t.id}`, looseTop(t));
    name(`object.${t.id}.name`, t.es, t.en);
    wearablePrefab(t.id, 'top', (b) => {
      const sfx = b.id === 'child' ? '' : '_adult';
      return { torsoClothes: `chr_top_${t.id}${sfx}`, armClothesL: `chr_top_${t.id}_arm_l${sfx}`, armClothesR: `chr_top_${t.id}_arm_r${sfx}` };
    });
  }
  for (const bt of BOTTOMS) {
    for (const b of BODIES) await write(`chr_bottom_${bt.id}${b.id === 'child' ? '' : '_adult'}`, svg(b.canvasH, bottomLayer(b, bt)));
    await write(`obj_clothing_${bt.id}`, looseBottom(bt));
    name(`object.${bt.id}.name`, bt.es, bt.en);
    wearablePrefab(bt.id, 'bottom', (b) => ({ bottomClothes: `chr_bottom_${bt.id}${b.id === 'child' ? '' : '_adult'}` }));
  }
  for (const s of SHOES) {
    for (const b of BODIES) await write(`chr_shoes_${s.id}${b.id === 'child' ? '' : '_adult'}`, svg(b.canvasH, shoeLayer(b, s)));
    await write(`obj_clothing_${s.id}`, looseShoes(s));
    name(`object.${s.id}.name`, s.es, s.en);
    wearablePrefab(s.id, 'shoes', (b) => ({ shoes: `chr_shoes_${s.id}${b.id === 'child' ? '' : '_adult'}` }));
  }

  const handAnchors = (b: Body) => ({
    idle: { left: { x: (b.armX1 + b.armX2) / 2, y: b.handY }, right: { x: -(b.armX1 + b.armX2) / 2, y: b.handY } },
  });
  const parts = {
    bodyTypes: BODIES.map((b) => ({
      id: b.id,
      name: name(`body.${b.id}.name`, b.id === 'child' ? 'Niño o niña' : 'Persona adulta', b.id === 'child' ? 'Child' : 'Adult'),
      icon: `ui_creator_body_${b.id}`,
      height: b.height,
      layers: { idle: { legs: `chr_body_${b.id}_idle_legs`, torso: `chr_body_${b.id}_idle_torso`, armL: `chr_body_${b.id}_idle_arml`, armR: `chr_body_${b.id}_idle_armr`, head: `chr_body_${b.id}_idle_head` } },
      handAnchors: handAnchors(b),
      mouthAnchor: { idle: { x: 0, y: b.headY + 24 } },
      ...(faceOffset(b) ? { faceOffset: { x: 0, y: faceOffset(b) } } : {}),
    })),
    skinTones: SKIN_TONES.map((color, i) => {
      const id = `skin_0${i + 1}`;
      return { id, color, name: name(`skin.${id}.name`, SKIN_NAMES[i][0], SKIN_NAMES[i][1]) };
    }),
    eyes: Object.entries(EYES).map(([id, e]) => ({ id, icon: `ui_creator_${id}`, asset: `chr_${id}`, closedAsset: `chr_${id}_closed`, name: name(`part.${id}.name`, e.es, e.en) })),
    mouths: Object.entries(MOUTHS).map(([id, m]) => ({
      id,
      icon: `ui_creator_${id}`,
      asset: `chr_${id}`,
      byExpression: { happy: 'chr_mouth_expr_happy', surprised: 'chr_mouth_expr_surprised', yum: 'chr_mouth_expr_yum' },
      name: name(`part.${id}.name`, m.es, m.en),
    })),
    hairStyles: Object.entries(HAIRS).map(([id, h]) => ({
      id,
      icon: `ui_creator_${id}`,
      front: `chr_${id}_front`,
      ...(h.back ? { back: `chr_${id}_back` } : {}),
      name: name(`part.${id}.name`, h.es, h.en),
    })),
    hairColors: HAIR_COLORS.map(([id, color, es, en]) => ({ id, color, name: name(`haircolor.${id}.name`, es, en) })),
    starterClothes: [...TOPS, ...BOTTOMS, ...SHOES].map((c) => c.id),
    colorTags: ['#FFB5C2', '#9ED8FF', '#B8F2A0', '#FFE08A', '#D7B8FF', '#FFC89E', '#A0F0E0', '#F7A8A8', '#C8E6FF', '#E6F59A', '#FFD1F0', '#CFCFCF'],
    defaults: {
      bodyType: 'child',
      skinTone: 'skin_01',
      eyes: 'eyes_round',
      mouth: 'mouth_smile',
      hairStyle: 'hair_buns',
      hairColor: 'hair_brown',
      outfit: { top: 'shirt_star_yellow', bottom: 'jeans_blue', shoes: 'sneakers_red' },
    },
  };

  // assets.json: keep existing entries, replace generated ones
  const assetsFile = path.join(PACK, 'assets.json');
  const assets = JSON.parse(fs.readFileSync(assetsFile, 'utf8'));
  for (const key of Object.keys(assets.images)) if (assets.images[key].source === SOURCE) delete assets.images[key];
  Object.assign(assets.images, images);
  assets.images = Object.fromEntries(Object.entries(assets.images).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(assetsFile, JSON.stringify(assets, null, 2) + '\n');

  fs.mkdirSync(path.join(PACK, 'characters'), { recursive: true });
  fs.writeFileSync(path.join(PACK, 'characters', 'parts.json'), JSON.stringify(parts, null, 2) + '\n');
  fs.mkdirSync(path.join(PACK, 'prefabs', 'clothing'), { recursive: true });
  for (const p of prefabs) fs.writeFileSync(path.join(PACK, 'prefabs', 'clothing', `${p.id}.json`), JSON.stringify(p.data, null, 2) + '\n');

  for (const loc of ['es', 'en'] as const) {
    const file = path.join(PACK, 'locales', `${loc}.json`);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    Object.assign(data, i18n[loc]);
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
  console.log(`Wrote ${Object.keys(images).length} images, ${prefabs.length} clothing prefabs and characters/parts.json`);
}

void main();
