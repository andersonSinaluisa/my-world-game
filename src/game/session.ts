import { AppState, type AppStateStatus } from 'react-native';

import { BUNDLED_ASSET_MODULES, BUNDLED_PACKS } from '@content/index';
import type { AssetEntry } from '@/engine/adapters/render/asset-registry';
import { computeViewport } from '@/engine/adapters/render/viewport';
import { ContentRegistry } from '@/engine/content/registry';
import { GameEngine } from '@/engine/core/engine';
import type { Logger } from '@/engine/core/runtime';
import { SaveService, type LoadStatus } from '@/engine/persistence/save-service';
import type { SaveStore } from '@/engine/persistence/save-store';

import { createGameFacade, type GameFacade } from './facade';
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

  constructor(
    private readonly openStore: () => Promise<{ store: SaveStore; status: 'ok' | 'incompatible' }>,
    readonly logger: Logger = consoleLogger,
  ) {
    this.content = ContentRegistry.load(BUNDLED_PACKS, { dev: isDev(), logger, corePack: 'core' });
    this.engine = GameEngine.create({ content: this.content, logger });
    this.facade = createGameFacade(this.engine, { assetSize: (k) => this.content.assetSize(k) });
    this.textures = createTextureStore(bundledTextureEntries(this.content), { logger });
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
  start(): Promise<LoadStatus> {
    this.starting ??= this.doStart();
    return this.starting;
  }

  private async doStart(): Promise<LoadStatus> {
    let opened: { store: SaveStore; status: 'ok' | 'incompatible' } | undefined;
    try {
      opened = await this.openStore();
    } catch (error) {
      this.logger.error('Could not open the save database', { error: String(error) });
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

  flush(): Promise<void> {
    return this.save?.flush() ?? Promise.resolve();
  }

  dispose(): void {
    this.appState?.remove();
    this.save?.detach();
  }
}
