import type { EntityInit } from '@/engine/core/entity';
import { GameEngine } from '@/engine/core/engine';
import type { GameEvent } from '@/engine/core/events';
import { createSeededRandom, type Logger, type Random } from '@/engine/core/runtime';
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
  const engine = GameEngine.create({ clock, random, logger, saveStore, dev: options.dev ?? true });
  const events: GameEvent[] = [];
  engine.events.subscribe((batch) => events.push(...batch));
  if (options.scene) engine.activateScene(options.scene, options.entities ?? []);
  return {
    engine,
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
