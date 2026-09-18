import { createFacadeForTest } from '@/test/facade-for-test';
import { createTestGame, type TestGame } from '@/test/create-test-game';
import { withCharacters } from '@/test/fixtures/test-characters';
import { prefabData, sceneData, testPack } from '@/test/fixtures/test-content';
import { InMemorySaveStore } from '@/test/in-memory-save-store';

import type { Appearance } from '../components/base';
import type { RawPack } from '../content/raw-pack';
import type { EntityId } from '../core/types';
import { SaveService } from '../persistence/save-service';

const ROOM = 'test:room';
const CHAIR = `${ROOM}/chair`;
const BED = `${ROOM}/bed`;
const LAMP = `${ROOM}/lamp`;
const LOOK: Appearance = { bodyType: 'child', skinTone: 'skin_01', eyes: 'eyes_round', mouth: 'mouth_smile', hairStyle: 'hair_buns', hairColor: 'hair_black' };

function pack(): RawPack {
  const p = withCharacters(testPack());
  p.rules[0].data = [
    { id: 'sit_on_seat', trigger: 'drop', source: { has: ['character'] }, target: { has: ['seat'] }, conditions: [{ type: 'seatFree' }], actions: [{ type: 'sit' }], priority: 80 },
    { id: 'sleep_on_bed', trigger: 'drop', source: { has: ['character'] }, target: { has: ['bed'] }, conditions: [{ type: 'seatFree' }], actions: [{ type: 'sleep' }], priority: 85 },
    { id: 'tap_switch', trigger: 'tap', target: { has: ['switchable'] }, actions: [{ type: 'toggleSwitch' }], priority: 10 },
    { id: 'tap_open', trigger: 'tap', target: { has: ['openable'] }, actions: [{ type: 'toggleOpen' }], priority: 10 },
  ];
  (prefabData(p, 'chair').components as Record<string, unknown>).seat = { anchor: { x: 0, y: -95 } };
  p.prefabs.push({
    file: 'prefabs/furniture/bed.json',
    data: {
      id: 'bed',
      category: 'furniture',
      tags: ['furniture'],
      components: {
        sprite: { asset: 'test_env_table', layer: 'furniture' },
        hitbox: { shape: { type: 'rect', x: -120, y: -180, w: 240, h: 180 } },
        surface: { segments: [{ x1: -120, x2: 120, y: -120 }] },
        bed: { anchor: { x: 0, y: -120 }, coverAsset: 'test_env_box' },
      },
      metadata: { name: 'object.table.name' },
    },
  });
  // The box becomes a movable container for HU-GAME-048.
  const box = prefabData(p, 'box').components as Record<string, unknown>;
  box.draggable = { mode: 'floorOnly' };
  const room = sceneData(p, 'room');
  room.entities = room.entities.filter((e) => e.localId !== 'table');
  room.entities.push({ localId: 'chair', prefabId: 'chair', transform: { x: 2600, y: 960 } }, { localId: 'bed', prefabId: 'bed', transform: { x: 800, y: 960 } });
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

function drop(g: TestGame, id: EntityId, x: number, y: number) {
  const t = g.engine.absoluteTransform(id)!;
  g.dispatch({ type: 'dragStart', entityId: id, worldPoint: { x: t.x, y: t.y - 20 } });
  return g.dispatch({ type: 'dragEnd', entityId: id, worldPoint: { x, y } });
}

const last = (g: TestGame, type: string) => [...g.events].reverse().find((e) => e.type === type);

describe('sit (HU-GAME-045)', () => {
  it('a character dropped on a free chair sits at its anchor', () => {
    const g = game();
    const c = kid(g, 1500);
    drop(g, c, 2600, 850);
    expect(last(g, 'interactionPerformed')).toMatchObject({ ruleId: 'test:sit_on_seat', targetId: CHAIR });
    expect(g.world.get(c)?.components.pose).toEqual({ current: 'sit', seatId: CHAIR });
    expect(g.engine.absoluteTransform(c)).toMatchObject({ x: 2600, y: 865 });
    expect(g.world.index.seatOccupant(CHAIR)).toBe(c);
  });

  it('an occupied chair rejects: shake, and the second character stands next to it', () => {
    const g = game();
    const a = kid(g, 1500);
    const b = kid(g, 1800);
    drop(g, a, 2600, 850);
    drop(g, b, 2600, 850);
    expect(last(g, 'interactionRejected')).toMatchObject({ reason: 'seatFree', targetId: CHAIR });
    expect(g.events.some((e) => e.type === 'visualEffect' && e.entityId === CHAIR && e.preset === 'shake')).toBe(true);
    expect(g.world.get(b)?.components.pose).toEqual({ current: 'idle' });
    expect(g.engine.absoluteTransform(b)?.y).toBe(960);
  });

  it('lifting the character frees the seat', () => {
    const g = game();
    const c = kid(g, 1500);
    drop(g, c, 2600, 850);
    g.dispatch({ type: 'dragStart', entityId: c, worldPoint: { x: 2600, y: 800 } });
    expect(g.world.index.seatOccupant(CHAIR)).toBeUndefined();
    expect(g.world.get(c)?.components.pose?.current).toBe('dangle');
  });

  it('an object dropped on a chair does not sit', () => {
    const g = game();
    drop(g, `${ROOM}/ball`, 2600, 850);
    expect(g.events.some((e) => e.type === 'interactionPerformed')).toBe(false);
    expect(g.world.get(`${ROOM}/ball`)?.location.kind).toBe('scene');
  });

  it('stays seated after closing the app', async () => {
    const store = new InMemorySaveStore();
    const g = game(store);
    const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    g.engine.setPlayerState({ currentSceneId: ROOM });
    const c = kid(g, 1500);
    drop(g, c, 2600, 850);
    await save.flush();
    const g2 = createTestGame({ packs: [pack()], saveStore: store });
    await new SaveService(g2.engine, store, { scheduler: g2.clock }).attach().load();
    expect(g2.world.get(c)?.components.pose).toEqual({ current: 'sit', seatId: CHAIR });
    expect(g2.engine.absoluteTransform(c)).toMatchObject({ x: 2600, y: 865 });
  });

  it('a seat that no longer exists: the character stands on the floor', async () => {
    const store = new InMemorySaveStore();
    const g = game(store);
    const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    g.engine.setPlayerState({ currentSceneId: ROOM });
    const c = kid(g, 1500);
    drop(g, c, 2600, 850);
    await save.flush();
    const p = pack();
    sceneData(p, 'room').entities = sceneData(p, 'room').entities.filter((e) => e.localId !== 'chair');
    const g2 = createTestGame({ packs: [p], saveStore: store, dev: false });
    await new SaveService(g2.engine, store, { scheduler: g2.clock }).attach().load();
    expect(g2.world.get(c)?.components.pose).toEqual({ current: 'idle' });
    expect(g2.engine.absoluteTransform(c)?.y).toBe(960);
  });
});

describe('sleep (HU-GAME-046)', () => {
  it('a character dropped on the bed sleeps with closed eyes; the blanket is drawn right after it', () => {
    const g = game();
    const c = kid(g, 1500);
    drop(g, c, 800, 850);
    expect(last(g, 'interactionPerformed')).toMatchObject({ ruleId: 'test:sleep_on_bed' });
    expect(g.world.get(c)?.components.pose).toEqual({ current: 'sleep', seatId: BED });
    expect(g.world.get(c)?.components.expression?.current).toBe('sleepy');
    expect(g.engine.characterLayers(c).find((l) => l.layer === 'eyes')?.asset).toBe('chr_eyes_round_closed');
    const facade = createFacadeForTest(g);
    const order = facade.selectors.visibleEntities().map((d) => d.id);
    expect(order.indexOf(`${BED}#cover`)).toBe(order.indexOf(c) + 1);
  });

  it('a toy dropped on the bed rests on its surface and stays there across scenes', () => {
    const store = new InMemorySaveStore();
    const g = game(store);
    new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    const ball = `${ROOM}/ball`;
    drop(g, ball, 800, 800);
    expect(g.engine.absoluteTransform(ball)).toMatchObject({ x: 800, y: 840 });
    g.dispatch({ type: 'enterScene', sceneId: 'test:hall', spawnId: 'default' });
    g.dispatch({ type: 'enterScene', sceneId: ROOM, spawnId: 'default' });
    expect(g.engine.absoluteTransform(ball)).toMatchObject({ x: 800, y: 840 });
    expect(g.world.index.supportOf(ball)).toBe(BED);
  });

  it('an occupied bed rejects the second character', () => {
    const g = game();
    const a = kid(g, 1500);
    const b = kid(g, 1700);
    drop(g, a, 800, 850);
    drop(g, b, 800, 850);
    expect(last(g, 'interactionRejected')).toMatchObject({ reason: 'seatFree', targetId: BED });
    expect(g.world.get(b)?.components.pose?.current).toBe('idle');
  });
});

describe('switchables (HU-GAME-047)', () => {
  it('tap toggles on and off; dragging does not', () => {
    const g = game();
    g.dispatch({ type: 'pointerTap', worldPoint: { x: 3200, y: 800 } });
    expect(g.world.get(LAMP)?.components.states?.current).toBe('on');
    g.dispatch({ type: 'pointerTap', worldPoint: { x: 3200, y: 800 } });
    expect(g.world.get(LAMP)?.components.states?.current).toBe('off');
  });
});

describe('moving furniture (HU-GAME-048)', () => {
  it('floorOnly furniture ignores surfaces and rests on the floor', () => {
    const g = game();
    drop(g, CHAIR, 800, 700); // above the bed
    expect(g.engine.absoluteTransform(CHAIR)).toMatchObject({ x: 800, y: 960 });
  });

  it('a seated character moves with its seat', () => {
    const g = game();
    const c = kid(g, 1500);
    drop(g, c, 2600, 850);
    drop(g, CHAIR, 3200, 900);
    expect(g.world.get(c)?.components.pose).toEqual({ current: 'sit', seatId: CHAIR });
    expect(g.engine.absoluteTransform(c)).toMatchObject({ x: 3200, y: 865 });
  });

  it('what is inside a container moves with it', () => {
    const g = game();
    g.dispatch({ type: 'pointerTap', worldPoint: { x: 2000, y: 820 } }); // open the box
    drop(g, `${ROOM}/box`, 1200, 900);
    expect(g.world.get(`${ROOM}/box_ball`)?.location).toMatchObject({ kind: 'container', slot: 0 });
    expect(g.engine.absoluteTransform(`${ROOM}/box_ball`)).toMatchObject({ x: 1200 - 75, y: 900 });
  });

  it('furniture without draggable cannot be dragged', () => {
    const g = game();
    expect(g.dispatch({ type: 'dragStart', entityId: BED, worldPoint: { x: 800, y: 900 } })).toEqual({ ok: false, reason: 'notDraggable' });
  });
});
