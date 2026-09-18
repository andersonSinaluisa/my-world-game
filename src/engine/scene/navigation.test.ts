import { createTestGame, type TestGame } from '@/test/create-test-game';
import { withCharacters } from '@/test/fixtures/test-characters';
import { prefabData, sceneData, testPack } from '@/test/fixtures/test-content';
import { InMemorySaveStore } from '@/test/in-memory-save-store';

import type { Appearance } from '../components/base';
import type { RawPack } from '../content/raw-pack';
import { freeSpot } from '../core/engine';
import type { EntityId } from '../core/types';
import { validatePacks } from '../content/validate-pack';
import { SaveService } from '../persistence/save-service';

/** HU-GAME-049 (portals) and HU-GAME-050 (transition lock). */

const ROOM = 'test:room';
const HALL = 'test:hall';
const BALL = `${ROOM}/ball`;
const LOOK: Appearance = { bodyType: 'child', skinTone: 'skin_01', eyes: 'eyes_round', mouth: 'mouth_smile', hairStyle: 'hair_buns', hairColor: 'hair_black' };

const door = (x: number, targetSceneId: string, targetSpawnId: string) => ({
  localId: 'door',
  inline: {
    components: {
      sprite: { asset: 'test_env_box', layer: 'furniture' },
      hitbox: { shape: { type: 'rect', x: -80, y: -300, w: 160, h: 300 } },
      portal: { targetSceneId, targetSpawnId },
    },
    tags: ['door'],
  },
  transform: { x, y: 960 },
});

function pack(): RawPack {
  const p = withCharacters(testPack());
  p.rules[0].data = [
    { id: 'travel_portal', trigger: 'drop', source: { has: ['character'] }, target: { has: ['portal'] }, actions: [{ type: 'teleport' }], priority: 95 },
    { id: 'sit_on_seat', trigger: 'drop', source: { has: ['character'] }, target: { has: ['seat'] }, conditions: [{ type: 'seatFree' }], actions: [{ type: 'sit' }], priority: 80 },
  ];
  (prefabData(p, 'chair').components as Record<string, unknown>).seat = { anchor: { x: 0, y: -95 } };
  sceneData(p, 'room').entities.push(door(3600, HALL, 'door'));
  sceneData(p, 'hall').entities.push(door(200, ROOM, 'door'));
  return p;
}

function game(store?: InMemorySaveStore) {
  return createTestGame({ packs: [pack()], enter: { sceneId: ROOM }, saveStore: store });
}

function kid(g: TestGame, x: number): EntityId {
  const r = g.dispatch({ type: 'createCharacter', appearance: LOOK, outfit: {} });
  const id = r.ok ? r.entityId! : '';
  g.world.update(id, { transform: { x, y: 960 } });
  return id;
}

function dropOn(g: TestGame, id: EntityId, x: number, y = 800) {
  const t = g.world.get(id)!.components.transform!;
  expect(g.dispatch({ type: 'dragStart', entityId: id, worldPoint: { x: t.x, y: t.y - 100 } }).ok).toBe(true);
  return g.dispatch({ type: 'dragEnd', entityId: id, worldPoint: { x, y } });
}

describe('portals (HU-GAME-049)', () => {
  it('a character dropped on a door arrives at the target spawn; the player follows', () => {
    const g = game();
    const a = kid(g, 3000);
    dropOn(g, a, 3600);
    expect(g.world.get(a)?.location).toEqual({ kind: 'scene', sceneId: HALL });
    expect(g.world.get(a)?.components.transform).toMatchObject({ x: 500, y: 960 });
    expect(g.engine.scene?.id).toBe(HALL);
    expect(g.engine.playerState.currentSceneId).toBe(HALL);
    expect(g.events.some((e) => e.type === 'interactionPerformed' && e.ruleId === 'test:travel_portal')).toBe(true);
  });

  it('what it holds travels with it and is gone from the old scene', () => {
    const g = game();
    const a = kid(g, 3000);
    g.engine.locations.move(BALL, { kind: 'held', holderId: a, hand: 'right' });
    dropOn(g, a, 3600);
    expect(g.world.get(BALL)?.location).toEqual({ kind: 'held', holderId: a, hand: 'right' });
    expect(g.world.query({ sceneId: ROOM })).toEqual([]);
  });

  it('a ball dropped on the door is placed, nobody travels', () => {
    const g = game();
    dropOn(g, BALL, 3600, 900);
    expect(g.engine.scene?.id).toBe(ROOM);
    expect(g.world.get(BALL)?.location).toEqual({ kind: 'scene', sceneId: ROOM });
  });

  it('a tap on the door does not travel', () => {
    const g = game();
    g.dispatch({ type: 'pointerTap', worldPoint: { x: 3600, y: 800 } });
    expect(g.engine.scene?.id).toBe(ROOM);
  });

  it('the other characters stay where they were', () => {
    const g = game();
    const a = kid(g, 3000);
    const b = kid(g, 1500);
    dropOn(g, a, 3600);
    expect(g.world.get(b)?.location).toEqual({ kind: 'scene', sceneId: ROOM });
    dropOn(g, a, 200);
    expect(g.engine.scene?.id).toBe(ROOM);
    expect(g.world.get(b)?.components.transform).toMatchObject({ x: 1500, y: 960 });
    expect(g.world.get(a)?.components.transform?.x).toBe(500);
  });

  it('an occupied spawn pushes the traveler 120 units away', () => {
    const g = game();
    const a = kid(g, 3000);
    kid(g, 500); // B stands exactly on the room door spawn
    dropOn(g, a, 3600);
    dropOn(g, a, 200); // back to the room door spawn (500)
    expect(g.world.get(a)?.components.transform?.x).toBe(620);
    expect(freeSpot(1900, [1900], 1920)).toBe(1780);
  });

  it('an unpaid product in the hand rejects the travel (RN-10)', () => {
    const g = game();
    const a = kid(g, 3000);
    g.world.update(BALL, { purchasable: { price: 3, purchased: false } });
    g.engine.locations.move(BALL, { kind: 'held', holderId: a, hand: 'right' });
    dropOn(g, a, 3600);
    expect(g.engine.scene?.id).toBe(ROOM);
    expect(g.events.some((e) => e.type === 'interactionRejected' && e.reason === 'notPurchased')).toBe(true);
  });

  it('a seated character travels standing', () => {
    const g = game();
    const a = kid(g, 3000);
    dropOn(g, a, 2600, 900); // no chair in the room: stays standing, then travels
    dropOn(g, a, 3600);
    dropOn(g, a, 900, 900); // sits on the hall chair
    expect(g.world.get(a)?.components.pose?.current).toBe('sit');
    dropOn(g, a, 200);
    expect(g.world.get(a)?.components.pose).toEqual({ current: 'idle' });
  });

  it('the scene of each character and currentSceneId survive a restart', async () => {
    const store = new InMemorySaveStore();
    const g = game(store);
    const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    save.startNewGame();
    const a = kid(g, 3000);
    const b = kid(g, 1000);
    dropOn(g, a, 3600);
    await save.flush();
    const g2 = createTestGame({ packs: [pack()], saveStore: store });
    const r = await new SaveService(g2.engine, store, { scheduler: g2.clock }).attach().load();
    expect(r).toEqual({ status: 'loaded' });
    expect(g2.engine.scene?.id).toBe(HALL);
    expect(g2.world.get(a)?.location).toEqual({ kind: 'scene', sceneId: HALL });
    expect(g2.world.get(b)?.location).toEqual({ kind: 'scene', sceneId: ROOM });
  });
});

describe('transition (HU-GAME-050)', () => {
  it('with a travel handler: transitionStarted, input locked, enterScene, then transitionDone unlocks', () => {
    const g = game();
    const requests: unknown[] = [];
    g.engine.travelHandler = (r) => requests.push(r);
    const a = kid(g, 3000);
    dropOn(g, a, 3600);
    expect(g.engine.scene?.id).toBe(ROOM);
    expect(requests).toEqual([{ sceneId: HALL, spawnId: 'door', travelers: [a] }]);
    expect(g.events.some((e) => e.type === 'transitionStarted' && e.to === HALL)).toBe(true);
    expect(g.engine.isTransitioning).toBe(true);
    expect(g.dispatch({ type: 'pointerTap', worldPoint: { x: 1000, y: 920 } })).toEqual({ ok: false, reason: 'transitioning' });
    expect(g.dispatch({ type: 'dragStart', entityId: BALL, worldPoint: { x: 1000, y: 920 } })).toEqual({ ok: false, reason: 'transitioning' });
    expect(g.dispatch({ type: 'travelTo', sceneId: ROOM, spawnId: 'default' })).toEqual({ ok: false, reason: 'transitioning' });
    expect(g.dispatch({ type: 'enterScene', sceneId: HALL, spawnId: 'door', travelers: [a] })).toEqual({ ok: true });
    expect(g.engine.scene?.id).toBe(HALL);
    g.dispatch({ type: 'transitionDone' });
    expect(g.engine.isTransitioning).toBe(false);
  });

  it('dirty state is written before the old scene unloads', async () => {
    const store = new InMemorySaveStore();
    const g = game(store);
    const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    save.startNewGame();
    await save.flush();
    g.world.update(BALL, { transform: { x: 1234, y: 960 } });
    g.dispatch({ type: 'travelTo', sceneId: HALL, spawnId: 'default' });
    await save.flush();
    const row = (await store.loadEntities('main')).find((e) => e.id === BALL);
    expect(row?.components.transform).toMatchObject({ x: 1234 });
  });

  it('map travel moves nobody; an unknown scene is refused', () => {
    const g = game();
    const a = kid(g, 3000);
    expect(g.dispatch({ type: 'travelTo', sceneId: HALL, spawnId: 'default' })).toEqual({ ok: true });
    expect(g.engine.scene?.id).toBe(HALL);
    expect(g.world.get(a)?.location).toEqual({ kind: 'scene', sceneId: ROOM });
    expect(g.dispatch({ type: 'travelTo', sceneId: 'test:nowhere', spawnId: 'default' })).toEqual({ ok: false, reason: 'unknownScene' });
  });
});

describe('portal and map validation (HU-GAME-049/051)', () => {
  const codes = (p: RawPack) => validatePacks([p]).issues.map((i) => i.code);

  it('the doors of the fixture are valid', () => {
    expect(codes(pack()).filter((c) => c === 'unknownScene' || c === 'unknownSpawn')).toEqual([]);
  });

  it('a door to a missing scene or spawn is an error', () => {
    const p = pack();
    sceneData(p, 'room').entities.push({ ...door(3000, 'test:nowhere', 'default'), localId: 'door2' });
    sceneData(p, 'hall').entities.push({ ...door(1000, ROOM, 'attic'), localId: 'door2' });
    expect(codes(p)).toEqual(expect.arrayContaining(['unknownScene', 'unknownSpawn']));
  });

  it('a map location must point to an existing scene and spawn', () => {
    const p = pack();
    (p.manifest.data as { provides: Record<string, unknown> }).provides.locations = [{ id: 'room', name: 'scene.room.name', icon: 'test_obj_ball', entrySceneId: 'room', entrySpawnId: 'nope' }];
    expect(codes(p)).toContain('unknownSpawn');
  });
});
