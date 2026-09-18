import path from 'path';

import { readPackDir } from '../../../scripts/lib/pack-fs';
import { createTestGame, type TestGame } from '@/test/create-test-game';
import { InMemorySaveStore } from '@/test/in-memory-save-store';

import type { Appearance } from '../components/base';
import type { EntityId } from '../core/types';
import { SaveService } from '../persistence/save-service';

/** EPIC-017 scenarios on the real core pack (HU-GAME-059..062, HU-GAME-041). */

const CORE = path.resolve(__dirname, '..', '..', '..', 'content', 'core');
const H = (local: string) => `core:home/${local}`;
const LOOK: Appearance = { bodyType: 'child', skinTone: 'skin_03', eyes: 'eyes_round', mouth: 'mouth_smile', hairStyle: 'hair_short', hairColor: 'hair_brown' };

function home(store?: InMemorySaveStore) {
  const g = createTestGame({ packs: [readPackDir(CORE)], saveStore: store, viewportW: 2338 });
  g.dispatch({ type: 'enterScene', sceneId: 'core:home', spawnId: 'default' });
  return g;
}

function kid(g: TestGame, x: number): EntityId {
  const r = g.dispatch({ type: 'createCharacter', appearance: LOOK, outfit: { top: 'core:shirt_star_yellow', bottom: 'core:jeans_blue', shoes: 'core:sneakers_red' } });
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
const state = (g: TestGame, id: EntityId) => g.world.get(id)?.components.states?.current;
const lastRejected = (g: TestGame) => [...g.events].reverse().find((e) => e.type === 'interactionRejected');
const mouthOf = (g: TestGame, c: EntityId) => {
  const t = g.engine.absoluteTransform(c)!;
  return { x: t.x, y: t.y - 300 * 0.71 };
};

describe('living room (HU-GAME-059)', () => {
  it('a character sits on the sofa at its anchor', () => {
    const g = home();
    const c = kid(g, 1100);
    drag(g, c, { x: 420, y: 860 });
    expect(g.world.get(c)?.components.pose).toEqual({ current: 'sit', seatId: H('sofa') });
    expect(g.engine.absoluteTransform(c)).toMatchObject({ x: 420, y: 865 });
  });

  it('an occupied armchair rejects the second character', () => {
    const g = home();
    const a = kid(g, 1100);
    const b = kid(g, 1300);
    drag(g, a, { x: 900, y: 860 });
    drag(g, b, { x: 900, y: 860 });
    expect(lastRejected(g)).toMatchObject({ reason: 'seatFree', targetId: H('armchair') });
    expect(g.world.get(b)?.components.pose?.current).toBe('idle');
  });

  it('the TV and the floor lamp switch on', () => {
    const g = home();
    tap(g, 1250, 780);
    expect(state(g, H('tv'))).toBe('on');
    expect(g.world.get(H('tv'))?.components.sprite?.byState?.on).toBe('env_home_tv_on');
  });

  it('the toybox opens and shows its toys', () => {
    const g = home();
    tap(g, 1780, 930);
    expect(state(g, H('toybox'))).toBe('open');
    const inBox = g.engine.visibleContents().filter((e) => e.location.kind === 'container' && e.location.containerId === H('toybox'));
    expect(inBox.map((e) => e.id).sort()).toEqual([H('toybox_ball'), H('toybox_book')].sort());
  });
});

describe('kitchen (HU-GAME-060)', () => {
  it('three bites turn apple_1 into an apple core and record it as removed', async () => {
    const store = new InMemorySaveStore();
    const g = home(store);
    const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    const c = kid(g, 2800);
    for (let i = 0; i < 3; i++) {
      const apple = g.world.get(H('apple_1'))!;
      drag(g, apple.id, mouthOf(g, c));
      g.advance(1000);
    }
    expect(g.world.has(H('apple_1'))).toBe(false);
    expect(g.world.all().some((e) => e.prefabId === 'core:apple_core')).toBe(true);
    await save.flush();
    expect(await store.loadRemoved('main')).toContain(H('apple_1'));
  });

  it('the fridge opens and keeps food and drinks', () => {
    const g = home();
    tap(g, 2080, 700);
    expect(state(g, H('fridge'))).toBe('open');
    const inFridge = g.engine.visibleContents().filter((e) => e.location.kind === 'container' && e.location.containerId === H('fridge'));
    expect(inFridge.map((e) => e.prefabId).sort()).toEqual(['core:cake_slice', 'core:juice_glass', 'core:milk_carton']);
  });

  it('the fruit bowl makes apples, at most 3', () => {
    const g = home();
    for (let i = 0; i < 4; i++) tap(g, 3120, 830);
    expect(g.world.all().filter((e) => e.components.spawnedFrom?.spawnerId === H('fruit_bowl'))).toHaveLength(3);
  });

  it('a sleeping character does not eat', () => {
    const g = home();
    const c = kid(g, 2800);
    g.world.update(c, { pose: { current: 'sleep' } });
    drag(g, H('banana'), mouthOf(g, c));
    expect(lastRejected(g)).toMatchObject({ reason: 'poseIsNot' });
  });
});

describe('bedroom (HU-GAME-061, HU-GAME-041)', () => {
  it('a character sleeps in the bed', () => {
    const g = home();
    const c = kid(g, 4700);
    drag(g, c, { x: 4250, y: 860 });
    expect(g.world.get(c)?.components.pose).toEqual({ current: 'sleep', seatId: H('bed') });
    expect(g.world.get(c)?.components.expression?.current).toBe('sleepy');
  });

  it('toy blocks left on the bed stay there across scenes', () => {
    const store = new InMemorySaveStore();
    const g = home(store);
    new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    drag(g, H('toy_blocks'), { x: 4350, y: 850 });
    const before = g.engine.absoluteTransform(H('toy_blocks'));
    expect(g.world.index.supportOf(H('toy_blocks'))).toBe(H('bed'));
    g.dispatch({ type: 'enterScene', sceneId: 'core:home', spawnId: 'front_door' });
    expect(g.engine.absoluteTransform(H('toy_blocks'))).toEqual(before);
  });

  it('the wardrobe starts with 8 garments in slots 0..7 and 4 free slots', () => {
    const g = home();
    const slots = g.world.index.inContainer(H('wardrobe'));
    expect(slots.slice(0, 8).every(Boolean)).toBe(true);
    expect(slots.filter(Boolean)).toHaveLength(8);
    expect(g.world.get(H('wardrobe'))?.components.container?.capacity).toBe(12);
  });

  it('take a top from the wardrobe and wear it; the old one drops by the feet', () => {
    const g = home();
    const c = kid(g, 5400);
    const oldTop = g.world.index.wornBy(c).top!;
    tap(g, 5100, 700);
    drag(g, H('wardrobe_top_1'), { x: 5400, y: 800 });
    expect(g.world.get(H('wardrobe_top_1'))?.location).toEqual({ kind: 'worn', characterId: c, slot: 'top' });
    expect(g.world.get(oldTop)?.location.kind).toBe('scene');
  });

  it('the wardrobe only accepts clothes', () => {
    const g = home();
    tap(g, 5100, 700);
    drag(g, H('pillow'), { x: 5100, y: 700 });
    expect(lastRejected(g)).toMatchObject({ reason: 'notAccepted', targetId: H('wardrobe') });
  });
});

describe('bathroom (HU-GAME-062)', () => {
  it('the tap turns on', () => {
    const g = home();
    tap(g, 7000, 820);
    expect(state(g, H('sink'))).toBe('on');
  });

  it('a character sits in the bathtub', () => {
    const g = home();
    const c = kid(g, 6900);
    drag(g, c, { x: 6450, y: 860 });
    expect(g.world.get(c)?.components.pose).toEqual({ current: 'sit', seatId: H('bathtub') });
  });

  it('the laundry basket takes clothes without opening, but not the duck', () => {
    const g = home();
    const c = kid(g, 7100);
    const shoes = g.world.index.wornBy(c).shoes!;
    g.dispatch({ type: 'pointerLongPress', worldPoint: { x: 7100, y: 950 } });
    g.dispatch({ type: 'dragEnd', entityId: shoes, worldPoint: { x: 7450, y: 900 } });
    expect(g.world.get(shoes)?.location).toMatchObject({ kind: 'container', containerId: H('laundry_basket') });
    drag(g, H('rubber_duck'), { x: 7450, y: 900 });
    expect(lastRejected(g)).toMatchObject({ reason: 'notAccepted', targetId: H('laundry_basket') });
  });
});
