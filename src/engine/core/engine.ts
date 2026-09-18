import type { ActionEnv } from '../actions/types';
import type { ContentRegistry } from '../content/registry';
import { qualify } from '../content/validate-pack';
import type { PlayerState, SaveStore } from '../persistence/save-store';
import { InteractionResolver } from '../rules/resolver';
import { pickDraggable } from '../rules/hit-test';
import { RuleIndex } from '../rules/rule-index';
import { clampCameraX } from '../scene/camera-math';
import { buildScene, type SavedSceneState } from '../scene/scene-builder';
import { sceneBounds, type ActiveSceneInfo } from '../scene/scene-types';
import { activeZoneFor } from '../scene/zones';
import { recomputeSupport } from '../systems/surface-system';
import { VisualEffects } from '../systems/visual-effects';
import type { Components } from '../components/registry';
import { OK, type CommandResult, type GameCommand } from './commands';
import type { EntityInit } from './entity';
import { EventBus } from './events';
import type { Location } from './location';
import { LocationService } from './location-service';
import { mathRandom, silentLogger, systemClock, type Clock, type Logger, type Random } from './runtime';
import type { EntityId, SceneId, WorldPoint } from './types';
import { runtimeEntityId } from './ulid';
import { World } from './world';

export interface GameEngineOptions {
  clock?: Clock;
  random?: Random;
  logger?: Logger;
  saveStore?: SaveStore;
  content?: ContentRegistry;
  /** Dev mode: invariants throw. Defaults to `__DEV__` when defined, otherwise true. */
  dev?: boolean;
}

function defaultDev(): boolean {
  const flag = (globalThis as { __DEV__?: boolean }).__DEV__;
  return flag === undefined ? true : flag;
}

/** Travelers arrive at the spawn separated by 120 units (SCENE_SYSTEM §2). */
export const TRAVELER_SPACING = 120;

interface DragState {
  entityId: EntityId;
  origin: { location: Location; transform?: Components['transform'] };
}

/**
 * Engine root (GAME_ENGINE §2). All dependencies are injected; there are no global singletons.
 */
export class GameEngine {
  readonly clock: Clock;
  readonly random: Random;
  readonly logger: Logger;
  readonly saveStore?: SaveStore;
  readonly content?: ContentRegistry;
  readonly dev: boolean;
  readonly events = new EventBus();
  readonly world: World;
  readonly locations: LocationService;
  readonly effects: VisualEffects;
  readonly rules: RuleIndex;
  readonly resolver: InteractionResolver;

  private activeScene: ActiveSceneInfo | undefined;
  private player: PlayerState = {};
  private viewportW: number | undefined;
  private zoneId: string | undefined;
  private drag: DragState | undefined;
  /** Saved diff per scene, provided by the SaveService (HU-GAME-053). */
  savedSceneProvider: ((sceneId: SceneId) => SavedSceneState | undefined) | undefined;
  /** Called synchronously before a scene unloads so dirty state is snapshotted (HU-GAME-052 RN-3). */
  beforeSceneUnload: (() => void) | undefined;

  private constructor(options: GameEngineOptions) {
    this.clock = options.clock ?? systemClock;
    this.random = options.random ?? mathRandom;
    this.logger = options.logger ?? silentLogger;
    this.saveStore = options.saveStore;
    this.content = options.content;
    this.dev = options.dev ?? defaultDev();
    this.world = new World({ bus: this.events, logger: this.logger, dev: this.dev });
    this.locations = new LocationService(this.world, this.logger, this.dev);
    this.effects = new VisualEffects(this.world);
    this.rules = new RuleIndex(this.content?.rules() ?? []);
    this.resolver = new InteractionResolver(
      () => this.env(),
      this.rules,
      (e) => {
        const prefab = e?.prefabId && this.content?.hasPrefab(e.prefabId) ? this.content.prefab(e.prefabId) : undefined;
        return (prefab?.interactions?.disabledRules ?? []).map((r) => qualify(r, prefab!.pack));
      },
    );
  }

  static create(options: GameEngineOptions = {}): GameEngine {
    return new GameEngine(options);
  }

  newRuntimeId(): EntityId {
    return runtimeEntityId(this.clock, this.random);
  }

  get scene(): ActiveSceneInfo | undefined {
    return this.activeScene;
  }

  get playerState(): Readonly<PlayerState> {
    return this.player;
  }

  /** Active zone of the active scene (HU-GAME-012). */
  get activeZoneId(): string | undefined {
    return this.zoneId;
  }

  get draggingId(): EntityId | undefined {
    return this.drag?.entityId;
  }

  /** Restores player state from a save (HU-GAME-053). */
  setPlayerState(player: PlayerState): void {
    this.player = { ...player };
  }

  private env(): ActionEnv | undefined {
    if (!this.activeScene) return undefined;
    return { world: this.world, locations: this.locations, effects: this.effects, logger: this.logger, scene: this.activeScene };
  }

  /**
   * Activates a scene given directly (render sandbox and tests). Real scenes load from content packs
   * with the `enterScene` command (HU-GAME-010).
   */
  activateScene(scene: ActiveSceneInfo, entities: EntityInit[] = []): void {
    this.world.transaction(() => {
      this.unloadActiveScene();
      for (const e of entities) this.world.create(e);
      const from = this.activeScene?.id;
      this.activeScene = scene;
      this.zoneId = undefined;
      this.player = { ...this.player, currentSceneId: scene.id };
      recomputeSupport(this.world, scene);
      this.world.emit({ type: 'sceneLoaded', from, to: scene.id });
    });
  }

  /** Never throws towards the UI (GAME_ENGINE §8). */
  dispatch(command: GameCommand): CommandResult {
    try {
      return this.handle(command);
    } catch (error) {
      if (this.dev) throw error;
      this.logger.error('Command failed', { command, error: String(error) });
      return { ok: false, reason: 'internalError' };
    }
  }

  private handle(command: GameCommand): CommandResult {
    switch (command?.type) {
      case 'cameraSettled':
        return this.cameraSettled(command.cameraX, command.viewportW);
      case 'viewportChanged':
        if (!(command.viewportW > 0)) return { ok: false, reason: 'invalidCommand' };
        this.viewportW = command.viewportW;
        return OK;
      case 'enterScene':
        return this.enterScene(command.sceneId, command.spawnId, command.travelers ?? []);
      case 'pointerTap':
        return this.pointerTap(command.worldPoint, command.minHitWorld);
      case 'dragStart':
        return this.dragStart(command.entityId, command.worldPoint);
      case 'dragEnd':
        return this.dragEnd(command.entityId, command.worldPoint, command.uiTarget, command.minHitWorld);
      case 'dragCancel':
        return this.dragCancel(command.entityId);
      default:
        return { ok: false, reason: 'unknownCommand' };
    }
  }

  // ---------- scenes (HU-GAME-010/011) ----------

  private unloadActiveScene(): void {
    const old = this.activeScene;
    if (!old) return;
    {
      const inOld = (e: { location: Location }) => e.location.kind === 'scene' && e.location.sceneId === old.id;
      const sceneIds = new Set(this.world.all().filter((e) => inOld(e) && !e.tags.includes('character')).map((e) => e.id));
      // Container contents of the old scene go too (they are scene-bound).
      let grew = true;
      while (grew) {
        grew = false;
        for (const e of this.world.all()) {
          if (e.location.kind === 'container' && sceneIds.has(e.location.containerId) && !sceneIds.has(e.id)) {
            sceneIds.add(e.id);
            grew = true;
          }
        }
      }
      for (const id of sceneIds) this.world.remove(id, { unload: true });
    }
  }

  enterScene(sceneId: SceneId, spawnId: string, travelers: EntityId[] = []): CommandResult {
    if (!this.content) return { ok: false, reason: 'noContent' };
    const def = this.content.scene(sceneId);
    if (!def) return { ok: false, reason: 'unknownScene' };
    let spawn = def.spawnPoints.find((s) => s.id === spawnId);
    if (!spawn) {
      this.logger.warn(`Unknown spawn "${spawnId}" in ${sceneId}; using "default"`);
      spawn = def.spawnPoints.find((s) => s.id === 'default')!;
    }
    const from = this.activeScene?.id;
    const resuming = this.player.currentSceneId === sceneId && this.player.cameraX !== undefined && !from;
    this.beforeSceneUnload?.();
    this.world.emit({ type: 'sceneWillChange', from, to: sceneId });
    const built = buildScene(this.content, sceneId, { dev: this.dev, logger: this.logger, saved: this.savedSceneProvider?.(sceneId) });
    if (!built) return { ok: false, reason: 'unknownScene' };
    this.world.transaction(() => {
      this.unloadActiveScene();
      const spawnDefault = def.spawnPoints.find((s) => s.id === 'default')!;
      for (const e of built.entities) {
        if (this.world.has(e.id)) continue;
        const created = this.world.create(e);
        // Prod invariant repair (SAVE_SYSTEM §5): an entity that cannot take its slot goes to the default spawn.
        if (!created && e.location.kind !== 'scene') {
          this.logger.warn(`Invariant repaired: ${e.id} moved to the default spawn of ${sceneId}`);
          const t = (e.components as { transform?: object }).transform ?? {};
          this.world.create({ ...e, location: { kind: 'scene', sceneId }, components: { ...e.components, transform: { ...t, x: spawnDefault.x, y: spawnDefault.y } } });
        }
      }
      travelers.forEach((id, i) => {
        const t = this.world.get(id);
        if (!t) return;
        this.locations.move(id, { kind: 'scene', sceneId });
        this.world.update(id, { transform: { ...(t.components.transform ?? {}), x: spawn!.x + i * TRAVELER_SPACING, y: spawn!.y } });
      });
      this.activeScene = built.info;
      const cameraX = resuming ? this.player.cameraX! : this.initialCameraX(built.info, spawn!.x);
      this.player = { ...this.player, currentSceneId: sceneId, cameraX };
      recomputeSupport(this.world, built.info);
      this.world.emit({ type: 'sceneLoaded', from, to: sceneId, cameraX });
      // The zone is computed with the initial camera (HU-GAME-012 R2); a new scene starts without zone.
      this.zoneId = undefined;
      this.updateZone(built.info, cameraX);
    });
    return OK;
  }

  /** SCENE_SYSTEM §2 step 6: camera.startX, else centered on camera.startSpawnId, else on the arrival spawn. */
  private initialCameraX(scene: ActiveSceneInfo, arrivalX: number): number {
    const w = this.viewportW;
    let target: number;
    if (scene.camera?.startX !== undefined) target = scene.camera.startX;
    else {
      const sp = scene.spawnPoints?.find((s) => s.id === scene.camera?.startSpawnId);
      target = (sp?.x ?? arrivalX) - (w ?? 0) / 2;
    }
    return w ? clampCameraX(target, sceneBounds(scene), w) : Math.max(target, 0);
  }

  private cameraSettled(x: number, viewportW: number): CommandResult {
    if (!Number.isFinite(x) || !(viewportW > 0)) return { ok: false, reason: 'invalidCommand' };
    if (!this.activeScene) return { ok: false, reason: 'noActiveScene' };
    this.viewportW = viewportW;
    const scene = this.activeScene;
    const cameraX = clampCameraX(x, sceneBounds(scene), viewportW);
    this.world.transaction(() => {
      if (this.player.cameraX !== cameraX) {
        this.player = { ...this.player, cameraX };
        this.world.emit({ type: 'playerChanged', keys: ['cameraX'] });
      }
      this.updateZone(scene, cameraX);
    });
    return OK;
  }

  /** Recomputes the active zone; emits zoneChanged only when it changes (HU-GAME-012 R2-R3). */
  private updateZone(scene: ActiveSceneInfo, cameraX: number): void {
    const next = activeZoneFor(scene, cameraX, this.viewportW, this.zoneId);
    if (next === this.zoneId) return;
    this.zoneId = next;
    this.world.emit({ type: 'zoneChanged', sceneId: scene.id, zoneId: next });
  }

  // ---------- input (HU-GAME-027/028/031/032) ----------

  /** Draggable entity under a point for the gesture's first hit test (HU-GAME-026 R5b). */
  pickDraggable(point: WorldPoint, minHitWorld?: number): EntityId | undefined {
    if (!this.activeScene) return undefined;
    return pickDraggable(this.world, point, {
      sceneId: this.activeScene.id,
      minHitWorld,
      hasDirectRules: (e) => this.rules.hasDirectRules(e),
    });
  }

  private pointerTap(point: WorldPoint, minHitWorld?: number): CommandResult {
    if (!this.activeScene) return { ok: false, reason: 'noActiveScene' };
    this.resolver.resolve({ trigger: 'tap', point, minHitWorld });
    return OK;
  }

  private dragStart(entityId: EntityId, point: WorldPoint): CommandResult {
    const e = this.world.get(entityId);
    if (!e) return { ok: false, reason: 'entityNotFound' };
    if (!e.components.draggable || e.components.draggable.enabled === false) return { ok: false, reason: 'notDraggable' };
    if (!this.activeScene) return { ok: false, reason: 'noActiveScene' };
    if (this.drag) return { ok: false, reason: 'alreadyDragging' };
    const origin = { location: e.location, transform: e.components.transform };
    // Location transitions by location kind (HU-GAME-027 R4). No per-object logic.
    switch (e.location.kind) {
      case 'scene':
        break;
      case 'held':
        this.world.transaction(() => {
          this.locations.move(entityId, { kind: 'scene', sceneId: this.activeScene!.id });
          this.world.update(entityId, { transform: { ...(e.components.transform ?? {}), x: point.x, y: point.y } });
        });
        break;
      default:
        // container (HU-GAME-036), worn (HU-GAME-040), inventory (HU-GAME-038): not draggable yet.
        return { ok: false, reason: 'notDraggable' };
    }
    this.drag = { entityId, origin };
    return OK;
  }

  private dragEnd(entityId: EntityId, point: WorldPoint, uiTarget?: 'inventory' | 'trash', minHitWorld?: number): CommandResult {
    if (this.drag?.entityId !== entityId) return { ok: false, reason: 'notDragging' };
    this.drag = undefined;
    if (!this.world.has(entityId)) return { ok: false, reason: 'entityNotFound' };
    this.resolver.resolve({ trigger: 'drop', sourceId: entityId, point, uiTarget, minHitWorld });
    this.effects.trigger(entityId, 'drop');
    return OK;
  }

  private dragCancel(entityId: EntityId): CommandResult {
    const drag = this.drag;
    if (drag?.entityId !== entityId) return { ok: false, reason: 'notDragging' };
    this.drag = undefined;
    const e = this.world.get(entityId);
    if (!e) return OK;
    // Undo the dragStart transitions (HU-GAME-027 R11).
    this.world.transaction(() => {
      if (JSON.stringify(e.location) !== JSON.stringify(drag.origin.location)) this.locations.move(entityId, drag.origin.location);
      if (drag.origin.transform && e.components.transform !== drag.origin.transform) {
        this.world.update(entityId, { transform: drag.origin.transform });
      }
    });
    return OK;
  }
}
