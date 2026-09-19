import { isOpenEntity } from '../actions/container-actions';
import { DEFAULT_INVENTORY_CAPACITY } from '../actions/inventory-actions';
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../audio/audio-director';
import { seatedTransform, seatSpec } from '../actions/seat-actions';
import type { ActionEnv, TravelRequest } from '../actions/types';
import { handAnchor } from '../characters/catalog';
import { CharacterCommands } from '../characters/character-commands';
import { CharacterSystem, type DragOrigin } from '../characters/character-system';
import { CharacterLayerSelector, HELD_SCALE, type CharacterLayerData } from '../characters/layers';
import type { ContentRegistry } from '../content/registry';
import { qualify } from '../content/validate-pack';
import type { PlayerState, SaveStore } from '../persistence/save-store';
import { InteractionResolver } from '../rules/resolver';
import { pickDraggable } from '../rules/hit-test';
import { RuleIndex } from '../rules/rule-index';
import { clampCameraX } from '../scene/camera-math';
import { absoluteTransform, childrenOf, unlink } from '../scene/parenting';
import { buildScene, type SavedSceneState } from '../scene/scene-builder';
import { sceneBounds, type ActiveSceneInfo } from '../scene/scene-types';
import { activeZoneFor } from '../scene/zones';
import { placeItem, recomputeSupport } from '../systems/surface-system';
import { VisualEffects } from '../systems/visual-effects';
import type { Components } from '../components/registry';
import { OK, type CommandResult, type GameCommand } from './commands';
import type { Entity, EntityInit } from './entity';
import { EventBus } from './events';
import type { Location } from './location';
import { LocationService } from './location-service';
import {
  mathRandom,
  silentLogger,
  systemClock,
  systemScheduler,
  type Clock,
  type Logger,
  type Random,
  type Scheduler,
} from './runtime';
import type { EntityId, SceneId, WorldPoint } from './types';
import { runtimeEntityId } from './ulid';
import { World } from './world';

export interface GameEngineOptions {
  clock?: Clock;
  /** Timers (pose and expression durations). FakeClock implements it in tests. */
  scheduler?: Scheduler;
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

/** Commands that come from the player's fingers; ignored while a transition plays (HU-GAME-050 RN-4). */
const INPUT_COMMANDS: ReadonlySet<string> = new Set(['pointerTap', 'pointerLongPress', 'dragStart', 'dragPreview', 'takeFromInventory', 'travelTo', 'focusEntity']);

/** First x from the spawn, stepping 120 units right (then left at the edge), with nobody closer than 120. */
export function freeSpot(spawnX: number, taken: readonly number[], width: number): number {
  const free = (x: number) => taken.every((o) => Math.abs(o - x) >= TRAVELER_SPACING);
  for (let i = 0; i < 24; i++) {
    for (const x of [spawnX + i * TRAVELER_SPACING, spawnX - i * TRAVELER_SPACING]) {
      if (x >= 0 && x <= width && free(x)) return x;
    }
  }
  return Math.min(Math.max(spawnX, 0), width);
}

interface DragState {
  entityId: EntityId;
  origin: { location: Location; transform?: Components['transform']; character?: DragOrigin };
}

/**
 * Engine root (GAME_ENGINE §2). All dependencies are injected; there are no global singletons.
 */
export class GameEngine {
  readonly clock: Clock;
  readonly scheduler: Scheduler;
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
  readonly characters: CharacterSystem;
  readonly characterCommands: CharacterCommands;
  private readonly layerSelector: CharacterLayerSelector;

  private activeScene: ActiveSceneInfo | undefined;
  private player: PlayerState = {};
  private viewportW: number | undefined;
  private zoneId: string | undefined;
  /** Duration of the last enterScene, for the dev performance overlay (HU-GAME-071). */
  lastTransitionMs: number | undefined;
  private drag: DragState | undefined;
  /** Saved diff per scene, provided by the SaveService (HU-GAME-053). */
  savedSceneProvider: ((sceneId: SceneId) => SavedSceneState | undefined) | undefined;
  /** Called synchronously before a scene unloads so dirty state is snapshotted (HU-GAME-052 RN-3). */
  beforeSceneUnload: (() => void) | undefined;
  /**
   * Plays scene changes (HU-GAME-050): fade out, flush, `enterScene`, fade in, `transitionDone`. Without a
   * handler (headless tests, tools) a travel enters the scene at once.
   */
  travelHandler: ((request: TravelRequest) => void) | undefined;
  /** A transition is playing: world input is ignored (HU-GAME-050 RN-4). */
  private transitioning = false;

  private constructor(options: GameEngineOptions) {
    this.clock = options.clock ?? systemClock;
    this.scheduler = options.scheduler ?? systemScheduler;
    this.random = options.random ?? mathRandom;
    this.logger = options.logger ?? silentLogger;
    this.saveStore = options.saveStore;
    this.content = options.content;
    this.dev = options.dev ?? defaultDev();
    this.world = new World({ bus: this.events, logger: this.logger, dev: this.dev });
    this.locations = new LocationService(this.world, this.logger, this.dev);
    this.effects = new VisualEffects(this.world);
    const catalog = () => this.content?.characterCatalog();
    this.characters = new CharacterSystem(this.world, this.events, this.clock, this.scheduler, this.logger, catalog);
    this.characterCommands = new CharacterCommands({
      world: this.world,
      locations: this.locations,
      characters: this.characters,
      content: this.content,
      clock: this.clock,
      logger: this.logger,
      newId: () => this.newRuntimeId(),
      scene: () => this.activeScene,
    });
    this.watchCarriers();
    this.layerSelector = new CharacterLayerSelector(
      this.world,
      () => {
        const c = catalog();
        return c ? { catalog: c, hasAsset: (key: string) => !!this.content?.asset(key) } : undefined;
      },
      this.logger,
    );
    this.rules = new RuleIndex(this.content?.rules() ?? []);
    this.resolver = new InteractionResolver(
      () => this.env(),
      this.rules,
      (e) => {
        const prefab = e?.prefabId && this.content?.hasPrefab(e.prefabId) ? this.content.prefab(e.prefabId) : undefined;
        return (prefab?.interactions?.disabledRules ?? []).map((r) => qualify(r, prefab!.pack));
      },
      (e) => this.heldTransform(e.id),
    );
  }

  /** A carrier that leaves the scene drops what it carries at its absolute position (HU-GAME-030 R7). */
  private watchCarriers(): void {
    this.events.subscribe((batch) => {
      for (const e of batch) {
        if (e.type !== 'entityMoved' || e.from.kind !== 'scene' || e.to.kind === 'scene') continue;
        const kids = childrenOf(this.world, e.id);
        const parent = this.world.get(e.id);
        const pt = parent?.components.transform;
        if (!kids.length || !pt || !this.activeScene) continue;
        const scene = this.activeScene;
        this.world.transaction(() => {
          for (const kid of kids) {
            const t = kid.components.transform!;
            const at = { x: pt.x + t.x, y: pt.y + t.y };
            this.world.update(kid.id, { transform: { x: at.x, y: at.y } });
            if (kid.location.kind === 'scene' && kid.location.sceneId === scene.id) placeItem(this.world, scene, kid.id, at, this.logger);
          }
        });
      }
    });
  }

  /**
   * World transform of an entity: items on carriers are relative (HU-GAME-030); items shown inside an open
   * container sit at its slot (HU-GAME-034 R5). Undefined when the entity is not drawn in the world.
   */
  absoluteTransform(id: EntityId): Components['transform'] | undefined {
    const e = this.world.get(id);
    if (!e) return undefined;
    switch (e.location.kind) {
      case 'scene':
        return absoluteTransform((x) => this.world.get(x), e);
      case 'container':
        return this.slotTransform(e);
      case 'held':
        return this.heldTransform(id);
      default:
        return undefined; // backpack, worn, limbo: not in the world
    }
  }

  private slotTransform(e: Entity): Components['transform'] | undefined {
    if (e.location.kind !== 'container') return undefined;
    const container = this.world.get(e.location.containerId);
    const c = container?.components.container;
    const ct = container && absoluteTransform((x) => this.world.get(x), container);
    const slot = c?.slots?.[e.location.slot];
    if (!container || !c || !ct || !slot || container.location.kind !== 'scene') return undefined;
    if (!isOpenEntity(container) || c.showContentsWhenOpen === false) return undefined;
    const { parentId: _p, ...own } = e.components.transform ?? { x: 0, y: 0 };
    void _p;
    return { ...own, x: ct.x + slot.x, y: ct.y + slot.y };
  }

  /** Entities drawn inside open containers of the active scene (HU-GAME-034 R5). */
  visibleContents(): Entity[] {
    const scene = this.activeScene;
    if (!scene) return [];
    return this.world.query({ locationKind: 'container' }).filter((e) => {
      const c = e.location.kind === 'container' ? this.world.get(e.location.containerId) : undefined;
      return c?.location.kind === 'scene' && c.location.sceneId === scene.id && e.components.sprite && this.slotTransform(e) !== undefined;
    });
  }

  static create(options: GameEngineOptions = {}): GameEngine {
    return new GameEngine(options);
  }

  /** A fresh rt_ id, never one already in the World (a loaded save may hold ids from the same clock). */
  newRuntimeId(): EntityId {
    let id = runtimeEntityId(this.clock, this.random);
    while (this.world.has(id)) id = runtimeEntityId(this.clock, this.random);
    return id;
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

  /**
   * Forgets every loaded entity and the active scene, as after a cold start (HU-GAME-055 reset). The save
   * is not touched: entities leave as "unload".
   */
  unloadAll(): void {
    this.drag = undefined;
    this.world.transaction(() => {
      for (const e of this.world.all()) this.world.remove(e.id, { unload: true });
    });
    this.activeScene = undefined;
    this.zoneId = undefined;
    this.player = { settings: this.player.settings };
  }

  /** Restores player state from a save (HU-GAME-053). */
  setPlayerState(player: PlayerState): void {
    this.player = { ...player };
  }

  private env(): ActionEnv | undefined {
    if (!this.activeScene) return undefined;
    return {
      world: this.world,
      locations: this.locations,
      effects: this.effects,
      logger: this.logger,
      scene: this.activeScene,
      characters: this.characters,
      inventoryCapacity: () => this.inventoryCapacity,
      instantiate: (prefabId, owner) => this.instantiate(prefabId, owner),
    };
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
    if (this.transitioning && command && INPUT_COMMANDS.has(command.type)) return { ok: false, reason: 'transitioning' };
    switch (command?.type) {
      case 'cameraSettled':
        return this.cameraSettled(command.cameraX, command.viewportW);
      case 'viewportChanged':
        if (!(command.viewportW > 0)) return { ok: false, reason: 'invalidCommand' };
        this.viewportW = command.viewportW;
        return OK;
      case 'enterScene':
        return this.enterScene(command.sceneId, command.spawnId, command.travelers ?? []);
      case 'travelTo':
        return this.travel({ sceneId: command.sceneId, spawnId: command.spawnId, travelers: [] });
      case 'transitionDone':
        this.transitioning = false;
        return OK;
      case 'pointerTap':
        return this.pointerTap(command.worldPoint, command.minHitWorld);
      case 'pointerLongPress':
        return this.pointerLongPress(command.worldPoint, command.minHitWorld);
      case 'dragStart':
        return this.dragStart(command.entityId, command.worldPoint);
      case 'dragEnd':
        return this.dragEnd(command.entityId, command.worldPoint, command.uiTarget, command.minHitWorld);
      case 'dragCancel':
        return this.dragCancel(command.entityId);
      case 'dragPreview':
        return this.dragPreview(command.entityId, command.worldPoint, command.uiTarget, command.minHitWorld);
      case 'createCharacter':
        return this.characterCommands.createCharacter(command.appearance, command.outfit ?? {});
      case 'updateAppearance':
        return this.characterCommands.updateAppearance(command.characterId, command.patch ?? {});
      case 'setOutfitSlot':
        return this.characterCommands.setOutfitSlot(command.characterId, command.slot, command.prefabId ?? null);
      case 'focusEntity':
        return this.focusEntity(command.entityId);
      case 'takeFromInventory':
        return this.takeFromInventory(command.slot, command.worldPoint);
      case 'setSetting':
        return this.setSetting(command.key, command.value);
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
    const t0 = this.clock.now();
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
      // Travelers stand at the spawn, 120 units away from anyone already there (HU-GAME-049 RN-8).
      const taken = this.world
        .query({ sceneId, has: ['character'] })
        .filter((c) => !travelers.includes(c.id))
        .map((c) => c.components.transform?.x ?? 0);
      for (const id of travelers) {
        const t = this.world.get(id);
        if (!t) continue;
        const x = freeSpot(spawn!.x, taken, def.size.width);
        taken.push(x);
        this.locations.move(id, { kind: 'scene', sceneId });
        this.world.update(id, { transform: { ...(t.components.transform ?? {}), x, y: spawn!.y, flipX: spawn!.facing === 'left' ? true : spawn!.facing === 'right' ? false : t.components.transform?.flipX } });
        if (t.components.pose && t.components.pose.current !== 'idle') this.characters.setPose(id, 'idle', { force: true });
      }
      this.activeScene = built.info;
      this.repairSeats(sceneId, spawnDefault);
      // Arriving from another scene the camera centers the arrival spawn (HU-GAME-049 RN-9).
      const cameraX = resuming ? this.player.cameraX! : this.initialCameraX(built.info, spawn!.x, !!from);
      this.player = { ...this.player, currentSceneId: sceneId, cameraX };
      recomputeSupport(this.world, built.info);
      this.world.emit({ type: 'sceneLoaded', from, to: sceneId, cameraX });
      // The zone is computed with the initial camera (HU-GAME-012 R2); a new scene starts without zone.
      this.zoneId = undefined;
      this.updateZone(built.info, cameraX);
    });
    this.lastTransitionMs = this.clock.now() - t0;
    return OK;
  }

  /**
   * Seated characters whose seat no longer exists (pack update) stand at the floor, and a second
   * occupant of the same seat goes to the default spawn (HU-GAME-014/045 edge cases, SAVE_SYSTEM §5).
   */
  private repairSeats(sceneId: SceneId, spawn: { x: number; y: number }): void {
    const seen = new Set<EntityId>();
    for (const c of this.world.query({ sceneId, has: ['character'] })) {
      const seatId = c.components.pose?.seatId;
      if (!seatId) continue;
      const seat = this.world.get(seatId);
      if (!seat || !seatSpec(seat)) {
        this.logger.warn(`Seat ${seatId} of ${c.id} no longer exists; standing up`);
        this.world.update(c.id, { pose: { current: 'idle' }, transform: { ...(c.components.transform ?? { x: spawn.x, y: spawn.y }), y: spawn.y } });
        continue;
      }
      if (seen.has(seatId)) {
        this.logger.warn(`Invariant repaired: two characters on ${seatId}; ${c.id} moved to the default spawn`);
        this.world.update(c.id, { pose: { current: 'idle' }, transform: { ...(c.components.transform ?? {}), x: spawn.x, y: spawn.y } });
        continue;
      }
      seen.add(seatId);
      this.world.update(c.id, { transform: seatedTransform(this.world, seat, c) });
    }
  }

  /** SCENE_SYSTEM §2 step 6: camera.startX, else centered on camera.startSpawnId, else on the arrival spawn. */
  private initialCameraX(scene: ActiveSceneInfo, arrivalX: number, arriving = false): number {
    const w = this.viewportW;
    let target: number;
    if (arriving) target = arrivalX - (w ?? 0) / 2;
    else if (scene.camera?.startX !== undefined) target = scene.camera.startX;
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

  /** A runtime instance of a prefab (rt_ id), without location (spawn, replace). */
  instantiate(prefabId: string, owner?: Entity): EntityInit | undefined {
    const content = this.content;
    const pack = owner?.prefabId?.includes(':') ? owner.prefabId.split(':')[0] : undefined;
    const p = content?.hasPrefab(prefabId, pack) ? content.prefab(prefabId, pack) : undefined;
    if (!p) return undefined;
    return {
      id: this.newRuntimeId(),
      prefabId: p.qualifiedId,
      tags: [...(p.tags ?? [])],
      location: { kind: 'limbo' },
      components: JSON.parse(JSON.stringify(p.components)),
    };
  }

  /** Audio settings with defaults (HU-GAME-058 RN-5). */
  get settings(): AudioSettings {
    return { ...DEFAULT_AUDIO_SETTINGS, ...(this.player.settings ?? {}) };
  }

  /** HU-GAME-058: volumes 0..1 in steps of 0.1, muted boolean; persisted through playerChanged. */
  private setSetting(key: 'musicVolume' | 'sfxVolume' | 'muted' | 'language', value: number | boolean | string): CommandResult {
    const current = this.settings;
    if (key === 'language') {
      if (value !== 'es' && value !== 'en') return { ok: false, reason: 'invalidCommand' };
      current.language = value;
    } else if (key === 'muted') {
      if (typeof value !== 'boolean') return { ok: false, reason: 'invalidCommand' };
      current.muted = value;
    } else {
      if (typeof value !== 'number' || !Number.isFinite(value)) return { ok: false, reason: 'invalidCommand' };
      current[key] = Math.round(Math.min(Math.max(value, 0), 1) * 10) / 10;
    }
    this.player = { ...this.player, settings: current };
    this.world.emit({ type: 'playerChanged', keys: ['settings'] });
    return OK;
  }

  get inventoryCapacity(): number {
    return this.player.inventory?.capacity ?? DEFAULT_INVENTORY_CAPACITY;
  }

  /** Backpack slots, 0..capacity-1, with the entity in each (HU-GAME-038 R1). */
  inventorySlots(): (EntityId | null)[] {
    const occupied = this.world.index.inventory();
    return Array.from({ length: this.inventoryCapacity }, (_, i) => occupied[i] ?? null);
  }

  /**
   * Takes an item out of the backpack at the finger and starts its drag (HU-GAME-038 R2). dragCancel puts
   * it back in the same slot (R8) because the drag origin is the inventory location.
   */
  private takeFromInventory(slot: number, point: WorldPoint): CommandResult {
    if (!this.activeScene) return { ok: false, reason: 'noActiveScene' };
    if (this.drag) return { ok: false, reason: 'alreadyDragging' };
    const id = this.world.index.inventory()[slot];
    const e = id ? this.world.get(id) : undefined;
    if (!e) return { ok: false, reason: 'entityNotFound' };
    const origin: DragState['origin'] = { location: e.location, transform: e.components.transform };
    this.world.transaction(() => {
      this.locations.move(e.id, { kind: 'scene', sceneId: this.activeScene!.id });
      this.world.update(e.id, { transform: { ...(e.components.transform ?? {}), x: point.x, y: point.y } });
    });
    this.drag = { entityId: e.id, origin };
    this.lastPreview = undefined;
    return { ok: true, startDrag: e.id, entityId: e.id };
  }

  /** Moves the camera to an entity; enters its scene first when it is elsewhere (GAME_ENGINE §4). */
  private focusEntity(entityId: EntityId): CommandResult {
    const e = this.world.get(entityId);
    if (!e) return { ok: false, reason: 'entityNotFound' };
    if (e.location.kind !== 'scene') return { ok: false, reason: 'invalidCommand' };
    if (this.activeScene?.id !== e.location.sceneId) {
      const r = this.enterScene(e.location.sceneId, 'default');
      if (!r.ok) return r;
    }
    this.world.emit({ type: 'focusRequested', entityId, x: e.components.transform?.x ?? 0 });
    return { ok: true, entityId };
  }

  // ---------- input (HU-GAME-027/028/031/032) ----------

  /** Draggable entity under a point for the gesture's first hit test (HU-GAME-026 R5b). */
  pickDraggable(point: WorldPoint, minHitWorld?: number): EntityId | undefined {
    if (!this.activeScene) return undefined;
    return pickDraggable(this.world, point, {
      sceneId: this.activeScene.id,
      minHitWorld,
      hasDirectRules: (e) => this.rules.hasDirectRules(e),
      heldTransform: (e) => this.heldTransform(e.id),
    });
  }

  /** Layers of a character for the renderer (HU-GAME-013). Memoized: same array while nothing changed. */
  characterLayers(id: EntityId): CharacterLayerData[] {
    return this.layerSelector.select(id);
  }

  /** World transform of an item in a character's hand: holder + anchor, mirrored and scaled (HU-GAME-016 R5). */
  heldTransform(itemId: EntityId): Components['transform'] | undefined {
    const item = this.world.get(itemId);
    if (item?.location.kind !== 'held') return undefined;
    const holder = this.world.get(item.location.holderId);
    const t = holder?.components.transform;
    const appearance = holder?.components.appearance;
    const body = appearance && this.characters.body(appearance.bodyType);
    if (!holder || !t || !body) return undefined;
    const scale = t.scale ?? 1;
    const flip = t.flipX ? -1 : 1;
    const anchor = handAnchor(body, holder.components.pose?.current ?? 'idle', item.location.hand);
    return { x: t.x + flip * anchor.x * scale, y: t.y + anchor.y * scale, scale: HELD_SCALE * scale, flipX: t.flipX };
  }

  private pointerTap(point: WorldPoint, minHitWorld?: number): CommandResult {
    if (!this.activeScene) return { ok: false, reason: 'noActiveScene' };
    this.resolver.resolve({ trigger: 'tap', point, minHitWorld });
    return OK;
  }

  /**
   * longPress rules (v1: unwear_clothes). An action may return startDrag: the item is already in the scene
   * at the finger and the drag starts now; dragCancel puts it back where it was (HU-GAME-040 R4, R9).
   */
  private pointerLongPress(point: WorldPoint, minHitWorld?: number): CommandResult {
    if (!this.activeScene) return { ok: false, reason: 'noActiveScene' };
    if (this.drag) return { ok: false, reason: 'alreadyDragging' };
    const before = new Map(this.world.all().map((e) => [e.id, e]));
    const outcome = this.resolver.resolve({ trigger: 'longPress', point, minHitWorld });
    if (outcome.kind !== 'performed' || !outcome.startDrag) return OK;
    const origin = before.get(outcome.startDrag);
    this.drag = {
      entityId: outcome.startDrag,
      origin: { location: origin?.location ?? { kind: 'scene', sceneId: this.activeScene.id }, transform: origin?.components.transform },
    };
    this.lastPreview = undefined;
    return { ok: true, startDrag: outcome.startDrag, entityId: outcome.startDrag };
  }

  private dragStart(entityId: EntityId, point: WorldPoint): CommandResult {
    const e = this.world.get(entityId);
    if (!e) return { ok: false, reason: 'entityNotFound' };
    if (!e.components.draggable || e.components.draggable.enabled === false) return { ok: false, reason: 'notDraggable' };
    if (!this.activeScene) return { ok: false, reason: 'noActiveScene' };
    if (this.drag) return { ok: false, reason: 'alreadyDragging' };
    const origin: DragState['origin'] = { location: e.location, transform: e.components.transform };
    // Location transitions by location kind (HU-GAME-027 R4). No per-object logic.
    switch (e.location.kind) {
      case 'scene':
        // Lifting a carried item separates it from its furniture (HU-GAME-030 R5).
        if (e.components.transform?.parentId) unlink(this.world, entityId);
        break;
      case 'held':
        this.world.transaction(() => {
          this.locations.move(entityId, { kind: 'scene', sceneId: this.activeScene!.id });
          this.world.update(entityId, { transform: { ...(e.components.transform ?? {}), x: point.x, y: point.y } });
        });
        break;
      case 'container': {
        // takeOut implícito (HU-GAME-036 R3): only from an open container of the active scene.
        const at = this.slotTransform(e);
        if (!at) return { ok: false, reason: 'notDraggable' };
        this.world.transaction(() => {
          this.locations.move(entityId, { kind: 'scene', sceneId: this.activeScene!.id });
          this.world.update(entityId, { transform: { ...at, x: point.x, y: point.y } });
        });
        break;
      }
      default:
        // worn (HU-GAME-040), inventory (HU-GAME-038): not draggable yet.
        return { ok: false, reason: 'notDraggable' };
    }
    // Characters: standUp implícito, temporary pose cancelled, dangle + surprised (HU-GAME-017 R2).
    if (e.components.character) origin.character = this.characters.onDragStart(entityId);
    this.drag = { entityId, origin };
    this.world.emit({ type: 'pickedUp', entityId });
    this.lastPreview = undefined;
    return OK;
  }

  /** Last preview sent, to emit dropPreview only when the target, zone or UI target changes (HU-GAME-033 R1). */
  private lastPreview: string | undefined;

  private dragPreview(entityId: EntityId, point: WorldPoint, uiTarget?: 'inventory' | 'trash', minHitWorld?: number): CommandResult {
    if (this.drag?.entityId !== entityId) return { ok: false, reason: 'notDragging' };
    const p = this.resolver.preview({ trigger: 'drop', sourceId: entityId, point, uiTarget, minHitWorld });
    const key = JSON.stringify([p.targetId, p.zone, uiTarget, p.ruleId, p.ok]);
    if (key === this.lastPreview) return OK;
    this.lastPreview = key;
    this.world.emit({ type: 'dropPreview', sourceId: entityId, uiTarget, ...p });
    return OK;
  }

  private dragEnd(entityId: EntityId, point: WorldPoint, uiTarget?: 'inventory' | 'trash', minHitWorld?: number): CommandResult {
    if (this.drag?.entityId !== entityId) return { ok: false, reason: 'notDragging' };
    this.drag = undefined;
    if (!this.world.has(entityId)) return { ok: false, reason: 'entityNotFound' };
    const outcome = this.resolver.resolve({ trigger: 'drop', sourceId: entityId, point, uiTarget, minHitWorld });
    this.refreshCarried(entityId);
    // A drop that did not pose the character (sit, sleep…) leaves it standing (HU-GAME-017 R6).
    if (this.world.get(entityId)?.components.character) this.characters.onDragEnd(entityId);
    this.effects.trigger(entityId, 'drop');
    this.world.emit({ type: 'dropped', entityId, placed: outcome.kind !== 'performed' });
    if (outcome.kind === 'performed' && outcome.travel) return this.travel(outcome.travel);
    return OK;
  }

  /** Portal or map travel (HU-GAME-049/051): through the travel handler when the app has one. */
  private travel(request: TravelRequest): CommandResult {
    if (!this.content?.scene(request.sceneId)) {
      this.logger.warn(`Travel to unknown scene ${request.sceneId}`);
      return { ok: false, reason: 'unknownScene' };
    }
    if (!this.travelHandler) return this.enterScene(request.sceneId, request.spawnId, request.travelers);
    if (this.drag) this.dragCancel(this.drag.entityId);
    this.transitioning = true;
    this.world.transaction(() => this.world.emit({ type: 'transitionStarted', from: this.activeScene?.id, to: request.sceneId }));
    this.travelHandler(request);
    return OK;
  }

  /** An entity is being dragged (the map button waits, HU-GAME-051 RN-7). */
  get isDragging(): boolean {
    return !!this.drag;
  }

  /** True while a transition plays (HUD buttons are disabled too). */
  get isTransitioning(): boolean {
    return this.transitioning;
  }

  /**
   * Items carried by a moved piece of furniture keep their relative position (HU-GAME-030 R4). They are
   * re-emitted so views re-render them; one that would leave the scene is clamped and unlinked (R8).
   */
  private refreshCarried(parentId: EntityId): void {
    const scene = this.activeScene;
    // Characters sitting or sleeping on it follow its anchor (HU-GAME-048 R3).
    const moved = this.world.get(parentId);
    if (moved && seatSpec(moved)) {
      const occupants = this.world.all().filter((e) => e.components.pose?.seatId === parentId);
      if (occupants.length) {
        this.world.transaction(() => {
          for (const o of occupants) this.world.update(o.id, { transform: seatedTransform(this.world, moved, o) });
        });
      }
    }
    // Items shown inside a moved container follow it too: re-emit them so views redraw (HU-GAME-034 R5).
    const contents = this.world.index.inContainer(parentId).filter((x): x is EntityId => !!x);
    if (contents.length) {
      this.world.transaction(() => {
        for (const id of contents) {
          const t = this.world.get(id)?.components.transform;
          if (t) this.world.update(id, { transform: { ...t } });
        }
      });
    }
    const kids = childrenOf(this.world, parentId);
    if (!scene || !kids.length) return;
    let unlinked = false;
    this.world.transaction(() => {
      for (const kid of kids) {
        const abs = absoluteTransform((x) => this.world.get(x), kid)!;
        if (abs.x < 0 || abs.x > scene.size.width) {
          // Clamped and unlinked; its support is recomputed from geometry below.
          this.world.update(kid.id, { transform: { ...abs, x: Math.min(Math.max(abs.x, 0), scene.size.width) } });
          this.world.setSupport(kid.id, undefined);
          unlinked = true;
        } else {
          this.world.update(kid.id, { transform: { ...kid.components.transform! } });
          this.world.setSupport(kid.id, parentId);
        }
      }
      if (unlinked) recomputeSupport(this.world, scene);
    });
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
      if (drag.origin.character) this.characters.onDragCancel(entityId, drag.origin.character);
    });
    return OK;
  }
}
