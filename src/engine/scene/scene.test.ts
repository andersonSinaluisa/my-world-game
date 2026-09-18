import { entity } from '@/test/builders';
import { createTestGame } from '@/test/create-test-game';
import { TEST_ASSET_SIZES } from '@/test/fixtures/test-pack';

import type { EntityInit } from '../core/entity';
import { cameraTargetFor, clampCameraX } from './camera-math';
import { cullEntities, cullingRange, CullingTracker, spriteAabb, visibleChunks } from './culling';
import { isRenderable, sortForRender } from './render-order';

function build(inits: EntityInit[]) {
  const { world } = createTestGame();
  inits.forEach((i) => world.create(i));
  return world;
}

const sprite = (layer: string, extra: Record<string, unknown> = {}) => ({ asset: 'test_obj_ball', layer, ...extra });

describe('render order (HU-GAME-006)', () => {
  it('draws layers in semantic order', () => {
    const w = build([
      entity('prop', { components: { sprite: sprite('props') } }),
      entity('furn', { components: { sprite: sprite('furniture') } }),
    ]);
    expect(sortForRender(w.all()).map((e) => e.id)).toEqual(['furn', 'prop']);
  });

  it('furniture: equal z → lower y first', () => {
    const w = build([
      entity('B', { at: { x: 0, y: 960 }, components: { sprite: sprite('furniture') } }),
      entity('A', { at: { x: 0, y: 900 }, components: { sprite: sprite('furniture') } }),
    ]);
    expect(sortForRender(w.all()).map((e) => e.id)).toEqual(['A', 'B']);
  });

  it('furniture: z has priority over y', () => {
    const w = build([
      entity('A', { at: { x: 0, y: 960 }, components: { sprite: sprite('furniture', { z: 5 }) } }),
      entity('B', { at: { x: 0, y: 900 }, components: { sprite: sprite('furniture', { z: 1 }) } }),
    ]);
    expect(sortForRender(w.all()).map((e) => e.id)).toEqual(['B', 'A']);
  });

  it('wallDecor: equal z → lower x first', () => {
    const w = build([
      entity('A', { at: { x: 1200, y: 300 }, components: { sprite: sprite('wallDecor') } }),
      entity('B', { at: { x: 800, y: 300 }, components: { sprite: sprite('wallDecor') } }),
    ]);
    expect(sortForRender(w.all()).map((e) => e.id)).toEqual(['B', 'A']);
  });

  it('props with the same y fall back to a stable id order', () => {
    const w = build([
      entity('p2', { components: { sprite: sprite('props') } }),
      entity('p1', { components: { sprite: sprite('props') } }),
    ]);
    expect(sortForRender(w.all()).map((e) => e.id)).toEqual(['p1', 'p2']);
  });

  it('supported props use max(own z, support z + 1) (extension point for HU-GAME-028)', () => {
    const w = build([
      entity('table', { components: { sprite: sprite('furniture', { z: 4 }) } }),
      entity('apple', { at: { x: 0, y: 700 }, components: { sprite: sprite('props') } }),
      entity('pear', { at: { x: 0, y: 700 }, components: { sprite: sprite('props', { z: 2 }) } }),
    ]);
    const order = sortForRender(w.all(), { supportOf: (id) => (id === 'apple' ? 'table' : undefined) });
    expect(order.map((e) => e.id)).toEqual(['table', 'pear', 'apple']);
  });

  it('only scene entities with a sprite are renderable', () => {
    const w = build([
      entity('box'),
      entity('in-scene', { components: { sprite: sprite('props') } }),
      entity('in-box', {
        location: { kind: 'container', containerId: 'box', slot: 0 },
        components: { sprite: sprite('props') },
      }),
    ]);
    expect(w.all().filter((e) => isRenderable(e, 'test:room')).map((e) => e.id)).toEqual(['in-scene']);
  });
});

describe('camera (HU-GAME-007)', () => {
  const room = { minX: 0, maxX: 3840 };
  it('clamps on the right', () => expect(clampCameraX(3000, room, 2338)).toBe(1502));
  it('clamps on the left', () => expect(clampCameraX(-200, room, 2338)).toBe(0));
  it('centers a scene narrower than the viewport', () => expect(clampCameraX(500, { minX: 0, maxX: 1200 }, 1440)).toBe(-120));
  it('jumpTo centers the target x', () => expect(cameraTargetFor(2880, { minX: 0, maxX: 7680 }, 2338)).toBe(1711));
});

describe('culling (HU-GAME-008)', () => {
  const sizes = (key: string) => TEST_ASSET_SIZES[key];

  it('keeps entities inside viewport + 25 % margin', () => {
    const range = cullingRange(0, 2338);
    expect(range.x1).toBeCloseTo(-584.5);
    const w = build([
      entity('near', { at: { x: 2850, y: 960 }, components: { sprite: { asset: 'x', layer: 'props', size: { w: 100, h: 100 } } } }),
      entity('far', { at: { x: 3150, y: 960 }, components: { sprite: { asset: 'x', layer: 'props', size: { w: 100, h: 100 } } } }),
    ]);
    expect(cullEntities(w.all(), range, sizes).map((e) => e.id)).toEqual(['near']);
  });

  it('computes the AABB from pivot, size and scale', () => {
    const w = build([
      entity('a', {
        at: { x: 100, y: 960 },
        components: { transform: { x: 100, y: 960, scale: 2 }, sprite: { asset: 'test_obj_ball', layer: 'props' } },
      }),
    ]);
    expect(spriteAabb(w.get('a')!, sizes)).toEqual({ x1: 20, y1: 800, x2: 180, y2: 960 });
  });

  it('includes very wide entities when any part intersects', () => {
    const w = build([
      entity('rug', { at: { x: -500, y: 960 }, components: { sprite: { asset: 'x', layer: 'props', size: { w: 2000, h: 20 } } } }),
    ]);
    expect(cullEntities(w.all(), cullingRange(0, 1440), sizes)).toHaveLength(1);
  });

  it('recomputes only beyond 10 % of the viewport', () => {
    const tracker = new CullingTracker();
    expect(tracker.shouldRecompute(0, 2338)).toBe(true);
    tracker.markComputed(0, 2338);
    expect(tracker.shouldRecompute(200, 2338)).toBe(false);
    expect(tracker.shouldRecompute(250, 2338)).toBe(true);
    expect(tracker.shouldRecompute(0, 2400)).toBe(true);
  });

  it('mounts only visible background chunks', () => {
    const layer = {
      id: 'walls',
      chunks: [0, 1920, 3840, 5760].map((x) => ({ asset: `bg_${x}`, x, width: 1920 })),
    };
    expect(visibleChunks(layer, 0, 2338).map((c) => c.x)).toEqual([0, 1920]);
    expect(visibleChunks({ ...layer, parallax: 0.5 }, 4000, 2338).map((c) => c.x)).toEqual([0, 1920, 3840]);
  });
});
