import { createTestGame, type TestGame } from '@/test/create-test-game';
import { testPack } from '@/test/fixtures/test-content';
import { InMemorySaveStore } from '@/test/in-memory-save-store';

import type { RawPack } from '../content/raw-pack';
import type { EntityId } from '../core/types';
import { SaveService } from '../persistence/save-service';

const ROOM = 'test:room';

function pack(): RawPack {
  const p = testPack();
  (p.rules[0].data as unknown[]).push({
    id: 'store_in_backpack',
    trigger: 'drop',
    source: { has: ['draggable'], notTags: ['character', 'furniture'] },
    target: { ui: 'inventory' },
    conditions: [{ type: 'inventoryHasSpace' }, { type: 'isPurchased', value: true, ifMissing: true }],
    actions: [{ type: 'addToInventory' }],
    priority: 100,
  });
  return p;
}

function game(store?: InMemorySaveStore) {
  const g = createTestGame({ packs: [pack()], saveStore: store });
  g.engine.setPlayerState({ inventory: { capacity: 12 } });
  g.dispatch({ type: 'enterScene', sceneId: ROOM, spawnId: 'default' });
  return g;
}

function spawn(g: TestGame, id: EntityId, prefab = 'test:ball', x = 600) {
  const p = g.content!.prefab(prefab)!;
  g.world.create({ id, prefabId: p.qualifiedId, tags: p.tags ?? [], location: { kind: 'scene', sceneId: ROOM }, components: { ...p.components, transform: { x, y: 960 } } });
}

/** Drop on the backpack button: the finger is over the HUD, so uiTarget = inventory. */
function dropOnBackpack(g: TestGame, id: EntityId, at = { x: 2000, y: 880 }) {
  const t = g.engine.absoluteTransform(id)!;
  g.dispatch({ type: 'dragStart', entityId: id, worldPoint: { x: t.x, y: t.y - 10 } });
  return g.dispatch({ type: 'dragEnd', entityId: id, worldPoint: at, uiTarget: 'inventory' });
}

const last = (g: TestGame, type: string) => [...g.events].reverse().find((e) => e.type === type);

describe('store in the backpack (HU-GAME-037)', () => {
  it('goes to the first free slot and leaves the scene', () => {
    const g = game();
    for (const id of ['rt_a', 'rt_b', 'rt_c', 'rt_teddy']) spawn(g, id);
    for (const id of ['rt_a', 'rt_b', 'rt_c']) dropOnBackpack(g, id);
    dropOnBackpack(g, 'rt_teddy');
    expect(g.world.get('rt_teddy')?.location).toEqual({ kind: 'inventory', slot: 3 });
    expect(last(g, 'interactionPerformed')).toMatchObject({ ruleId: 'test:store_in_backpack', uiTarget: 'inventory' });
    expect(g.engine.absoluteTransform('rt_teddy')).toBeUndefined();
  });

  it('full backpack: rejected on the button, the item is placed', () => {
    const g = game();
    for (let i = 0; i < 13; i++) spawn(g, `rt_${i}`, 'test:ball', 100 + i * 50);
    for (let i = 0; i < 12; i++) dropOnBackpack(g, `rt_${i}`);
    dropOnBackpack(g, 'rt_12', { x: 1500, y: 700 });
    expect(last(g, 'interactionRejected')).toMatchObject({ reason: 'inventoryFull', uiTarget: 'inventory' });
    expect(g.world.get('rt_12')?.location.kind).toBe('scene');
    expect(g.engine.absoluteTransform('rt_12')).toMatchObject({ x: 1500, y: 960 });
  });

  it('furniture never matches: plain place without a rejection', () => {
    const g = game();
    const before = g.events.filter((e) => e.type === 'interactionRejected').length;
    dropOnBackpack(g, `${ROOM}/table`, { x: 1000, y: 700 });
    expect(g.world.get(`${ROOM}/table`)?.location.kind).toBe('scene');
    expect(g.events.filter((e) => e.type === 'interactionRejected')).toHaveLength(before);
  });

  it('the button wins over the entity below', () => {
    const g = game();
    spawn(g, 'rt_ball');
    dropOnBackpack(g, 'rt_ball', { x: 2000, y: 880 }); // the box is below the finger
    expect(g.world.get('rt_ball')?.location.kind).toBe('inventory');
  });

  it('an unpurchased product is rejected (notPurchased)', () => {
    const g = game();
    spawn(g, 'rt_ball');
    g.world.update('rt_ball', { purchasable: { price: 5, purchased: false } });
    dropOnBackpack(g, 'rt_ball');
    expect(last(g, 'interactionRejected')).toMatchObject({ reason: 'notPurchased' });
  });

  it('the backpack travels between scenes and survives closing the app', async () => {
    const store = new InMemorySaveStore();
    const g = game(store);
    const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    spawn(g, 'rt_ball');
    dropOnBackpack(g, 'rt_ball');
    g.dispatch({ type: 'enterScene', sceneId: 'test:hall', spawnId: 'default' });
    expect(g.world.get('rt_ball')?.location).toEqual({ kind: 'inventory', slot: 0 });
    await save.flush();
    const g2 = createTestGame({ packs: [pack()], saveStore: store });
    await new SaveService(g2.engine, store, { scheduler: g2.clock }).attach().load();
    expect(g2.world.get('rt_ball')?.location).toEqual({ kind: 'inventory', slot: 0 });
    expect(g2.engine.inventorySlots()[0]).toBe('rt_ball');
  });
});

describe('take from the backpack (HU-GAME-038)', () => {
  it('takeFromInventory puts the item in the scene at the finger and starts its drag', () => {
    const g = game();
    spawn(g, 'rt_ball');
    dropOnBackpack(g, 'rt_ball');
    const r = g.dispatch({ type: 'takeFromInventory', slot: 0, worldPoint: { x: 900, y: 800 } });
    expect(r).toEqual({ ok: true, startDrag: 'rt_ball', entityId: 'rt_ball' });
    expect(g.engine.draggingId).toBe('rt_ball');
    g.dispatch({ type: 'dragEnd', entityId: 'rt_ball', worldPoint: { x: 900, y: 800 } });
    expect(g.world.get('rt_ball')?.location).toEqual({ kind: 'scene', sceneId: ROOM });
    expect(g.engine.absoluteTransform('rt_ball')).toMatchObject({ x: 900, y: 960 });
    expect(g.engine.inventorySlots()[0]).toBeNull();
  });

  it('an interrupted drag returns the item to its slot', () => {
    const g = game();
    for (const id of ['rt_a', 'rt_b', 'rt_c', 'rt_d', 'rt_e']) spawn(g, id);
    for (const id of ['rt_a', 'rt_b', 'rt_c', 'rt_d', 'rt_e']) dropOnBackpack(g, id);
    g.dispatch({ type: 'takeFromInventory', slot: 4, worldPoint: { x: 900, y: 800 } });
    g.dispatch({ type: 'dragCancel', entityId: 'rt_e' });
    expect(g.world.get('rt_e')?.location).toEqual({ kind: 'inventory', slot: 4 });
  });

  it('an empty slot does nothing', () => {
    const g = game();
    expect(g.dispatch({ type: 'takeFromInventory', slot: 5, worldPoint: { x: 900, y: 800 } })).toEqual({ ok: false, reason: 'entityNotFound' });
    expect(g.engine.draggingId).toBeUndefined();
  });

  it('dropping it on the backpack again stores it in the first free slot', () => {
    const g = game();
    spawn(g, 'rt_a');
    spawn(g, 'rt_b');
    dropOnBackpack(g, 'rt_a');
    dropOnBackpack(g, 'rt_b');
    g.dispatch({ type: 'takeFromInventory', slot: 0, worldPoint: { x: 900, y: 800 } });
    g.dispatch({ type: 'dragEnd', entityId: 'rt_a', worldPoint: { x: 900, y: 800 }, uiTarget: 'inventory' });
    expect(g.world.get('rt_a')?.location).toEqual({ kind: 'inventory', slot: 0 });
  });
});
