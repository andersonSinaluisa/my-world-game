/**
 * Injected runtime dependencies (GAME_ENGINE §2): clock, randomness and logging are never global,
 * so the engine stays deterministic and testable.
 */

export interface Clock {
  /** Milliseconds since the Unix epoch. */
  now(): number;
}

export interface Random {
  /** Uniform float in [0, 1). */
  next(): number;
}

export interface Logger {
  debug(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

export const systemClock: Clock = { now: () => Date.now() };

/** Timers are injected too, so debounce logic is deterministic in tests (FakeClock implements it). */
export interface Scheduler {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const systemScheduler: Scheduler = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export const mathRandom: Random = { next: () => Math.random() };

export const silentLogger: Logger = {
  debug: () => {},
  warn: () => {},
  error: () => {},
};

/** Deterministic PRNG (mulberry32). Same seed ⇒ same sequence. */
export function createSeededRandom(seed: number): Random {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}
