import type { Appearance, CharacterLayer, ExpressionId, PoseId, Sprite, Wearable } from '../components/base';
import { CHARACTER_LAYERS } from '../components/base';
import type { Entity } from '../core/entity';
import type { Hand, WearSlot } from '../core/location';
import type { Logger } from '../core/runtime';
import type { AssetKey, EntityId } from '../core/types';
import type { World } from '../core/world';
import { BODY_LAYERS, handAnchor, SKIN_LAYERS, type CharacterPartsCatalog } from './catalog';

/** Scale of a held item inside the character group (CHARACTER_SYSTEM §6). */
export const HELD_SCALE = 0.8;

/** One drawable layer of a character, in world units relative to the character pivot. */
export interface CharacterLayerData {
  layer: CharacterLayer;
  /** Absent for the engine-drawn shadow. */
  asset?: AssetKey;
  /** Multiply tint (#RRGGBB) for skin and hair layers (CHARACTER_SYSTEM §4). */
  tint?: string;
  /** Face parts of other body types are moved by `faceOffset` (catalog extension). */
  offset?: { x: number; y: number };
  /** Ellipse under the feet (CHARACTER_SCHEMA §3, layer 0). */
  shadow?: { rx: number; ry: number };
  /** heldL / heldR: the held entity's own sprite at the hand anchor, scaled by HELD_SCALE. */
  held?: {
    entityId: EntityId;
    anchor: { x: number; y: number };
    scale: number;
    pivot: { x: number; y: number };
    size?: { w: number; h: number };
  };
}

export interface CharacterLookInput {
  appearance: Appearance;
  pose: PoseId;
  expression: ExpressionId;
  worn: Partial<Record<WearSlot, Wearable>>;
  held: Partial<Record<Hand, { id: EntityId; sprite: Sprite; asset: AssetKey }>>;
}

export interface LayerEnv {
  catalog: CharacterPartsCatalog;
  hasAsset: (key: AssetKey) => boolean;
  /** Missing assets are skipped and reported once per key (HU-GAME-013 R10). */
  onMissing?: (key: AssetKey, layer: CharacterLayer) => void;
}

/**
 * Pure layer resolution (CHARACTER_SYSTEM §3, HU-GAME-013 R3). Unknown catalog ids fall back to the first
 * option of each list, so a stale save never breaks drawing. The order is the fixed CHARACTER_LAYERS order.
 */
export function computeCharacterLayers(input: CharacterLookInput, env: LayerEnv): CharacterLayerData[] {
  const { catalog: c, hasAsset } = env;
  const a = input.appearance;
  const byId = <T extends { id: string }>(list: T[], id: string) => list.find((x) => x.id === id) ?? list[0];
  const body = byId(c.bodyTypes, a.bodyType);
  const skin = byId(c.skinTones, a.skinTone).color;
  const hairColor = byId(c.hairColors, a.hairColor).color;
  const eyes = byId(c.eyes, a.eyes);
  const mouth = byId(c.mouths, a.mouth);
  const hair = byId(c.hairStyles, a.hairStyle);
  const hairVariant = hair.byBodyType?.[body.id];
  const faceOffset = body.faceOffset && (body.faceOffset.x !== 0 || body.faceOffset.y !== 0) ? body.faceOffset : undefined;
  const pose = input.pose;

  const assets: Partial<Record<CharacterLayer, { asset: AssetKey; tint?: string; offset?: { x: number; y: number } }>> = {};
  // 1. body: layers[pose][layer] ?? layers.idle[layer]
  for (const layer of BODY_LAYERS) {
    const asset = body.layers[pose]?.[layer] ?? body.layers.idle?.[layer];
    if (asset) assets[layer] = { asset, tint: SKIN_LAYERS.includes(layer) ? skin : undefined };
  }
  // 2. clothes: bodyVariants[bodyType][layer] ?? layers[layer]; pose variant "{asset}_{pose}" if it exists
  for (const w of Object.values(input.worn)) {
    if (!w) continue;
    const layers = w.bodyVariants?.[body.id] ?? w.layers;
    for (const [layer, asset] of Object.entries(layers) as [CharacterLayer, AssetKey][]) {
      const posed = pose !== 'idle' ? `${asset}_${pose}` : undefined;
      assets[layer] = { asset: posed && hasAsset(posed) ? posed : asset };
    }
  }
  // 3. hair: byBodyType[bodyType] ?? the style (drawn on the first body's canvas, moved by faceOffset)
  const hairOffset = hairVariant ? undefined : faceOffset;
  const back = hairVariant ? hairVariant.back : hair.back;
  if (back) assets.hairBack = { asset: back, tint: hairColor, offset: hairOffset };
  assets.hairFront = { asset: hairVariant?.front ?? hair.front, tint: hairColor, offset: hairOffset };
  // 4. eyes: closed when sleepy or asleep; 5. mouth by expression
  const closed = input.expression === 'sleepy' || pose === 'sleep';
  assets.eyes = { asset: (closed && eyes.closedAsset) || eyes.asset, offset: faceOffset };
  assets.mouth = { asset: mouth.byExpression?.[input.expression] ?? mouth.asset, offset: faceOffset };

  const out: CharacterLayerData[] = [];
  for (const layer of CHARACTER_LAYERS) {
    if (layer === 'shadow') {
      out.push({ layer, shadow: { rx: body.height * 0.2, ry: body.height * 0.04 } });
      continue;
    }
    if (layer === 'heldL' || layer === 'heldR') {
      const hand: Hand = layer === 'heldL' ? 'left' : 'right';
      const item = input.held[hand];
      if (!item) continue;
      if (!hasAsset(item.asset)) {
        env.onMissing?.(item.asset, layer);
        continue;
      }
      out.push({
        layer,
        asset: item.asset,
        held: {
          entityId: item.id,
          anchor: handAnchor(body, pose, hand),
          scale: HELD_SCALE,
          pivot: item.sprite.pivot ?? { x: 0.5, y: 1 },
          size: item.sprite.size,
        },
      });
      continue;
    }
    const entry = assets[layer];
    if (!entry) continue;
    if (!hasAsset(entry.asset)) {
      env.onMissing?.(entry.asset, layer);
      continue;
    }
    const data: CharacterLayerData = { layer, asset: entry.asset };
    if (entry.tint) data.tint = entry.tint;
    if (entry.offset) data.offset = entry.offset;
    out.push(data);
  }
  return out;
}

/** Sprite asset of an entity for its current state (same rule as the scene renderer). */
function spriteAsset(e: Entity): AssetKey | undefined {
  const sprite = e.components.sprite;
  if (!sprite) return undefined;
  const state = e.components.states?.current;
  return (state && sprite.byState?.[state]) || sprite.asset;
}

/** Inputs of a character read from the World: the character, its worn clothes and held items. */
function lookOf(world: World, id: EntityId): { input: CharacterLookInput; deps: Entity[] } | undefined {
  const e = world.get(id);
  const appearance = e?.components.appearance;
  if (!e || !appearance) return undefined;
  const deps: Entity[] = [e];
  const worn: CharacterLookInput['worn'] = {};
  for (const [slot, itemId] of Object.entries(world.index.wornBy(id)) as [WearSlot, EntityId][]) {
    const item = world.get(itemId);
    if (!item) continue;
    deps.push(item);
    if (item.components.wearable) worn[slot] = item.components.wearable;
  }
  const held: CharacterLookInput['held'] = {};
  for (const hand of ['left', 'right'] as Hand[]) {
    const itemId = world.index.occupantOf({ kind: 'held', holderId: id, hand });
    const item = itemId ? world.get(itemId) : undefined;
    const asset = item && spriteAsset(item);
    if (!item || !asset) continue;
    deps.push(item);
    held[hand] = { id: item.id, sprite: item.components.sprite!, asset };
  }
  return {
    input: {
      appearance,
      pose: e.components.pose?.current ?? 'idle',
      expression: e.components.expression?.current ?? 'neutral',
      worn,
      held,
    },
    deps,
  };
}

/**
 * Memoized `selectCharacterLayers(world, id)` (HU-GAME-013 R7). Entities are immutable with structural
 * sharing, so the result is reused while the character, its clothes and its held items keep their
 * object identity; changes elsewhere in the World return the same array.
 */
export class CharacterLayerSelector {
  private cache = new Map<EntityId, { deps: Entity[]; catalog: CharacterPartsCatalog; result: CharacterLayerData[] }>();
  private warned = new Set<string>();

  constructor(
    private readonly world: World,
    private readonly env: () => LayerEnv | undefined,
    private readonly logger?: Logger,
  ) {}

  select(id: EntityId): CharacterLayerData[] {
    const env = this.env();
    const look = env && lookOf(this.world, id);
    if (!env || !look) {
      this.cache.delete(id);
      return EMPTY;
    }
    const hit = this.cache.get(id);
    if (hit && hit.catalog === env.catalog && sameRefs(hit.deps, look.deps)) return hit.result;
    const result = computeCharacterLayers(look.input, { ...env, onMissing: (key, layer) => this.missing(id, key, layer) });
    this.cache.set(id, { deps: look.deps, catalog: env.catalog, result });
    return result;
  }

  forget(id: EntityId): void {
    this.cache.delete(id);
  }

  private missing(id: EntityId, key: AssetKey, layer: CharacterLayer): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.logger?.warn(`Character ${id}: missing asset "${key}" for layer ${layer}; layer skipped`);
  }
}

const EMPTY: CharacterLayerData[] = [];

function sameRefs(a: Entity[], b: Entity[]): boolean {
  return a.length === b.length && a.every((e, i) => e === b[i]);
}
