import type { Components } from '../components/registry';
import type { Entity } from '../core/entity';
import type { SavedEntity } from './save-store';

/**
 * Only player state is persisted, never content definitions (SAVE_SCHEMA §2), so art or hitbox updates of
 * a prefab reach existing saves. Components added by later HUs extend this table with their persisted fields.
 */
const PERSISTED: { [K in keyof Components]?: (value: NonNullable<Components[K]>) => unknown } = {
  transform: (t) => t,
  states: (s) => ({ current: s.current }),
};

export function persistedComponents(e: Entity): Components {
  const out: Record<string, unknown> = {};
  for (const [name, pick] of Object.entries(PERSISTED)) {
    const value = (e.components as Record<string, unknown>)[name];
    if (value !== undefined && pick) out[name] = (pick as (v: unknown) => unknown)(value);
  }
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
