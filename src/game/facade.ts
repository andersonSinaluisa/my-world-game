import type { RenderLayer, Transform, TweenPresetId } from '@/engine/components/base';
import type { CommandResult, GameCommand } from '@/engine/core/commands';
import type { GameEngine } from '@/engine/core/engine';
import type { Entity, EntityInit } from '@/engine/core/entity';
import { entityIdOf, PRESENTATION_EVENTS, type EventBus, type GameEvent } from '@/engine/core/events';
import type { AssetKey, EntityId, WorldPoint } from '@/engine/core/types';
import type { CharacterLayerData } from '@/engine/characters/layers';
import type { LocaleId } from '@/engine/content/schemas';
import { cullEntities, cullingRange, type AssetSizeLookup } from '@/engine/scene/culling';
import { isRenderable, sortForRender } from '@/engine/scene/render-order';
import type { ActiveSceneInfo } from '@/engine/scene/scene-types';

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
    /** Layers of a character, memoized (same array while its look does not change, HU-GAME-013 R7). */
    characterLayers(id: EntityId): CharacterLayerData[];
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
  const sprite = entity.components.sprite!;
  const state = entity.components.states?.current;
  return (state && sprite.byState?.[state]) || sprite.asset;
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
    pickDraggable: (point, minHitWorld) => engine.pickDraggable(point, minHitWorld),
    t: (key, locale) => engine.content?.t(key, locale ?? options.locale ?? 'es') ?? key,
    selectors: {
      activeScene: () => engine.scene,
      cameraX: () => engine.playerState.cameraX,
      activeZone: () => engine.activeZoneId,
      characterLayers: (id) => engine.characterLayers(id),
      visibleEntities(viewport) {
        const scene = engine.scene;
        if (!scene) return NO_ENTITIES;
        const key = viewport ? `${Math.round(viewport.cameraX)}:${Math.round(viewport.viewportW)}` : 'all';
        if (visibleCache.version !== snapshot.version) visibleCache = { version: snapshot.version, byKey: new Map() };
        const cached = visibleCache.byKey.get(key);
        if (cached) return cached;
        let entities = engine.world.all().filter((e) => isRenderable(e, scene.id));
        if (viewport) entities = cullEntities(entities, cullingRange(viewport.cameraX, viewport.viewportW), assetSize);
        const data = sortForRender(entities, { supportOf: engine.world.index.supportOf }).map((e, order) => {
          const sprite = e.components.sprite!;
          return {
            id: e.id,
            asset: resolveAsset(e),
            layer: sprite.layer,
            order,
            transform: e.components.transform ?? { x: 0, y: 0 },
            pivot: sprite.pivot ?? { x: 0.5, y: 1 },
            size: sprite.size,
          };
        });
        if (visibleCache.byKey.size >= MAX_VISIBLE_KEYS) visibleCache.byKey.delete(visibleCache.byKey.keys().next().value!);
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
