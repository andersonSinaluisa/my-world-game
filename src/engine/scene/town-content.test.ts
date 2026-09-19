import path from 'path';

import { readPackDir } from '../../../scripts/lib/pack-fs';
import { createFacadeForTest } from '@/test/facade-for-test';
import { createTestGame, type TestGame } from '@/test/create-test-game';
import { InMemorySaveStore } from '@/test/in-memory-save-store';

import type { Appearance } from '../components/base';
import type { EntityId } from '../core/types';
import { SaveService } from '../persistence/save-service';

/** EPIC-014/018/019/020 scenarios on the real core pack: doors, street, map data, store and coins. */

const CORE = path.resolve(__dirname, '..', '..', '..', 'content', 'core');
const S = (local: string) => `core:street/${local}`;
const LOOK: Appearance = { bodyType: 'child', skinTone: 'skin_03', eyes: 'eyes_round', mouth: 'mouth_smile', hairStyle: 'hair_short', hairColor: 'hair_brown' };

function start(store?: InMemorySaveStore) {
  const g = createTestGame({ packs: [readPackDir(CORE)], saveStore: store, viewportW: 2338 });
  g.dispatch({ type: 'enterScene', sceneId: 'core:home', spawnId: 'default' });
  return g;
}

function kid(g: TestGame, x: number): EntityId {
  const r = g.dispatch({ type: 'createCharacter', appearance: LOOK, outfit: { top: 'core:shirt_star_yellow' } });
  if (!r.ok) throw new Error(r.reason);
  g.world.update(r.entityId!, { transform: { x, y: 960 } });
  g.advance(2000);
  return r.entityId!;
}

function drag(g: TestGame, id: EntityId, to: { x: number; y: number }) {
  const t = g.engine.absoluteTransform(id)!;
  expect(g.dispatch({ type: 'dragStart', entityId: id, worldPoint: { x: t.x, y: t.y - 20 } })).toMatchObject({ ok: true });
  return g.dispatch({ type: 'dragEnd', entityId: id, worldPoint: to });
}

const tap = (g: TestGame, x: number, y: number) => g.dispatch({ type: 'pointerTap', worldPoint: { x, y } });

describe('the town (EPIC-014/018/019/020)', () => {
  it('home → street → store → street → home through the doors, clothes included', () => {
    const g = start();
    const a = kid(g, 600);
    drag(g, a, { x: 120, y: 760 });
    expect(g.engine.scene?.id).toBe('core:street');
    expect(g.world.get(a)?.components.transform).toMatchObject({ x: 820, y: 960, flipX: false });
    expect(Object.keys(g.world.index.wornBy(a))).toEqual(['top']);
    drag(g, a, { x: 4820, y: 760 });
    expect(g.engine.scene?.id).toBe('core:store');
    expect(g.world.get(a)?.components.transform).toMatchObject({ x: 360 });
    drag(g, a, { x: 200, y: 760 });
    expect(g.engine.scene?.id).toBe('core:street');
    expect(g.world.get(a)?.components.transform).toMatchObject({ x: 4700, flipX: true });
    drag(g, a, { x: 700, y: 760 });
    expect(g.engine.scene?.id).toBe('core:home');
    expect(g.world.get(a)?.components.transform).toMatchObject({ x: 150 });
  });

  it('tapping a door opens it and does not travel', () => {
    const g = start();
    tap(g, 120, 760);
    expect(g.engine.scene?.id).toBe('core:home');
    expect(g.world.get('core:home/front_door')?.components.states?.current).toBe('open');
  });

  it('street: sit on the bench, light the lamp, post an apple in the mailbox; it all persists', async () => {
    const store = new InMemorySaveStore();
    const g = start(store);
    const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    save.startNewGame();
    const a = kid(g, 600);
    const b = kid(g, 900);
    g.engine.locations.move('core:home/apple_1', { kind: 'held', holderId: b, hand: 'right' });
    drag(g, a, { x: 120, y: 760 });
    drag(g, a, { x: 2700, y: 880 });
    expect(g.world.get(a)?.components.pose).toEqual({ current: 'sit', seatId: S('bench') });
    tap(g, 3200, 700);
    expect(g.world.get(S('street_lamp'))?.components.states?.current).toBe('on');
    tap(g, 1500, 800);
    expect(g.world.get(S('mailbox'))?.components.states?.current).toBe('open');
    g.dispatch({ type: 'travelTo', sceneId: 'core:home', spawnId: 'default' });
    drag(g, b, { x: 120, y: 760 });
    const apple = 'core:home/apple_1';
    drag(g, apple, { x: 1500, y: 800 });
    expect(g.world.get(apple)?.location).toMatchObject({ kind: 'container', containerId: S('mailbox') });
    await save.flush();

    const g2 = createTestGame({ packs: [readPackDir(CORE)], saveStore: store, viewportW: 2338 });
    expect((await new SaveService(g2.engine, store, { scheduler: g2.clock }).attach().load()).status).toBe('loaded');
    expect(g2.engine.scene?.id).toBe('core:street');
    expect(g2.world.get(S('street_lamp'))?.components.states?.current).toBe('on');
    expect(g2.world.get(apple)?.location).toMatchObject({ kind: 'container', containerId: S('mailbox') });
    expect(g2.world.get(a)?.components.pose).toEqual({ current: 'sit', seatId: S('bench') });
  });

  it('the map lists home, street and store with the current one highlighted, and the zones', () => {
    const g = start();
    const facade = createFacadeForTest(g);
    expect(facade.selectors.locations().map((l) => [l.id, l.current, l.locked])).toEqual([
      ['core:home', true, false],
      ['core:street', false, false],
      ['core:store', false, false],
    ]);
    expect(facade.selectors.zones().map((z) => z.id)).toEqual(['living', 'kitchen', 'bedroom', 'bathroom']);
    facade.dispatch({ type: 'travelTo', sceneId: 'core:store', spawnId: 'entrance' });
    expect(facade.selectors.locations().find((l) => l.current)?.id).toBe('core:store');
    expect(facade.selectors.zones().map((z) => z.label)).toEqual(['Entrada', 'Estantes', 'Caja']);
    expect(facade.selectors.transitionColor('core:street')).toBe('#BEE9FF');
  });

  it('a location missing from a non-empty player.unlocks is locked', () => {
    const g = start();
    g.engine.setPlayerState({ unlocks: ['core:home'] });
    const facade = createFacadeForTest(g);
    expect(facade.selectors.locations().filter((l) => l.locked).map((l) => l.id)).toEqual(['core:street', 'core:store']);
  });

  it('store: buy an apple with the new-game coins and walk out with it; an unpaid copy restocks the shelf', async () => {
    const store = new InMemorySaveStore();
    const g = start(store);
    const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    save.startNewGame();
    expect(g.engine.coins).toBe(50);
    const a = kid(g, 600);
    drag(g, a, { x: 120, y: 760 });
    drag(g, a, { x: 4820, y: 760 });
    expect(g.engine.scene?.id).toBe('core:store');
    const apple = 'core:store/p_apple';
    expect(g.world.get(apple)?.components.purchasable).toMatchObject({ price: 2, purchased: false, origin: { x: 1260, y: 660 } });
    // Leaving with it in the hand is not possible before paying.
    g.engine.locations.move(apple, { kind: 'held', holderId: a, hand: 'right' });
    drag(g, a, { x: 200, y: 760 });
    expect(g.engine.scene?.id).toBe('core:store');
    expect(g.world.get(apple)?.components.transform).toMatchObject({ x: 1260, y: 660 });
    drag(g, apple, { x: 3100, y: 760 });
    expect(g.engine.coins).toBe(48);
    expect(g.world.get(apple)?.components.purchasable?.purchased).toBe(true);
    expect(g.world.all().filter((e) => e.prefabId === 'core:apple_red' && e.components.purchasable?.purchased === false)).toHaveLength(1);
    g.engine.locations.move(apple, { kind: 'held', holderId: a, hand: 'right' });
    drag(g, a, { x: 200, y: 760 });
    expect(g.engine.scene?.id).toBe('core:street');
    expect(g.world.get(apple)?.location).toEqual({ kind: 'held', holderId: a, hand: 'right' });
    await save.flush();
    expect((await store.loadSlot('main'))?.player.wallet).toEqual({ coins: 48 });
  });

  it('a product without enough coins goes back to its shelf', () => {
    const g = start();
    g.engine.setPlayerState({ ...g.engine.playerState, wallet: { coins: 3 } });
    g.dispatch({ type: 'travelTo', sceneId: 'core:store', spawnId: 'entrance' });
    drag(g, 'core:store/p_teddy', { x: 3100, y: 760 });
    expect(g.engine.coins).toBe(3);
    expect(g.world.get('core:store/p_teddy')?.components.transform).toMatchObject({ x: 1960, y: 900 });
  });

  it('hidden coins in the house give 5 coins each, once', () => {
    const g = start();
    g.engine.setPlayerState({ ...g.engine.playerState, wallet: { coins: 0 } });
    tap(g, 1480, 930);
    expect(g.engine.coins).toBe(5);
    expect(g.world.has('core:home/coin_1')).toBe(false);
    tap(g, 1480, 930);
    expect(g.engine.coins).toBe(5);
  });
});
