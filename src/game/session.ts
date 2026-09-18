import { AppState, type AppStateStatus } from 'react-native';

import { BUNDLED_ASSET_MODULES, BUNDLED_PACKS } from '@content/index';
import type { AudioPort } from '@/engine/audio/audio-director';
import { AudioDirector } from '@/engine/audio/audio-director';
import type { AssetEntry } from '@/engine/adapters/render/asset-registry';
import { computeViewport } from '@/engine/adapters/render/viewport';
import { ContentRegistry } from '@/engine/content/registry';
import { GameEngine } from '@/engine/core/engine';
import type { Logger } from '@/engine/core/runtime';
import { defaultLocale } from '@/engine/content/locale';
import { CURRENT_SAVE_VERSION } from '@/engine/persistence/migrations';
import { SaveService, type LoadStatus } from '@/engine/persistence/save-service';
import type { SaveStore } from '@/engine/persistence/save-store';

import { createGameFacade, type GameFacade } from './facade';
import { ParentalGate } from './parental-gate';
import { createTextureStore, type TextureStore } from './textures';

const isDev = () => (typeof __DEV__ !== 'undefined' ? __DEV__ : true);

/** Console logger for the app. The engine never calls console directly (GAME_ENGINE §2). */
export const consoleLogger: Logger = {
  debug: (m, d) => (isDev() ? console.log(m, d ?? '') : undefined),
  warn: (m, d) => console.warn(m, d ?? ''),
  error: (m, d) => console.error(m, d ?? ''),
};

/** AssetKey → Metro module + native size, for every bundled image (HU-GAME-068 R6). */
export function bundledTextureEntries(content: ContentRegistry): Record<string, AssetEntry> {
  const out: Record<string, AssetEntry> = {};
  for (const [key, source] of Object.entries(BUNDLED_ASSET_MODULES)) {
    const size = content.assetSize(key);
    if (size) out[key] = { source, ...size };
  }
  return out;
}

/**
 * Game session of the app: one engine with the bundled content, persistence and app lifecycle.
 * Lives in the GameProvider (no module singletons, GAME_ENGINE §2). Screens only see the facade
 * and `start()`; they never touch the engine or the store.
 */
export class GameSession {
  readonly engine: GameEngine;
  readonly content: ContentRegistry;
  readonly facade: GameFacade;
  readonly textures: TextureStore;
  private save: SaveService | undefined;
  /** Character to center when the play screen shows again (HU-GAME-023 R4). */
  private pendingFocus: string | undefined;
  private starting: Promise<LoadStatus> | undefined;
  private appState: { remove(): void } | undefined;
  private audioState: { remove(): void } | undefined;
  readonly audio: AudioDirector | undefined;
  /** Parental gate state for the whole app: a 30 s lock survives screen changes (HU-GAME-074 RN-3). */
  readonly gate = new ParentalGate(Math.random, Date.now);

  constructor(
    private readonly openStore: () => Promise<{ store: SaveStore; status: 'ok' | 'incompatible' }>,
    readonly logger: Logger = consoleLogger,
    audioPort?: (source: (key: string) => number | undefined) => AudioPort,
  ) {
    this.content = ContentRegistry.load(BUNDLED_PACKS, { dev: isDev(), logger, corePack: 'core' });
    this.engine = GameEngine.create({ content: this.content, logger });
    this.facade = createGameFacade(this.engine, { assetSize: (k) => this.content.assetSize(k), locale: defaultLocale(deviceLanguageTag()) });
    this.textures = createTextureStore(bundledTextureEntries(this.content), { logger });
    if (audioPort) {
      const port = audioPort((key) => BUNDLED_ASSET_MODULES[key]);
      const engine = this.engine;
      this.audio = new AudioDirector({
        events: engine.events,
        clock: engine.clock,
        random: engine.random,
        content: this.content,
        getEntity: (id) => engine.world.get(id),
        activeScene: () => engine.scene,
        activeZone: () => engine.activeZoneId,
        sceneEntities: () => (engine.scene ? engine.world.query({ sceneId: engine.scene.id }) : []),
        settings: () => engine.settings,
        port,
      });
      // Settings apply at once (HU-GAME-058 RN-2); no audio in background (HU-GAME-056 RN-8, 057 RN-6).
      engine.events.subscribe((batch) => {
        if (batch.some((e) => e.type === 'playerChanged' && e.keys.includes('settings'))) this.audio?.applySettings();
      });
      this.audioState = AppState.addEventListener('change', (state: AppStateStatus) => {
        if (state === 'active') port.resumeAll();
        else port.pauseAll();
      });
    }
  }

  /** Button sound of the HUD and menus (AUDIO_SYSTEM §2). */
  uiTap(): void {
    this.audio?.uiTap();
  }

  /** Screen size in dp, so the first camera of a scene is centered correctly (SCENE_SYSTEM §2). */
  setScreenSize(widthDp: number, heightDp: number): void {
    const { viewportW } = computeViewport(widthDp, heightDp);
    if (viewportW > 0) this.engine.dispatch({ type: 'viewportChanged', viewportW });
  }

  /**
   * "Jugar" (HU-GAME-053/054): loads the save or starts a new game. Idempotent.
   * An incompatible save (newer app or content) is never touched: the child plays a new game that is not saved.
   */
  /** The save database, opened once (a failure leaves the game playable without saves). */
  private opened: Promise<{ store: SaveStore; status: 'ok' | 'incompatible' } | undefined> | undefined;

  private openOnce() {
    this.opened ??= this.openStore().catch((error) => {
      this.logger.error('Could not open the save database', { error: String(error) });
      return undefined;
    });
    return this.opened;
  }

  /**
   * What the title screen offers (HU-GAME-073): a save to continue, none (create a character), or an
   * incompatible/unreadable one (warning, no "Continue"). Loads nothing into the world.
   */
  async inspect(): Promise<'save' | 'none' | 'incompatible' | 'failed'> {
    if (this.save?.hasSave || this.engine.scene) return 'save';
    const opened = await this.openOnce();
    if (!opened) return 'failed';
    if (opened.status === 'incompatible') return 'incompatible';
    const slot = await opened.store.loadSlot('main');
    if (!slot) return 'none';
    return slot.saveVersion > CURRENT_SAVE_VERSION ? 'incompatible' : 'save';
  }

  /** Resets the world behind the parental gate (HU-GAME-055). */
  async resetWorld(keepCharacters: boolean) {
    await this.start();
    if (!this.save) return { ok: false as const, reason: 'noSave' as const };
    const r = await this.save.resetWorld(keepCharacters);
    // A later "Jugar" loads the new state (or starts a new game).
    if (r.ok) this.starting = r.status === 'new' ? undefined : this.starting;
    return r;
  }

  start(): Promise<LoadStatus> {
    this.starting ??= this.doStart();
    return this.starting;
  }

  private async doStart(): Promise<LoadStatus> {
    const opened = await this.openOnce();
    if (this.save) {
      // After a reset to a new game the service is still attached: start the new game on it.
      const r = await this.save.load();
      if (r.status === 'new') this.save.startNewGame();
      return r.status;
    }
    if (!opened || opened.status === 'incompatible') {
      this.startUnsaved();
      return opened ? 'incompatible' : 'failed';
    }
    const save = new SaveService(this.engine, opened.store).attach();
    const result = await save.load();
    if (result.status === 'new') save.startNewGame();
    if (result.status === 'incompatible' || result.status === 'failed') {
      this.logger.warn(`Save not loaded (${result.status}): ${result.detail ?? ''}`);
      save.detach();
      this.startUnsaved();
      return result.status;
    }
    this.save = save;
    // App to background: write now (SAVE_SYSTEM §3).
    this.appState = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') void this.save?.flush();
    });
    return result.status;
  }

  private startUnsaved(): void {
    const ng = this.content.newGame();
    if (!ng) throw new Error('No newGame configuration in the content packs');
    this.engine.setPlayerState({ currentSceneId: ng.sceneId, wallet: { coins: ng.coins }, unlocks: [...ng.unlocks], inventory: { capacity: ng.inventoryCapacity }, flags: {} });
    this.engine.dispatch({ type: 'enterScene', sceneId: ng.sceneId, spawnId: ng.spawnId });
  }

  requestFocus(entityId: string): void {
    this.pendingFocus = entityId;
  }

  /** Returns and clears the pending focus. */
  takeFocus(): string | undefined {
    const id = this.pendingFocus;
    this.pendingFocus = undefined;
    return id;
  }

  /** Metro module of an asset key, for React Native icons. */
  assetSource(key: string): number | undefined {
    return this.textures.registry.source(key);
  }

  /** Last autosave write duration (dev overlay). */
  get lastFlushMs(): number | undefined {
    return this.save?.lastFlushMs;
  }

  flush(): Promise<void> {
    return this.save?.flush() ?? Promise.resolve();
  }

  dispose(): void {
    this.appState?.remove();
    this.audioState?.remove();
    this.audio?.dispose();
    this.save?.detach();
  }
}

/** Language tag of the device (HU-GAME-075 RN-3), without expo-localization: Intl is available in Hermes. */
function deviceLanguageTag(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}
