import { createTestGame, type TestGame } from '@/test/create-test-game';
import { testPack } from '@/test/fixtures/test-content';

import { dpToWorld } from '../adapters/input/coords';
import { computeViewport } from '../adapters/render/viewport';
import type { EntityId } from '../core/types';
import { hitTest, MIN_HIT_DP } from './hit-test';

/** HU-GAME-070 RN-3: every world entity is at least 44 dp per axis, whatever the scale. */

const ROOM = 'test:room';

function small(g: TestGame, id: EntityId, x: number, layer = 'props') {
  const ball = g.content!.prefab('test:ball')!;
  g.world.create({
    id,
    prefabId: ball.qualifiedId,
    tags: ball.tags ?? [],
    location: { kind: 'scene', sceneId: ROOM },
    components: {
      ...ball.components,
      sprite: { ...(ball.components.sprite as object), layer },
      transform: { x, y: 960 },
      hitbox: { shape: { type: 'circle', x: 0, y: 0, r: 20 }, padding: 12 },
    } as never,
  });
}

const hits = (g: TestGame, x: number, y: number, minHitWorld?: number) =>
  hitTest(g.world, { x, y }, { sceneId: ROOM, minHitWorld, hasDirectRules: () => true }).map((h) => h.id);

describe('minimum touch size (HU-GAME-070)', () => {
  it('phone 360 dp high (scale 1/3): a r20 + padding 12 object is hit 60 u from its center', () => {
    const g = createTestGame({ packs: [testPack()], enter: { sceneId: ROOM } });
    small(g, 'rt_small', 5000);
    const min = dpToWorld(MIN_HIT_DP, computeViewport(780, 360).scale);
    expect(min).toBeCloseTo(132, 0);
    expect(hits(g, 5000 + 60, 960)).toEqual([]);
    expect(hits(g, 5000 + 60, 960, min)).toEqual(['rt_small']);
  });

  it('tablet 768 dp high: the enlargement in world units is smaller but still 44 dp', () => {
    const g = createTestGame({ packs: [testPack()], enter: { sceneId: ROOM } });
    small(g, 'rt_small', 5000);
    const scale = computeViewport(1024, 768).scale;
    const min = dpToWorld(MIN_HIT_DP, scale);
    expect(min * scale).toBeCloseTo(MIN_HIT_DP, 6);
    expect(hits(g, 5000 + min / 2 - 1, 960, min)).toEqual(['rt_small']);
    expect(hits(g, 5000 + 60, 960, min)).toEqual([]);
  });

  it('overlapping enlarged areas: the front-most entity wins', () => {
    const g = createTestGame({ packs: [testPack()], enter: { sceneId: ROOM } });
    small(g, 'rt_back', 5000, 'props');
    small(g, 'rt_front', 5080, 'foreground');
    expect(hits(g, 5040, 960, 132)[0]).toBe('rt_front');
  });
});
