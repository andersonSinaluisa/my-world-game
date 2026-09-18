import type { EntityInit } from './entity';
import { clampCameraX } from '../scene/camera-math';
import { sceneBounds, type ActiveSceneInfo } from '../scene/scene-types';
import type { PlayerState, SaveStore } from '../persistence/save-store';
import { VisualEffects } from '../systems/visual-effects';
import { OK, type CommandResult, type GameCommand } from './commands';
import { EventBus } from './events';
import { LocationService } from './location-service';
import { mathRandom, silentLogger, systemClock, type Clock, type Logger, type Random } from './runtime';
import type { EntityId } from './types';
import { runtimeEntityId } from './ulid';
import { World } from './world';

export interface GameEngineOptions {
  clock?: Clock;
  random?: Random;
  logger?: Logger;
  saveStore?: SaveStore;
  /** Dev mode: invariants throw. Defaults to `__DEV__` when defined, otherwise true. */
  dev?: boolean;
}

function defaultDev(): boolean {
  const flag = (globalThis as { __DEV__?: boolean }).__DEV__;
  return flag === undefined ? true : flag;
}

/**
 * Engine root (GAME_ENGINE §2). All dependencies are injected; there are no global singletons.
 * The content registry is added by HU-GAME-068 and scene loading by HU-GAME-010.
 */
export class GameEngine {
  readonly clock: Clock;
  readonly random: Random;
  readonly logger: Logger;
  readonly saveStore?: SaveStore;
  readonly dev: boolean;
  readonly events = new EventBus();
  readonly world: World;
  readonly locations: LocationService;
  readonly effects: VisualEffects;

  private activeScene: ActiveSceneInfo | undefined;
  private player: PlayerState = {};

  private constructor(options: GameEngineOptions) {
    this.clock = options.clock ?? systemClock;
    this.random = options.random ?? mathRandom;
    this.logger = options.logger ?? silentLogger;
    this.saveStore = options.saveStore;
    this.dev = options.dev ?? defaultDev();
    this.world = new World({ bus: this.events, logger: this.logger, dev: this.dev });
    this.locations = new LocationService(this.world, this.logger, this.dev);
    this.effects = new VisualEffects(this.world);
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

  /**
   * Provisional scene activation used by the harness and the render sandbox until
   * SceneService (HU-GAME-010) loads scenes from content packs.
   */
  activateScene(scene: ActiveSceneInfo, entities: EntityInit[] = []): void {
    this.world.transaction(() => {
      for (const e of this.world.query({ locationKind: 'scene' })) {
        if (e.location.kind === 'scene' && e.location.sceneId !== scene.id) this.world.remove(e.id);
      }
      for (const e of entities) this.world.create(e);
      this.activeScene = scene;
      this.player = { ...this.player, currentSceneId: scene.id };
      this.world.emit({ type: 'sceneLoaded', to: scene.id });
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
        return this.cameraSettled(command);
      case 'dragStart':
        // Drag is implemented by HU-GAME-027; for now only the existence check is meaningful.
        if (!this.world.has(command.entityId)) return { ok: false, reason: 'entityNotFound' };
        return { ok: false, reason: 'notImplemented' };
      default:
        return { ok: false, reason: 'unknownCommand' };
    }
  }

  private cameraSettled(command: Extract<GameCommand, { type: 'cameraSettled' }>): CommandResult {
    if (!Number.isFinite(command.cameraX) || !(command.viewportW > 0)) return { ok: false, reason: 'invalidCommand' };
    if (!this.activeScene) return { ok: false, reason: 'noActiveScene' };
    const cameraX = clampCameraX(command.cameraX, sceneBounds(this.activeScene), command.viewportW);
    if (this.player.cameraX === cameraX) return OK;
    this.player = { ...this.player, cameraX };
    this.world.emit({ type: 'playerChanged', keys: ['cameraX'] });
    return OK;
  }
}
