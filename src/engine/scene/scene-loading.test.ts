import { createTestGame, createTestLogger, loadTestContent } from '@/test/create-test-game';
import { sceneData, testPack } from '@/test/fixtures/test-content';

import { TRAVELER_SPACING } from '../core/engine';
import type { SavedEntity } from '../persistence/save-store';
import { buildScene } from './scene-builder';

const ROOM = 'test:room';
const room = (local: string) => `${ROOM}/${local}`;

describe('enterScene (HU-GAME-010)', () => {
  it('instantiates the scene with namespaced ids and emits sceneLoaded', () => {
    const game = createTestGame({ packs: [testPack()], enter: { sceneId: ROOM } });
    const ids = game.world.all().map((e) => e.id).sort();
    expect(ids).toEqual([room('ball'), room('box'), room('box_ball'), room('lamp'), room('rug'), room('table')].sort());
    expect(game.engine.scene?.id).toBe(ROOM);
    expect(game.engine.playerState.currentSceneId).toBe(ROOM);
    expect(game.events.filter((e) => e.type === 'sceneLoaded')).toEqual([{ type: 'sceneLoaded', from: undefined, to: ROOM, cameraX: 700 }]); // viewport unknown: spawn x
    // One batch: sceneWillChange first, then every entity, then sceneLoaded.
    expect(game.events[0]).toEqual({ type: 'sceneWillChange', from: undefined, to: ROOM });
  });

  it('merges prefab ⊕ overrides ⊕ transform and unions tags', () => {
    const pack = testPack();
    const box = sceneData(pack, 'room').entities.find((e) => e.localId === 'box')!;
    box.overrides = { states: { current: 'open' }, sprite: { z: 3 } };
    box.tags = ['special', 'furniture'];
    const game = createTestGame({ packs: [pack], enter: { sceneId: ROOM } });
    const e = game.world.get(room('box'))!;
    expect(e.prefabId).toBe('test:box');
    expect(e.tags).toEqual(['furniture', 'special']);
    expect(e.components.states).toEqual({ current: 'open', values: ['closed', 'open', 'painted'] });
    expect(e.components.sprite).toMatchObject({ asset: 'test_env_box', layer: 'furniture', z: 3 });
    expect(e.components.transform).toEqual({ x: 2000, y: 960 });
  });

  it('creates inline entities and container contents', () => {
    const game = createTestGame({ packs: [testPack()], enter: { sceneId: ROOM } });
    expect(game.world.get(room('rug'))).toMatchObject({ prefabId: undefined, tags: ['decor'] });
    expect(game.world.get(room('box_ball'))?.location).toEqual({ kind: 'container', containerId: room('box'), slot: 0 });
  });

  it('centers the camera on the arrival spawn, clamped to the scene', () => {
    const near = createTestGame({ packs: [testPack()], viewportW: 1000, enter: { sceneId: ROOM } });
    expect(near.engine.playerState.cameraX).toBe(200); // 700 − 1000/2
    const wide = createTestGame({ packs: [testPack()], viewportW: 2338, enter: { sceneId: ROOM } });
    expect(wide.engine.playerState.cameraX).toBe(0);
  });

  it('uses camera.startX when the scene declares it', () => {
    const pack = testPack();
    sceneData(pack, 'room').camera = { startX: 1500 };
    const game = createTestGame({ packs: [pack], viewportW: 1000, enter: { sceneId: ROOM } });
    expect(game.engine.playerState.cameraX).toBe(1500);
  });

  it('fails without content or with an unknown scene; unknown spawn falls back to default', () => {
    expect(createTestGame().dispatch({ type: 'enterScene', sceneId: ROOM, spawnId: 'default' })).toEqual({ ok: false, reason: 'noContent' });
    const game = createTestGame({ packs: [testPack()] });
    expect(game.dispatch({ type: 'enterScene', sceneId: 'test:attic', spawnId: 'default' })).toEqual({ ok: false, reason: 'unknownScene' });
    expect(game.dispatch({ type: 'enterScene', sceneId: ROOM, spawnId: 'window', travelers: [] })).toEqual({ ok: true });
    expect(game.logger.entries.some((e) => e.level === 'warn' && e.message.includes('window'))).toBe(true);
  });

  it('unloads the previous scene (with container contents) as unload, not removal', () => {
    const game = createTestGame({ packs: [testPack()], enter: { sceneId: ROOM } });
    const before = game.events.length;
    game.dispatch({ type: 'enterScene', sceneId: 'test:hall', spawnId: 'door' });
    expect(game.world.all().map((e) => e.id)).toEqual(['test:hall/chair']);
    const removed = game.events.slice(before).filter((e) => e.type === 'entityRemoved');
    expect(removed).toHaveLength(6);
    expect(removed.every((e) => e.type === 'entityRemoved' && e.unload)).toBe(true);
    expect(game.events.at(-1)).toMatchObject({ type: 'sceneLoaded', from: ROOM, to: 'test:hall' });
  });

  it('places travelers at the spawn separated by TRAVELER_SPACING', () => {
    const game = createTestGame({ packs: [testPack()], enter: { sceneId: ROOM } });
    const content = game.content!;
    for (const id of ['rt_a', 'rt_b']) {
      game.world.create({
        id,
        prefabId: 'test:teddy',
        tags: ['character'],
        location: { kind: 'scene', sceneId: ROOM },
        components: { ...content.prefab('test:teddy')!.components, transform: { x: 100, y: 960 } },
      });
    }
    game.dispatch({ type: 'enterScene', sceneId: 'test:hall', spawnId: 'door', travelers: ['rt_a', 'rt_b'] });
    expect(game.world.get('rt_a')?.components.transform).toMatchObject({ x: 500, y: 960 });
    expect(game.world.get('rt_b')?.components.transform).toMatchObject({ x: 500 + TRAVELER_SPACING, y: 960 });
    expect(game.world.get('rt_a')?.location).toEqual({ kind: 'scene', sceneId: 'test:hall' });
  });

  it('recomputes support from geometry after loading', () => {
    const pack = testPack();
    sceneData(pack, 'room').entities.push({ localId: 'ball_on_table', prefabId: 'ball', transform: { x: 2600, y: 780 } });
    const game = createTestGame({ packs: [pack], enter: { sceneId: ROOM } });
    expect(game.world.index.supportOf(room('ball_on_table'))).toBe(room('table'));
    expect(game.world.index.supportOf(room('ball'))).toBeUndefined();
  });
});

describe('buildScene with a saved diff (HU-GAME-011 / HU-GAME-053)', () => {
  const logger = createTestLogger();
  const content = loadTestContent([testPack()], logger);

  it('applies saved components, removed ids and runtime entities', () => {
    const saved: SavedEntity[] = [
      { id: room('lamp'), prefabId: 'test:lamp', location: { kind: 'scene', sceneId: ROOM }, components: { states: { current: 'on' } as never } },
      { id: room('ball'), prefabId: 'test:ball', location: { kind: 'scene', sceneId: ROOM }, components: { transform: { x: 1500, y: 960 } } },
      { id: 'rt_apple', prefabId: 'test:teddy', location: { kind: 'scene', sceneId: ROOM }, components: { transform: { x: 50, y: 960 } } },
      { id: 'rt_other', prefabId: 'test:teddy', location: { kind: 'scene', sceneId: 'test:hall' }, components: { transform: { x: 50, y: 960 } } },
    ];
    const built = buildScene(content, ROOM, { dev: true, logger, saved: { entities: saved, removed: new Set([room('rug')]) } })!;
    const byId = new Map(built.entities.map((e) => [e.id, e]));
    expect(byId.has(room('rug'))).toBe(false);
    expect(byId.has('rt_other')).toBe(false);
    expect(byId.get('rt_apple')?.prefabId).toBe('test:teddy');
    expect(byId.get(room('lamp'))?.components.states).toEqual({ current: 'on', values: ['off', 'on'] });
    expect(byId.get(room('ball'))?.components.transform).toEqual({ x: 1500, y: 960 });
    // hitbox comes from content, never from the save
    expect(byId.get(room('ball'))?.components.hitbox).toBeDefined();
  });

  it('falls back to the content state when a saved state no longer exists', () => {
    const saved: SavedEntity[] = [
      { id: room('lamp'), prefabId: 'test:lamp', location: { kind: 'scene', sceneId: ROOM }, components: { states: { current: 'broken' } as never } },
    ];
    const built = buildScene(content, ROOM, { dev: true, logger, saved: { entities: saved, removed: new Set() } })!;
    expect((built.entities.find((e) => e.id === room('lamp'))?.components.states as { current?: string } | undefined)?.current).toBe('off');
    expect(logger.entries.some((e) => e.message.includes('broken'))).toBe(true);
  });

  it('discards saved runtime entities whose prefab disappeared', () => {
    const saved: SavedEntity[] = [
      { id: 'rt_ghost', prefabId: 'test:ghost', location: { kind: 'scene', sceneId: ROOM }, components: { transform: { x: 1, y: 960 } } },
    ];
    const built = buildScene(content, ROOM, { dev: false, logger, saved: { entities: saved, removed: new Set() } })!;
    expect(built.entities.some((e) => e.id === 'rt_ghost')).toBe(false);
  });

  it('keeps container contents only when their container is in the scene, after scene entities', () => {
    const built = buildScene(content, ROOM, { dev: true, logger })!;
    const ids = built.entities.map((e) => e.id);
    expect(ids.indexOf(room('box_ball'))).toBeGreaterThan(ids.indexOf(room('box')));
    const orphan: SavedEntity[] = [
      { id: 'rt_lost', prefabId: 'test:ball', location: { kind: 'container', containerId: 'test:hall/chest', slot: 0 }, components: {} },
    ];
    const again = buildScene(content, ROOM, { dev: true, logger, saved: { entities: orphan, removed: new Set() } })!;
    expect(again.entities.some((e) => e.id === 'rt_lost')).toBe(false);
  });

  it('returns undefined for an unknown scene', () => {
    expect(buildScene(content, 'test:nowhere', { dev: true, logger })).toBeUndefined();
  });
});
