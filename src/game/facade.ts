import type { RenderLayer, Transform, TweenPresetId } from '@/engine/components/base';
import type { CommandResult, GameCommand } from '@/engine/core/commands';
import type { GameEngine } from '@/engine/core/engine';
import type { Entity, EntityInit } from '@/engine/core/entity';
import { entityIdOf, PRESENTATION_EVENTS, type EventBus, type GameEvent } from '@/engine/core/events';
import type { AssetKey, EntityId, WorldPoint } from '@/engine/core/types';
import type { CharacterPartsCatalog } from '@/engine/characters/catalog';
import type { CharacterDraft, CharacterSummary, ClothingOption } from '@/engine/characters/character-commands';
import type { CharacterLayerData } from '@/engine/characters/layers';
import type { LocaleId } from '@/engine/content/schemas';
import { cullEntities, cullingRange, type AssetSizeLookup } from '@/engine/scene/culling';
import { isRenderable, sortForRender } from '@/engine/scene/render-order';
import { spriteAssetOf } from '@/engine/scene/sprite-asset';
import type { ActiveSceneInfo } from '@/engine/scene/scene-types';

export { MAX_CHARACTERS } from '@/engine/characters/character-system';
export { CURRENT_SAVE_VERSION } from '@/engine/persistence/migrations';

/** Data ready for the renderer (GAME_ENGINE §6). */
export interface EntityRenderData {
  id: EntityId;
  asset: AssetKey;
  layer: RenderLayer;
  /** Position in the global render order (0 = back). */
  order: number;
  transform: Transform;
  pivot: { x: number; y: number };
  size?: { w: number; h: number };
  /** A bed blanket drawn right after the character sleeping in it (HU-GAME-046 R3); not an entity. */
  cover?: boolean;
}

/** A card of the map (HU-GAME-051). */
export interface MapLocation {
  id: string;
  label: string;
  icon: string;
  sceneId: string;
  spawnId: string;
  current: boolean;
  locked: boolean;
}

const EMPTY_LOCATIONS: MapLocation[] = [];
/** Palette color of the fades when the scene declares none (HU-GAME-050 RN-2). */
export const DEFAULT_TRANSITION_COLOR = '#FFE7C2';

/** A backpack slot for the tray (HU-GAME-038 R1). */
export interface InventorySlotView {
  slot: number;
  entityId?: EntityId;
  asset?: AssetKey;
  name?: string;
}

export interface ViewportQuery {
  cameraX: number;
  viewportW: number;
}

export interface GameSnapshot {
  readonly version: number;
}

export interface GameFacade {
  dispatch(command: GameCommand): CommandResult;
  subscribe(listener: () => void): () => void;
  subscribeEntity(id: EntityId, listener: () => void): () => void;
  getSnapshot(): GameSnapshot;
  getEntity(id: EntityId): Entity | undefined;
  /** World transform (items carried by furniture are stored relative to it, HU-GAME-030). */
  absoluteTransform(id: EntityId): Transform | undefined;
  /** Entities carried by a piece of furniture (drawn with its drag proxy, HU-GAME-030 R4). */
  carriedBy(id: EntityId): Entity[];
  /** First hit test of a gesture (HU-GAME-026 R5b): draggable entity under the point, if any. */
  pickDraggable(point: WorldPoint, minHitWorld?: number): EntityId | undefined;
  /** Translated content text (HU-GAME-068 R10). Falls back to the other locale, then to the key. */
  t(key: string, locale?: LocaleId): string;
  selectors: {
    activeScene(): ActiveSceneInfo | undefined;
    /** Last settled camera position (player.cameraX), set by sceneLoaded and cameraSettled. */
    cameraX(): number | undefined;
    /** Active zone (room) of the camera; updated on cameraSettled and scene entry (HU-GAME-012). */
    activeZone(): string | undefined;
    /** A drag or a scene transition is in progress: HUD navigation waits (HU-GAME-051 RN-7). */
    busy(): boolean;
    /** Map cards: every provides.locations of the loaded packs (HU-GAME-051 RN-2). */
    locations(): MapLocation[];
    /** Zone buttons of the active scene, with labels (HU-GAME-051 RN-5). */
    zones(): { id: string; label: string; icon?: string }[];
    /** Fade color into a scene (content data, default from the palette). */
    transitionColor(sceneId: string | undefined): string;
    /** Layers of a character, memoized (same array while its look does not change, HU-GAME-013 R7). */
    characterLayers(id: EntityId): CharacterLayerData[];
    /** Numbers for the dev performance overlay (HU-GAME-071). */
    perf(): { loadedEntities: number; lastTransitionMs?: number };
    /** Version of an installed pack (settings info, HU-GAME-075). */
    packVersion(packId: string): string | undefined;
    /** Audio settings (HU-GAME-058). */
    settings(): { musicVolume: number; sfxVolume: number; muted: boolean; language?: 'es' | 'en' };
    /** Backpack slots 0..capacity-1 (HU-GAME-038). Same array while nothing changes. */
    inventorySlots(): InventorySlotView[];
    /** Player characters, oldest first (HU-GAME-022 R4). Same array while nothing changes. */
    characters(): CharacterSummary[];
    /** Options of the creator (HU-GAME-018 R2). */
    characterCatalog(): CharacterPartsCatalog | undefined;
    /** starterClothes with their slot and icon (HU-GAME-021). */
    clothingOptions(): ClothingOption[];
    /** Layers of an unsaved draft, idle and neutral (HU-GAME-018 R5). Same array for an equal draft. */
    previewCharacterLayers(draft: CharacterDraft): CharacterLayerData[];
    visibleEntities(viewport?: ViewportQuery): EntityRenderData[];
  };
  /** For adapters (audio, effects). UI reads state through selectors, never through events. */
  events: EventBus;
  /** Native asset sizes for culling sprites without an explicit size (set by the scene view). */
  setAssetSizeLookup(lookup: AssetSizeLookup): void;
  /** Test/diagnostics helper: number of listeners registered for an entity. */
  entityListenerCount(id: EntityId): number;
  /**
   * Development-only helpers for the render sandbox and debug menus.
   * `activateScene` is provisional until HU-GAME-010 adds scene loading via commands.
   */
  dev: {
    activateScene(scene: ActiveSceneInfo, entities: EntityInit[]): void;
    playEffect(entityId: EntityId, preset: TweenPresetId): void;
  };
}

export interface GameFacadeOptions {
  /** Native asset sizes, used by culling when a sprite has no explicit size. */
  assetSize?: AssetSizeLookup;
  /** UI language (UI_UX_GUIDELINES §5). Defaults to Spanish. */
  locale?: LocaleId;
}

const NO_ENTITIES: EntityRenderData[] = [];
/** Viewport keys kept per snapshot version; panning creates a new key per culling step. */
const MAX_VISIBLE_KEYS = 8;

/** Sprite asset for the entity's current state (sprite.byState, HU-GAME-025). */
export function resolveAsset(entity: Entity): AssetKey {
  return spriteAssetOf(entity) ?? entity.components.sprite!.asset;
}

/**
 * The only bridge between UI and engine (ARCHITECTURE §6.7, GAME_ENGINE §6).
 * Notifications are per transaction: listeners are called once per published batch,
 * even if an entity changed several times inside it.
 */
export function createGameFacade(engine: GameEngine, options: GameFacadeOptions = {}): GameFacade {
  let assetSize: AssetSizeLookup = options.assetSize ?? (() => undefined);
  const globalListeners = new Set<() => void>();
  const entityListeners = new Map<EntityId, Set<() => void>>();
  let snapshot: GameSnapshot = { version: 0 };
  // One entry per viewport key: several consumers (sandbox counter + SceneView) must each get a stable
  // array for useSyncExternalStore. Entries of an older snapshot version are dropped.
  let charactersCache: { version: number; data: CharacterSummary[] } | undefined;
  let inventoryCache: { version: number; data: InventorySlotView[] } | undefined;
  let settingsCache: { version: number; data: { musicVolume: number; sfxVolume: number; muted: boolean; language?: 'es' | 'en' } } | undefined;
  const previewCache = new Map<string, CharacterLayerData[]>();
  let clothingCache: ClothingOption[] | undefined;
  let locationCache: { key: string; value: MapLocation[] } | undefined;
  let zoneCache: { key: string; value: { id: string; label: string; icon?: string }[] } | undefined;
  const locale = (): LocaleId => engine.settings.language ?? options.locale ?? 'es';
  let visibleCache: { version: number; byKey: Map<string, EntityRenderData[]> } = { version: -1, byKey: new Map() };

  // Commands dispatched from listeners are queued and run after the current one (deterministic order).
  let dispatching = false;
  const queue: GameCommand[] = [];

  engine.events.subscribe((batch: readonly GameEvent[]) => {
    const changed = new Set<EntityId>();
    let stateChanged = false;
    for (const event of batch) {
      if (PRESENTATION_EVENTS.has(event.type)) continue; // presentation only: no state change
      stateChanged = true;
      const id = entityIdOf(event);
      if (id) changed.add(id);
    }
    if (!stateChanged) return;
    snapshot = { version: snapshot.version + 1 };
    for (const id of changed) {
      const listeners = entityListeners.get(id);
      if (listeners) for (const l of [...listeners]) l();
    }
    for (const l of [...globalListeners]) l();
  });

  function runQueued(): void {
    while (queue.length) engine.dispatch(queue.shift()!);
  }

  const facade: GameFacade = {
    dispatch(command) {
      if (dispatching) {
        queue.push(command);
        return { ok: true };
      }
      dispatching = true;
      try {
        return engine.dispatch(command);
      } finally {
        try {
          runQueued();
        } finally {
          dispatching = false;
        }
      }
    },
    subscribe(listener) {
      globalListeners.add(listener);
      return () => {
        globalListeners.delete(listener);
      };
    },
    subscribeEntity(id, listener) {
      let set = entityListeners.get(id);
      if (!set) entityListeners.set(id, (set = new Set()));
      set.add(listener);
      return () => {
        set!.delete(listener);
        if (set!.size === 0) entityListeners.delete(id);
      };
    },
    getSnapshot: () => snapshot,
    getEntity: (id) => engine.world.get(id),
    absoluteTransform: (id) => engine.absoluteTransform(id),
    carriedBy: (id) => engine.world.all().filter((e) => e.components.transform?.parentId === id),
    pickDraggable: (point, minHitWorld) => engine.pickDraggable(point, minHitWorld),
    // Active language: the player's setting, else the device default passed at creation (HU-GAME-075 RN-3).
    t: (key, locale) => engine.content?.t(key, locale ?? engine.settings.language ?? options.locale ?? 'es') ?? key,
    selectors: {
      activeScene: () => engine.scene,
      cameraX: () => engine.playerState.cameraX,
      activeZone: () => engine.activeZoneId,
      busy: () => engine.isDragging || engine.isTransitioning,
      locations: () => {
        const content = engine.content;
        if (!content) return EMPTY_LOCATIONS;
        const current = engine.scene ? content.scene(engine.scene.id) : undefined;
        const unlocks = engine.playerState.unlocks;
        const key = JSON.stringify([current?.qualifiedId, unlocks, locale()]);
        if (locationCache?.key === key) return locationCache.value;
        const value = content.packs().flatMap((m) =>
          (m.provides.locations ?? []).map((l) => {
            const sceneId = l.entrySceneId.includes(':') ? l.entrySceneId : `${m.id}:${l.entrySceneId}`;
            const id = `${m.id}:${l.id}`;
            return {
              id,
              label: content.t(l.name, locale()),
              icon: l.icon,
              sceneId,
              spawnId: l.entrySpawnId,
              current: !!current && current.pack === m.id && current.location === l.id,
              // MVP: every location is unlocked unless player.unlocks lists some (GAME_RULES R7).
              locked: !!unlocks?.length && !unlocks.includes(id) && !unlocks.includes(l.id),
            };
          }),
        );
        locationCache = { key, value };
        return value;
      },
      zones: () => {
        const scene = engine.scene;
        const key = JSON.stringify([scene?.id, locale()]);
        if (zoneCache?.key === key) return zoneCache.value;
        const value = (scene?.zones ?? []).map((z) => ({ id: z.id, label: engine.content?.t(z.name, locale()) ?? z.name, icon: z.icon }));
        zoneCache = { key, value };
        return value;
      },
      transitionColor: (sceneId) => (sceneId && engine.content?.scene(sceneId)?.transitionColor) || DEFAULT_TRANSITION_COLOR,
      characterLayers: (id) => engine.characterLayers(id),
      packVersion: (packId) => engine.content?.manifest(packId)?.version,
      perf: () => ({ loadedEntities: engine.world.size, lastTransitionMs: engine.lastTransitionMs }),
      settings() {
        if (settingsCache?.version !== snapshot.version) settingsCache = { version: snapshot.version, data: engine.settings };
        return settingsCache.data;
      },
      inventorySlots() {
        if (inventoryCache?.version !== snapshot.version) {
          const data = engine.inventorySlots().map((id, slot) => {
            const e = id ? engine.world.get(id) : undefined;
            const name = e?.prefabId && engine.content?.hasPrefab(e.prefabId) ? engine.content.prefab(e.prefabId)?.metadata.name : undefined;
            return { slot, entityId: id ?? undefined, asset: e?.components.sprite ? resolveAsset(e) : undefined, name };
          });
          inventoryCache = { version: snapshot.version, data };
        }
        return inventoryCache.data;
      },
      characters() {
        if (charactersCache?.version !== snapshot.version) {
          charactersCache = { version: snapshot.version, data: engine.characterCommands.characters() };
        }
        return charactersCache.data;
      },
      characterCatalog: () => engine.content?.characterCatalog(),
      clothingOptions() {
        clothingCache ??= engine.characterCommands.clothingOptions();
        return clothingCache;
      },
      previewCharacterLayers(draft) {
        const key = JSON.stringify([draft.appearance, draft.outfit]);
        let layers = previewCache.get(key);
        if (!layers) {
          if (previewCache.size >= 16) previewCache.delete(previewCache.keys().next().value!);
          layers = engine.characterCommands.previewLayers(draft);
          previewCache.set(key, layers);
        }
        return layers;
      },
      visibleEntities(viewport) {
        const scene = engine.scene;
        if (!scene) return NO_ENTITIES;
        const key = viewport ? `${Math.round(viewport.cameraX)}:${Math.round(viewport.viewportW)}` : 'all';
        if (visibleCache.version !== snapshot.version) visibleCache = { version: snapshot.version, byKey: new Map() };
        const cached = visibleCache.byKey.get(key);
        if (cached) return cached;
        // Scene entities plus what is shown inside open containers (HU-GAME-034 R5).
        let entities = [...engine.world.all().filter((e) => isRenderable(e, scene.id)), ...engine.visibleContents()];
        const transformOf = (e: Entity) => engine.absoluteTransform(e.id);
        if (viewport) entities = cullEntities(entities, cullingRange(viewport.cameraX, viewport.viewportW), assetSize, transformOf);
        const data: EntityRenderData[] = sortForRender(entities, { supportOf: engine.world.index.supportOf, transformOf }).map((e, order) => {
          const sprite = e.components.sprite!;
          return {
            id: e.id,
            asset: resolveAsset(e),
            layer: sprite.layer,
            order,
            transform: transformOf(e) ?? { x: 0, y: 0 },
            pivot: sprite.pivot ?? { x: 0.5, y: 1 },
            size: sprite.size,
          };
        });
        if (visibleCache.byKey.size >= MAX_VISIBLE_KEYS) visibleCache.byKey.delete(visibleCache.byKey.keys().next().value!);
        // Blankets: right after each sleeping character, covering it but not what is in front of the bed.
        for (let i = data.length - 1; i >= 0; i--) {
          const e = engine.world.get(data[i].id);
          const bedId = e?.components.pose?.current === 'sleep' ? e.components.pose.seatId : undefined;
          const bed = bedId ? engine.world.get(bedId) : undefined;
          const cover = bed?.components.bed?.coverAsset;
          const bt = bed && engine.absoluteTransform(bed.id);
          if (!cover || !bt) continue;
          data.splice(i + 1, 0, {
            id: `${bed!.id}#cover`,
            asset: cover,
            layer: 'characters',
            order: data[i].order + 0.5,
            transform: bt,
            pivot: bed!.components.sprite?.pivot ?? { x: 0.5, y: 1 },
            cover: true,
          });
        }
        visibleCache.byKey.set(key, data);
        return data;
      },
    },
    events: engine.events,
    setAssetSizeLookup(lookup) {
      assetSize = lookup;
      visibleCache = { version: -1, byKey: new Map() };
    },
    entityListenerCount: (id) => entityListeners.get(id)?.size ?? 0,
    dev: {
      activateScene: (scene, entities) => engine.activateScene(scene, entities),
      playEffect: (entityId, preset) => engine.world.emit({ type: 'visualEffect', entityId, preset }),
    },
  };
  return facade;
}
