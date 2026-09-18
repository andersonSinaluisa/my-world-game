import type { EntityInit } from '@/engine/core/entity';
import { GameEngine } from '@/engine/core/engine';
import type { GameEvent } from '@/engine/core/events';
import { createSeededRandom, type Logger, type Random } from '@/engine/core/runtime';
import { ContentRegistry } from '@/engine/content/registry';
import type { RawPack } from '@/engine/content/raw-pack';
import type { ActiveSceneInfo } from '@/engine/scene/scene-types';

import { DEFAULT_TEST_SEED, FakeClock } from './fake-clock';
import { InMemorySaveStore } from './in-memory-save-store';

export interface TestLogger extends Logger {
  entries: { level: 'debug' | 'warn' | 'error'; message: string; data?: unknown }[];
}

export function createTestLogger(): TestLogger {
  const entries: TestLogger['entries'] = [];
  return {
    entries,
    debug: (message, data) => entries.push({ level: 'debug', message, data }),
    warn: (message, data) => entries.push({ level: 'warn', message, data }),
    error: (message, data) => entries.push({ level: 'error', message, data }),
  };
}

export interface TestGameOptions {
  /** Scene to activate (provisional until HU-GAME-010 loads scenes from packs). */
  scene?: ActiveSceneInfo;
  entities?: EntityInit[];
  saveStore?: InMemorySaveStore;
  clock?: FakeClock;
  random?: Random;
  seed?: number;
  logger?: TestLogger;
  /** Invariant mode. Defaults to dev (throwing). */
  dev?: boolean;
  /** Content packs to register (e.g. `[testPack()]`). */
  packs?: RawPack[];
  /** Scene to enter from content after creation (requires `packs`). */
  enter?: { sceneId: string; spawnId?: string };
  viewportW?: number;
}

/** Content registry over raw packs with the test pack as core. */
export function loadTestContent(packs: RawPack[], logger: Logger = createTestLogger(), dev = true): ContentRegistry {
  return ContentRegistry.load(packs, { dev, logger, corePack: 'test' });
}

/**
 * Headless test game (HU-GAME-002/003). Deterministic by default: fake clock at 2026-01-01T00:00:00Z
 * and a seeded random. `events` records every published event in order.
 */
export function createTestGame(options: TestGameOptions = {}) {
  const clock = options.clock ?? new FakeClock();
  const random = options.random ?? createSeededRandom(options.seed ?? DEFAULT_TEST_SEED);
  const saveStore = options.saveStore ?? new InMemorySaveStore();
  const logger = options.logger ?? createTestLogger();
  const dev = options.dev ?? true;
  const content = options.packs ? loadTestContent(options.packs, logger, dev) : undefined;
  const engine = GameEngine.create({ clock, scheduler: clock, random, logger, saveStore, content, dev });
  const events: GameEvent[] = [];
  engine.events.subscribe((batch) => events.push(...batch));
  if (options.viewportW) engine.dispatch({ type: 'viewportChanged', viewportW: options.viewportW });
  if (options.scene) engine.activateScene(options.scene, options.entities ?? []);
  if (options.enter) {
    const r = engine.dispatch({ type: 'enterScene', sceneId: options.enter.sceneId, spawnId: options.enter.spawnId ?? 'default' });
    if (!r.ok) throw new Error(`enterScene failed: ${r.reason}`);
  }
  return {
    engine,
    content,
    world: engine.world,
    dispatch: engine.dispatch.bind(engine),
    clock,
    random,
    saveStore,
    logger,
    events,
    advance: (ms: number) => clock.advance(ms),
  };
}

export type TestGame = ReturnType<typeof createTestGame>;
