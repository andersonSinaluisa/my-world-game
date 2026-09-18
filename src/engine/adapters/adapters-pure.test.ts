import { autoScrollStep, autoScrollVelocity } from './input/auto-scroll';
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

describe('auto-scroll (HU-GAME-029)', () => {
  const W = 844; // zone = 101.28 dp

  it('is 0 at the inner border of the zone, ≈985 at 30 dp from the edge, 1400 at the edge', () => {
    expect(autoScrollVelocity(W - 101.28, W)).toBeCloseTo(0, 6);
    expect(autoScrollVelocity(W - 30, W)).toBeCloseTo(985.3, 0);
    expect(autoScrollVelocity(W, W)).toBe(1400);
    expect(autoScrollVelocity(0, W)).toBe(-1400);
    expect(autoScrollVelocity(W / 2, W)).toBe(0);
  });

  it('never passes the camera bounds: 1 s at 1400 u/s from 5300 stops at 5342', () => {
    const maxX = 7680 - 2338;
    expect(autoScrollStep(5300, 1400, 1000, 0, maxX)).toBe(5342);
  });

  it('is frame-rate independent', () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = autoScrollStep(a, 1400, 1000 / 60, 0, 10000);
    let b = 0;
    for (let i = 0; i < 120; i++) b = autoScrollStep(b, 1400, 1000 / 120, 0, 10000);
    expect(a).toBeCloseTo(1400, 6);
    expect(b).toBeCloseTo(1400, 6);
  });

  it('the drop point uses the final camera: cameraX 2000, scale 0.3611, finger at 700 dp → x ≈ 3938', () => {
    expect(screenToWorld(700, 0, 0.3611, 2000).x).toBeCloseTo(3938.5, 0);
  });
});
