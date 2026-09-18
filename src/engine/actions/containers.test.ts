import { createTestGame, type TestGame } from '@/test/create-test-game';
import { prefabData, sceneData, testPack } from '@/test/fixtures/test-content';
import { InMemorySaveStore } from '@/test/in-memory-save-store';

import type { RawPack } from '../content/raw-pack';
import type { EntityId } from '../core/types';
import { SaveService } from '../persistence/save-service';

const ROOM = 'test:room';
const BOX = `${ROOM}/box`;
const BOX_BALL = `${ROOM}/box_ball`;

/** Test pack with the core container rules and a "toy" box (capacity 3) plus a clothing basket. */
function pack(): RawPack {
  const p = testPack();
  p.rules[0].data = [
    { id: 'tap_open', trigger: 'tap', target: { has: ['openable'] }, actions: [{ type: 'toggleOpen' }], priority: 10 },
    {
      id: 'store_in_container',
      trigger: 'drop',
      source: { has: ['draggable'], notTags: ['character', 'furniture'] },
      target: { has: ['container'], zone: 'inside' },
      conditions: [{ type: 'isOpen' }, { type: 'containerHasSpace' }],
      actions: [{ type: 'store' }],
      priority: 70,
      feedback: { rejectHint: 'ui_hint_container_full' },
    },
  ];
  const box = prefabData(p, 'box').components as Record<string, Record<string, unknown>>;
  box.container = { capacity: 3, accepts: ['toy'], slots: [{ x: -60, y: -60 }, { x: 0, y: -60 }, { x: 60, y: -60 }] };
  (box.hitbox.zones as Record<string, unknown>).inside = { type: 'rect', x: -80, y: -110, w: 160, h: 90 };
  p.prefabs.push({
    file: 'prefabs/container/basket.json',
    data: {
      id: 'basket',
      category: 'container',
      tags: ['furniture'],
      components: {
        sprite: { asset: 'test_env_plant', layer: 'furniture' },
        hitbox: { shape: { type: 'rect', x: -60, y: -120, w: 120, h: 120 }, zones: { inside: { type: 'rect', x: -50, y: -110, w: 100, h: 100 } } },
        container: { capacity: 2, accepts: ['clothing'], slots: [{ x: -20, y: -40 }, { x: 20, y: -40 }] },
      },
      metadata: { name: 'object.plant.name' },
    },
  });
  p.prefabs.push({
    file: 'prefabs/clothing/sock.json',
    data: {
      id: 'sock',
      category: 'clothing',
      tags: ['clothing'],
      components: { sprite: { asset: 'test_obj_brush', layer: 'props' }, hitbox: { shape: { type: 'rect', x: -30, y: -60, w: 60, h: 60 } }, draggable: {} },
      metadata: { name: 'object.brush.name' },
    },
  });
  p.prefabs.push({
    file: 'prefabs/container/crate.json',
    data: {
      id: 'crate',
      category: 'container',
      tags: ['toy'],
      components: {
        sprite: { asset: 'test_obj_teddy', layer: 'props' },
        hitbox: { shape: { type: 'rect', x: -45, y: -90, w: 90, h: 90 } },
        draggable: {},
        container: { capacity: 1 },
      },
      metadata: { name: 'object.teddy.name' },
    },
  });
  const room = sceneData(p, 'room');
  room.entities.push({ localId: 'basket', prefabId: 'basket', transform: { x: 1500, y: 960 } });
  return p;
}

function game(p = pack(), store?: InMemorySaveStore) {
  return createTestGame({ packs: [p], enter: { sceneId: ROOM }, saveStore: store });
}

function spawn(g: TestGame, id: EntityId, prefab: string, x: number) {
  const p = g.content!.prefab(prefab)!;
  g.world.create({ id, prefabId: p.qualifiedId, tags: p.tags ?? [], location: { kind: 'scene', sceneId: ROOM }, components: { ...p.components, transform: { x, y: 960 } } });
}

function drop(g: TestGame, id: EntityId, x: number, y: number) {
  const t = g.engine.absoluteTransform(id)!;
  expect(g.dispatch({ type: 'dragStart', entityId: id, worldPoint: { x: t.x, y: t.y - 10 } })).toEqual({ ok: true });
  return g.dispatch({ type: 'dragEnd', entityId: id, worldPoint: { x, y } });
}

const tap = (g: TestGame, x: number, y: number) => g.dispatch({ type: 'pointerTap', worldPoint: { x, y } });
const openBox = (g: TestGame) => tap(g, 2000, 820);
const state = (g: TestGame, id: EntityId) => g.world.get(id)?.components.states?.current;
const lastRejected = (g: TestGame) => [...g.events].reverse().find((e) => e.type === 'interactionRejected');

describe('open and close (HU-GAME-034)', () => {
  it('tap toggles the container and its sprite', () => {
    const g = game();
    openBox(g);
    expect(state(g, BOX)).toBe('open');
    expect(g.events.some((e) => e.type === 'interactionPerformed' && e.ruleId === 'test:tap_open')).toBe(true);
    openBox(g);
    expect(state(g, BOX)).toBe('closed');
  });

  it('closed contents are neither drawn nor touchable; a tap there opens the container', () => {
    const g = game();
    expect(g.engine.absoluteTransform(BOX_BALL)).toBeUndefined();
    expect(g.engine.visibleContents()).toEqual([]);
    tap(g, 1940, 880); // where slot 0 would be
    expect(state(g, BOX)).toBe('open');
    expect(g.engine.visibleContents().map((e) => e.id)).toEqual([BOX_BALL]);
    expect(g.engine.absoluteTransform(BOX_BALL)).toMatchObject({ x: 1940, y: 900 });
  });

  it('the open state persists across scenes', () => {
    const store = new InMemorySaveStore();
    const g = game(pack(), store);
    new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    openBox(g);
    g.dispatch({ type: 'enterScene', sceneId: 'test:hall', spawnId: 'default' });
    g.dispatch({ type: 'enterScene', sceneId: ROOM, spawnId: 'default' });
    expect(state(g, BOX)).toBe('open');
  });
});

describe('store (HU-GAME-035)', () => {
  it('a toy dropped inside the open box goes to the first free slot', () => {
    const g = game();
    openBox(g);
    spawn(g, 'rt_ball', 'test:ball', 600);
    drop(g, 'rt_ball', 2000, 880);
    expect(g.world.get('rt_ball')?.location).toEqual({ kind: 'container', containerId: BOX, slot: 1 });
    expect(g.engine.absoluteTransform('rt_ball')).toMatchObject({ x: 2000, y: 900 });
  });

  it('a closed container does not store: the item is placed', () => {
    const g = game();
    spawn(g, 'rt_ball', 'test:ball', 600);
    drop(g, 'rt_ball', 2000, 880);
    expect(g.world.get('rt_ball')?.location).toEqual({ kind: 'scene', sceneId: ROOM });
  });

  it('full container: containerFull, shake, hint and place', () => {
    const g = game();
    openBox(g);
    for (const [i, id] of ['rt_1', 'rt_2', 'rt_3'].entries()) {
      spawn(g, id, 'test:ball', 300 + i * 100);
    }
    drop(g, 'rt_1', 2000, 880);
    drop(g, 'rt_2', 2000, 880);
    drop(g, 'rt_3', 2000, 880);
    expect(lastRejected(g)).toMatchObject({ ruleId: 'test:store_in_container', reason: 'containerFull', targetId: BOX });
    expect(g.world.get('rt_3')?.location.kind).toBe('scene');
    expect(g.events.some((e) => e.type === 'visualEffect' && e.entityId === BOX && e.preset === 'shake')).toBe(true);
  });

  it('a tag not accepted is rejected with notAccepted', () => {
    const g = game();
    openBox(g);
    spawn(g, 'rt_sock', 'test:sock', 600);
    drop(g, 'rt_sock', 2000, 880);
    expect(lastRejected(g)).toMatchObject({ reason: 'notAccepted' });
    expect(g.world.get('rt_sock')?.location.kind).toBe('scene');
  });

  it('a container without openable is always open', () => {
    const g = game();
    spawn(g, 'rt_sock', 'test:sock', 600);
    drop(g, 'rt_sock', 1500, 900);
    expect(g.world.get('rt_sock')?.location).toEqual({ kind: 'container', containerId: `${ROOM}/basket`, slot: 0 });
  });

  it('a container never goes into another container', () => {
    const g = game();
    openBox(g);
    spawn(g, 'rt_crate', 'test:crate', 600);
    drop(g, 'rt_crate', 2000, 880);
    expect(g.world.get('rt_crate')?.location.kind).toBe('scene');
  });

  it('the content persists with its slot', async () => {
    const store = new InMemorySaveStore();
    const g = game(pack(), store);
    const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    openBox(g);
    spawn(g, 'rt_ball', 'test:ball', 600);
    drop(g, 'rt_ball', 2000, 880);
    await save.flush();
    const g2 = createTestGame({ packs: [pack()], saveStore: store });
    const save2 = new SaveService(g2.engine, store, { scheduler: g2.clock }).attach();
    await save2.load();
    expect(g2.world.get('rt_ball')?.location).toEqual({ kind: 'container', containerId: BOX, slot: 1 });
    expect(g2.world.get(BOX)?.components.states?.current).toBe('open');
  });
});

describe('take out (HU-GAME-036)', () => {
  it('dragging a visible item takes it out and frees its slot', () => {
    const g = game();
    openBox(g);
    expect(g.engine.pickDraggable({ x: 1940, y: 870 })).toBe(BOX_BALL);
    drop(g, BOX_BALL, 700, 900);
    expect(g.world.get(BOX_BALL)?.location).toEqual({ kind: 'scene', sceneId: ROOM });
    expect(g.world.index.inContainer(BOX).filter(Boolean)).toEqual([]);
  });

  it('the content of a closed container cannot be dragged', () => {
    const g = game();
    expect(g.dispatch({ type: 'dragStart', entityId: BOX_BALL, worldPoint: { x: 1940, y: 870 } })).toEqual({ ok: false, reason: 'notDraggable' });
    expect(g.world.get(BOX_BALL)?.location.kind).toBe('container');
  });

  it('an interrupted drag puts it back in the same slot', () => {
    const g = game();
    openBox(g);
    g.dispatch({ type: 'dragStart', entityId: BOX_BALL, worldPoint: { x: 1940, y: 870 } });
    expect(g.world.get(BOX_BALL)?.location.kind).toBe('scene');
    g.dispatch({ type: 'dragCancel', entityId: BOX_BALL });
    expect(g.world.get(BOX_BALL)?.location).toEqual({ kind: 'container', containerId: BOX, slot: 0 });
  });

  it('dropped back into the same container it takes the first free slot', () => {
    const g = game();
    openBox(g);
    drop(g, BOX_BALL, 2000, 880);
    expect(g.world.get(BOX_BALL)?.location).toEqual({ kind: 'container', containerId: BOX, slot: 0 });
  });
});
