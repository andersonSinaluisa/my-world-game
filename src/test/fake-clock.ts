import type { Clock, Scheduler } from '@/engine/core/runtime';

export const DEFAULT_TEST_TIME = Date.parse('2026-01-01T00:00:00Z');
export const DEFAULT_TEST_SEED = 20260101;

/** Deterministic clock: time only moves with `advance(ms)`. Never use real timers in tests. */
export class FakeClock implements Clock, Scheduler {
  private current: number;
  private timers: { at: number; fn: () => void; id: number }[] = [];
  private nextId = 1;

  constructor(start: number = DEFAULT_TEST_TIME) {
    this.current = start;
  }

  now(): number {
    return this.current;
  }

  /** Schedules a callback on fake time (used by debounce-style code under test). */
  setTimeout(fn: () => void, ms: number): number {
    const id = this.nextId++;
    this.timers.push({ at: this.current + ms, fn, id });
    return id;
  }

  clearTimeout(id: unknown): void {
    this.timers = this.timers.filter((t) => t.id !== id);
  }

  advance(ms: number): void {
    const target = this.current + ms;
    for (;;) {
      const due = this.timers.filter((t) => t.at <= target).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) break;
      this.timers = this.timers.filter((t) => t !== due);
      this.current = due.at;
      due.fn();
    }
    this.current = target;
  }
}
