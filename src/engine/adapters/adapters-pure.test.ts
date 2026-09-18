import { breathPhase, tintMatrix } from './render/tint';
import { dpToWorld, screenToWorld, worldToScreen } from './input/coords';
import { TextureCache } from './render/texture-cache';
import { computeViewport } from './render/viewport';

describe('virtual resolution (HU-GAME-005)', () => {
  it('iPhone landscape 844×390', () => {
    const v = computeViewport(844, 390);
    expect(v.scale).toBeCloseTo(0.3611, 4);
    expect(v.viewportW).toBeCloseTo(2337.2, 1);
  });

  it('tablet 4:3 1024×768', () => {
    const v = computeViewport(1024, 768);
    expect(v.scale).toBeCloseTo(0.7111, 4);
    expect(v.viewportW).toBeCloseTo(1440, 6);
  });

  it('recomputes on layout change (800×360 → 2400 units)', () => {
    expect(computeViewport(800, 360).viewportW).toBeCloseTo(2400, 6);
  });

  it('converts a touch to world coordinates', () => {
    expect(screenToWorld(300, 480, 0.5, 1000)).toEqual({ x: 1600, y: 960 });
    expect(worldToScreen(1600, 960, 0.5, 1000)).toEqual({ x: 300, y: 480 });
    expect(dpToWorld(44, 390 / 1080)).toBeCloseTo(121.8, 1);
  });
});

describe('TextureCache (HU-GAME-008 R5)', () => {
  const MB = 1024 * 1024;
  const info = { w: 1024, h: 256 }; // exactly 1 MB

  it('releases unpinned textures of the previous scene and keeps globals', () => {
    const evicted: string[] = [];
    const cache = new TextureCache<string>(100 * MB, (k) => evicted.push(k));
    cache.setActiveScene('A');
    ['a1', 'a2', 'a3'].forEach((k) => cache.set(k, k, info, 'A'));
    ['g1', 'g2'].forEach((k) => cache.set(k, k, info, 'global'));
    cache.setActiveScene('B');
    expect(evicted.sort()).toEqual(['a1', 'a2', 'a3']);
    expect(cache.has('g1') && cache.has('g2')).toBe(true);
    expect(cache.usedBytes).toBe(2 * MB);
  });

  it('evicts least recently used unpinned textures over budget', () => {
    const cache = new TextureCache<string>(2 * MB);
    cache.setActiveScene('A');
    cache.set('old', 'old', info, 'other');
    cache.set('new', 'new', info, 'other');
    cache.get('old'); // touch
    cache.set('third', 'third', info, 'other');
    expect(cache.has('new')).toBe(false);
    expect(cache.has('old') && cache.has('third')).toBe(true);
  });

  it('never evicts pinned textures even over budget', () => {
    const cache = new TextureCache<string>(1 * MB);
    cache.setActiveScene('A');
    cache.set('a', 'a', info, 'A');
    cache.set('b', 'b', info, 'A');
    expect(cache.size).toBe(2);
  });
});

describe('character tint and breathing (HU-GAME-013 R4, HU-GAME-014 R6)', () => {
  it('multiplies RGB by the tone and keeps alpha', () => {
    const m = tintMatrix('#FF8000');
    expect(m[0]).toBe(1);
    expect(m[6]).toBeCloseTo(128 / 255, 5);
    expect(m[12]).toBe(0);
    expect(m[18]).toBe(1);
  });

  it('gives each character a stable, different breathing phase', () => {
    expect(breathPhase('rt_a')).toBe(breathPhase('rt_a'));
    expect(breathPhase('rt_a')).not.toBe(breathPhase('rt_b'));
    expect(breathPhase('rt_a')).toBeGreaterThanOrEqual(0);
    expect(breathPhase('rt_a')).toBeLessThan(2 * Math.PI);
  });
});
