import { FADE_MS, PRELOAD_TIMEOUT_MS, TransitionDirector, type TransitionDeps } from './transition-director';

function setup(overrides: Partial<TransitionDeps> = {}) {
  const log: string[] = [];
  let t = 0;
  const deps: TransitionDeps = {
    wait: async (ms) => {
      log.push(`wait ${ms}`);
      t += ms;
    },
    flush: async () => void log.push('flush'),
    enter: (r) => (log.push(`enter ${r.sceneId}`), true),
    preload: async () => void log.push('preload'),
    done: () => log.push('done'),
    now: () => t,
    ...overrides,
  };
  const d = new TransitionDirector(deps);
  d.subscribe(() => log.push(`phase ${d.phase}`));
  return { d, log };
}

describe('TransitionDirector (HU-GAME-050)', () => {
  it('runs fade out → flush → enter → preload → fade in → done, in that order', async () => {
    const { d, log } = setup();
    await d.run({ sceneId: 'core:street', spawnId: 'home_door', travelers: ['a'] });
    expect(log).toEqual([
      'phase out',
      `wait ${FADE_MS}`,
      'flush',
      'phase loading',
      'enter core:street',
      'preload',
      `wait ${PRELOAD_TIMEOUT_MS}`,
      'phase in',
      `wait ${FADE_MS}`,
      'phase idle',
      'done',
    ]);
    expect(d.phase).toBe('idle');
  });

  it('a failing flush or enter still unlocks the input', async () => {
    const errors: unknown[] = [];
    const { d, log } = setup({ flush: async () => Promise.reject(new Error('disk')), enter: () => false, onError: (e) => errors.push(e) });
    await d.run({ sceneId: 'x', spawnId: 'default', travelers: [] });
    expect(errors).toHaveLength(1);
    expect(log.at(-1)).toBe('done');
    expect(log).not.toContain('preload');
  });

  it('reports the loading time for the indicator', async () => {
    let resolvePreload: () => void = () => {};
    let now = 0;
    const { d } = setup({
      now: () => now,
      wait: (ms) => (ms === PRELOAD_TIMEOUT_MS ? new Promise(() => {}) : Promise.resolve()),
      preload: () => new Promise<void>((r) => (resolvePreload = r)),
    });
    const running = d.run({ sceneId: 'x', spawnId: 'default', travelers: [] });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(d.phase).toBe('loading');
    now = 700;
    expect(d.loadingMs()).toBe(700);
    resolvePreload();
    await running;
    expect(d.loadingMs()).toBe(0);
  });
});
