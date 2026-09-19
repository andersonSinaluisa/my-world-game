import { persistedPose } from '../characters/character-system';
import type { Components } from '../components/registry';
import type { Entity } from '../core/entity';
import type { SavedEntity } from './save-store';

/**
 * Only player state is persisted, never content definitions (SAVE_SCHEMA §2), so art or hitbox updates of
 * a prefab reach existing saves. Components added by later HUs extend this table with their persisted fields.
 * Character components are player data (CHARACTER_SCHEMA §2); `expression`, and the sprite/hitbox derived
 * from the catalog, are never saved. Temporary poses are saved as their returnTo pose (HU-GAME-014 R2).
 */
const PERSISTED: { [K in keyof Components]?: (value: NonNullable<Components[K]>) => unknown } = {
  transform: (t) => t,
  states: (s) => ({ current: s.current }),
  character: (c) => c,
  appearance: (a) => a,
  holder: (h) => h,
  pose: (p) => persistedPose(p),
  edible: (e) => (e.bitesLeft === undefined ? undefined : { bitesLeft: e.bitesLeft }),
  drinkable: (d) => (d.sipsLeft === undefined ? undefined : { sipsLeft: d.sipsLeft }),
  spawnedFrom: (s) => s,
  purchasable: (p) => (p.purchased === undefined ? undefined : { purchased: p.purchased }),
};

/** Components persisted in full only for entities without a prefab (they have no content to rebuild from). */
const PREFABLESS: (keyof Components)[] = ['draggable'];

/** Components whose changes never need a save (derived or presentation-only). */
export const NON_PERSISTED_COMPONENTS: ReadonlySet<string> = new Set(['expression', 'sprite', 'hitbox']);

export function persistedComponents(e: Entity): Components {
  const out: Record<string, unknown> = {};
  const comps = e.components as Record<string, unknown>;
  for (const [name, pick] of Object.entries(PERSISTED)) {
    const value = comps[name];
    const picked = value !== undefined && pick ? (pick as (v: unknown) => unknown)(value) : undefined;
    if (picked !== undefined) out[name] = picked;
  }
  if (!e.prefabId) for (const name of PREFABLESS) if (comps[name] !== undefined) out[name] = comps[name];
  // Runtime copies (restock) have no scene declaration: they keep price and origin too (HU-GAME-066 RN-8).
  if (isRuntimeId(e.id) && comps.purchasable !== undefined) out.purchasable = comps.purchasable;
  return out as Components;
}

export const isRuntimeId = (id: string) => id.startsWith('rt_');

/** SavedEntity for an entity (SAVE_SCHEMA §1). Tags are stored only for runtime entities without a prefab. */
export function toSavedEntity(e: Entity): SavedEntity {
  const saved: SavedEntity = { id: e.id, location: e.location, components: persistedComponents(e) };
  if (e.prefabId) saved.prefabId = e.prefabId;
  if (!e.prefabId && isRuntimeId(e.id)) saved.tags = [...e.tags];
  return saved;
}

export const isCharacterRow = (row: SavedEntity) => !!row.tags?.includes('character') || !!(row.components as Components).character;
