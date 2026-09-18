import type { ContentRegistry } from '../content/registry';
import type { SceneDefinition } from '../content/schemas';
import { mergeComponents, qualify } from '../content/validate-pack';
import type { EntityInit } from '../core/entity';
import type { Location } from '../core/location';
import type { Logger } from '../core/runtime';
import type { EntityId, SceneId } from '../core/types';
import type { SavedEntity } from '../persistence/save-store';
import type { ActiveSceneInfo } from './scene-types';

/** Saved diff for one scene (SAVE_SCHEMA §4): rows of that scene (and its containers) + removed ids. */
export interface SavedSceneState {
  entities: SavedEntity[];
  removed: ReadonlySet<EntityId>;
}

export interface BuildOptions {
  dev: boolean;
  logger: Logger;
  saved?: SavedSceneState;
}

export interface BuiltScene {
  info: ActiveSceneInfo;
  /** Scene-located entities first, then container contents (two passes, HU-GAME-011 R6). */
  entities: EntityInit[];
}

export const sceneEntityId = (sceneId: SceneId, localId: string): EntityId => `${sceneId}/${localId}`;

export function toSceneInfo(id: SceneId, def: SceneDefinition): ActiveSceneInfo {
  return {
    id,
    size: { width: def.size.width, height: 1080 },
    bounds: def.bounds,
    background: def.background,
    floor: def.floor,
    spawnPoints: def.spawnPoints,
    zones: def.zones,
    camera: def.camera,
    audio: def.audio,
  };
}

/** A saved states.current that is no longer in values falls back to the content value (HU-GAME-025 R7). */
function sanitizeStates(id: EntityId, merged: Record<string, unknown>, content: Record<string, unknown>, logger: Logger) {
  const states = merged.states as { current?: string; values?: string[] } | undefined;
  if (states?.current && states.values && !states.values.includes(states.current)) {
    const fallback = (content.states as { current?: string } | undefined)?.current ?? states.values[0];
    logger.warn(`Saved state "${states.current}" of ${id} no longer exists; using "${fallback}"`);
    merged.states = { ...states, current: fallback };
  }
}

/**
 * Instantiates a scene definition: prefab ⊕ overrides ⊕ saved components (ENTITY_SCHEMA §3), inline
 * entities, `inContainer` contents, runtime entities from the save, minus removed ids. Generic: there is
 * no logic per scene or per prefab (SCENE_SYSTEM §5).
 */
export function buildScene(registry: ContentRegistry, sceneId: SceneId, options: BuildOptions): BuiltScene | undefined {
  const def = registry.scene(sceneId);
  if (!def) return undefined;
  const packId = def.pack;
  const saved = new Map((options.saved?.entities ?? []).map((e) => [e.id, e]));
  const removed = options.saved?.removed ?? new Set<EntityId>();
  const sceneLocated: EntityInit[] = [];
  const contained: EntityInit[] = [];
  const skip = (message: string) => {
    if (options.dev) throw new Error(message);
    options.logger.warn(message);
  };

  for (const e of def.entities) {
    const id = sceneEntityId(sceneId, e.localId);
    if (removed.has(id)) continue;
    const savedRow = saved.get(id);
    saved.delete(id);
    let content: Record<string, unknown>;
    let tags: string[] = [];
    let prefabId: string | undefined;
    if ('inline' in e) {
      content = mergeComponents(e.inline.components, { transform: e.transform });
      tags = e.inline.tags ?? [];
    } else {
      const prefab = registry.hasPrefab(e.prefabId, packId) ? registry.prefab(e.prefabId, packId) : undefined;
      if (!prefab) {
        skip(`Unknown prefab "${qualify(e.prefabId, packId)}" in ${sceneId}/${e.localId}`);
        continue;
      }
      prefabId = prefab.qualifiedId;
      content = mergeComponents(prefab.components, e.overrides, 'transform' in e ? { transform: e.transform } : undefined);
      tags = [...new Set([...(prefab.tags ?? []), ...(e.tags ?? [])])];
    }
    const components = mergeComponents(content, savedRow?.components as Record<string, unknown> | undefined);
    sanitizeStates(id, components, content, options.logger);
    const location: Location =
      savedRow?.location ??
      ('inContainer' in e
        ? { kind: 'container', containerId: sceneEntityId(sceneId, e.inContainer.localId), slot: e.inContainer.slot }
        : { kind: 'scene', sceneId });
    const init: EntityInit = { id, prefabId, tags, location, components };
    // Saved rows may move a scene entity elsewhere (e.g. into the backpack): those are global and loaded apart.
    if (location.kind === 'scene' && location.sceneId === sceneId) sceneLocated.push(init);
    else if (location.kind === 'container') contained.push(init);
  }

  // Runtime entities (rt_…) of this scene and saved rows for containers of this scene.
  for (const row of saved.values()) {
    // Characters are global entities, loaded once for every scene (GAME_ENGINE §3).
    if (row.tags?.includes('character') || (row.components as { character?: unknown }).character) continue;
    const inScene = row.location.kind === 'scene' && row.location.sceneId === sceneId;
    if (!inScene && row.location.kind !== 'container') continue;
    const prefab = row.prefabId && registry.hasPrefab(row.prefabId) ? registry.prefab(row.prefabId) : undefined;
    if (row.prefabId && !prefab) {
      options.logger.warn(`Discarding saved ${row.id}: prefab "${row.prefabId}" no longer exists`);
      continue;
    }
    const content = prefab?.components ?? {};
    const components = mergeComponents(content, row.components as Record<string, unknown>);
    sanitizeStates(row.id, components, content, options.logger);
    const init: EntityInit = {
      id: row.id,
      prefabId: prefab?.qualifiedId,
      tags: row.tags ?? prefab?.tags ?? [],
      location: row.location,
      components,
    };
    (inScene ? sceneLocated : contained).push(init);
  }

  // Keep only contents whose container is part of this scene (declared or runtime).
  const present = new Set(sceneLocated.map((e) => e.id));
  let grew = true;
  const accepted: EntityInit[] = [];
  const pending = [...contained];
  while (grew) {
    grew = false;
    for (let i = pending.length - 1; i >= 0; i--) {
      const c = pending[i];
      if (c.location.kind === 'container' && present.has(c.location.containerId)) {
        accepted.push(c);
        present.add(c.id);
        pending.splice(i, 1);
        grew = true;
      }
    }
  }
  return { info: toSceneInfo(sceneId, def), entities: [...sceneLocated, ...accepted.reverse()] };
}
