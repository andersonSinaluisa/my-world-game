import { createTestGame, type TestGame } from '@/test/create-test-game';
import { withCharacters } from '@/test/fixtures/test-characters';
import { sceneData, testPack } from '@/test/fixtures/test-content';
import { InMemorySaveStore } from '@/test/in-memory-save-store';

import type { Appearance } from '../components/base';
import type { RawPack } from '../content/raw-pack';
import type { EntityId } from '../core/types';
import { SaveService } from '../persistence/save-service';
import { TEMPORARY_POSE_MS } from '../characters/character-system';

const ROOM = 'test:room';
const LOOK: Appearance = { bodyType: 'child', skinTone: 'skin_01', eyes: 'eyes_round', mouth: 'mouth_smile', hairStyle: 'hair_buns', hairColor: 'hair_black' };
// child (height 300) at x = 1500: bands torso y 774..852, legs 852..924, feet 924..960; mouth 1479..1521 × 735..759
const KID_X = 1500;
const AT = { mouth: { x: 1500, y: 745 }, torso: { x: 1500, y: 800 }, legs: { x: 1500, y: 880 }, feet: { x: 1500, y: 945 }, handR: { x: 1450, y: 810 } };

const prefab = (id: string, category: string, tags: string[], extra: Record<string, unknown>) => ({
  file: `prefabs/${category}/${id}.json`,
  data: {
    id,
    category,
    tags,
    components: { sprite: { asset: 'test_obj_ball', layer: 'props' }, hitbox: { shape: { type: 'circle', x: 0, y: -30, r: 30 } }, draggable: {}, ...extra },
    metadata: { name: 'object.ball.name' },
  },
});

function pack(): RawPack {
  const p = withCharacters(testPack());
  const rules = p.rules[0].data as unknown[];
  rules.length = 0;
  rules.push(
    { id: 'wear_clothes', trigger: 'drop', source: { has: ['wearable'] }, target: { has: ['character'], zone: ['body', 'torso', 'legs', 'feet'] }, conditions: [{ type: 'canWear' }, { type: 'isPurchased', value: true, ifMissing: true }], actions: [{ type: 'wear' }], priority: 90 },
    { id: 'unwear_clothes', trigger: 'longPress', target: { has: ['character'], zone: ['torso', 'legs', 'feet'] }, conditions: [{ type: 'slotWorn' }], actions: [{ type: 'unwear' }], priority: 50 },
    { id: 'hold_item', trigger: 'drop', source: { has: ['draggable'], notTags: ['furniture', 'character'] }, target: { has: ['holder'], zone: ['handL', 'handR', 'body'] }, conditions: [{ type: 'handFree' }], actions: [{ type: 'hold' }], priority: 50 },
    { id: 'eat_food', trigger: 'drop', source: { has: ['edible'] }, target: { has: ['character'], zone: ['mouth', 'head'] }, conditions: [{ type: 'isPurchased', value: true, ifMissing: true }, { type: 'poseIsNot', poses: ['sleep'] }], actions: [{ type: 'eat' }], priority: 100 },
    { id: 'drink_drink', trigger: 'drop', source: { has: ['drinkable'] }, target: { has: ['character'], zone: ['mouth', 'head'] }, conditions: [{ type: 'isPurchased', value: true, ifMissing: true }, { type: 'poseIsNot', poses: ['sleep'] }], actions: [{ type: 'drink' }], priority: 100 },
    { id: 'tap_spawner', trigger: 'tap', target: { has: ['spawner'] }, conditions: [{ type: 'belowMax' }], actions: [{ type: 'spawn' }], priority: 20 },
  );
  p.prefabs.push(
    prefab('apple', 'food', ['food'], { edible: { bites: 3, spriteByBitesLeft: { '2': 'test_obj_teddy', '1': 'test_obj_brush' }, onFinish: { type: 'replace', prefabId: 'apple_core' } } }),
    prefab('apple_core', 'food', ['food'], {}),
    prefab('cookie', 'food', ['food'], { edible: { bites: 1, onFinish: { type: 'remove' } } }),
    prefab('juice', 'drink', ['drink'], { drinkable: { sips: 3, onFinish: { type: 'replace', prefabId: 'glass' } } }),
    prefab('glass', 'misc', ['misc'], {}),
    prefab('fruit_bowl', 'decor', ['decor'], { spawner: { prefabId: 'apple' } }),
  );
  const room = sceneData(p, 'room');
  room.entities.push({ localId: 'cookie', prefabId: 'cookie', transform: { x: 600, y: 960 } });
  room.entities.push({ localId: 'bowl', prefabId: 'fruit_bowl', transform: { x: 3500, y: 960 } });
  return p;
}

function game(store?: InMemorySaveStore) {
  return createTestGame({ packs: [pack()], enter: { sceneId: ROOM }, saveStore: store });
}

function kid(g: TestGame): EntityId {
  const r = g.dispatch({ type: 'createCharacter', appearance: LOOK, outfit: { top: 'test:shirt_star' } });
  const id = r.ok ? r.entityId! : '';
  g.world.update(id, { transform: { x: KID_X, y: 960 } });
  g.advance(2000); // happy from the creation ends
  return id;
}

function spawn(g: TestGame, id: EntityId, prefabId: string, x = 700) {
  const init = g.engine.instantiate(prefabId)!;
  g.world.create({ ...init, id, location: { kind: 'scene', sceneId: ROOM }, components: { ...init.components, transform: { x, y: 960 } } });
  return id;
}

function drop(g: TestGame, id: EntityId, at: { x: number; y: number }) {
  const t = g.engine.absoluteTransform(id)!;
  g.dispatch({ type: 'dragStart', entityId: id, worldPoint: { x: t.x, y: t.y - 10 } });
  return g.dispatch({ type: 'dragEnd', entityId: id, worldPoint: at });
}

const last = (g: TestGame, type: string) => [...g.events].reverse().find((e) => e.type === type);
const layer = (g: TestGame, c: EntityId, name: string) => g.engine.characterLayers(c).find((l) => l.layer === name);

describe('wear (HU-GAME-039)', () => {
  it('a garment dropped on the body goes to its own slot; happy for 1 s', () => {
    const g = game();
    const c = kid(g);
    spawn(g, 'rt_shoes', 'test:shoes_red');
    drop(g, 'rt_shoes', AT.torso); // the band does not matter: the garment goes to its slot
    expect(last(g, 'interactionPerformed')).toMatchObject({ ruleId: 'test:wear_clothes' });
    expect(g.world.get('rt_shoes')?.location).toEqual({ kind: 'worn', characterId: c, slot: 'shoes' });
    expect(layer(g, c, 'shoes')?.asset).toBe('chr_shoes_red');
    expect(g.world.get(c)?.components.expression?.current).toBe('happy');
    g.advance(1000);
    expect(g.world.get(c)?.components.expression?.current).toBe('neutral');
  });

  it('the previous garment of the slot drops by the feet', () => {
    const g = game();
    const c = kid(g);
    const oldTop = g.world.index.wornBy(c).top!;
    spawn(g, 'rt_plain', 'test:shirt_plain');
    drop(g, 'rt_plain', AT.legs);
    expect(g.world.index.wornBy(c).top).toBe('rt_plain');
    expect(g.world.get(oldTop)?.location).toEqual({ kind: 'scene', sceneId: ROOM });
    expect(g.engine.absoluteTransform(oldTop)).toMatchObject({ x: KID_X + 70, y: 960 });
  });

  it('an unpurchased garment is rejected', () => {
    const g = game();
    kid(g);
    spawn(g, 'rt_plain', 'test:shirt_plain');
    g.world.update('rt_plain', { purchasable: { price: 3, purchased: false } });
    drop(g, 'rt_plain', AT.torso);
    expect(last(g, 'interactionRejected')).toMatchObject({ ruleId: 'test:wear_clothes', reason: 'notPurchased' });
    expect(g.world.get('rt_plain')?.location.kind).toBe('scene');
  });

  it('no sprite for the body (bad content): canWear fails', () => {
    const g = game();
    const c = kid(g);
    g.dispatch({ type: 'updateAppearance', characterId: c, patch: { bodyType: 'adult' } });
    spawn(g, 'rt_plain', 'test:shirt_plain');
    g.world.update('rt_plain', { wearable: { slot: 'top', layers: {}, bodyVariants: { child: { torsoClothes: 'chr_top_plain' } } } });
    drop(g, 'rt_plain', { x: KID_X, y: 740 });
    expect(last(g, 'interactionRejected')).toMatchObject({ reason: 'canWear' });
  });

  it('a garment dropped on a hand is held, not worn', () => {
    const g = game();
    const c = kid(g);
    spawn(g, 'rt_plain', 'test:shirt_plain');
    drop(g, 'rt_plain', AT.handR);
    expect(g.world.get('rt_plain')?.location).toEqual({ kind: 'held', holderId: c, hand: 'right' });
  });
});

describe('unwear with a long press (HU-GAME-040)', () => {
  it('long press on the torso takes the top off and starts its drag', () => {
    const g = game();
    const c = kid(g);
    const top = g.world.index.wornBy(c).top!;
    const r = g.dispatch({ type: 'pointerLongPress', worldPoint: AT.torso });
    expect(r).toEqual({ ok: true, startDrag: top, entityId: top });
    expect(g.engine.draggingId).toBe(top);
    expect(layer(g, c, 'torsoClothes')).toBeUndefined();
    g.dispatch({ type: 'dragEnd', entityId: top, worldPoint: { x: 700, y: 900 } });
    expect(g.world.get(top)?.location).toEqual({ kind: 'scene', sceneId: ROOM });
    expect(g.engine.absoluteTransform(top)).toMatchObject({ x: 700, y: 960 });
  });

  it('a zone without garment does nothing', () => {
    const g = game();
    const c = kid(g);
    const r = g.dispatch({ type: 'pointerLongPress', worldPoint: AT.feet });
    expect(r).toEqual({ ok: true });
    expect(g.engine.draggingId).toBeUndefined();
    expect(g.world.index.wornBy(c).top).toBeDefined();
  });

  it('an interrupted drag puts the garment back on', () => {
    const g = game();
    const c = kid(g);
    const top = g.world.index.wornBy(c).top!;
    g.dispatch({ type: 'pointerLongPress', worldPoint: AT.torso });
    g.dispatch({ type: 'dragCancel', entityId: top });
    expect(g.world.get(top)?.location).toEqual({ kind: 'worn', characterId: c, slot: 'top' });
  });

  it('works on a seated character without lifting it', () => {
    const g = game();
    const c = kid(g);
    g.world.update(c, { pose: { current: 'sit', seatId: 'test:room/table' } });
    g.dispatch({ type: 'pointerLongPress', worldPoint: AT.torso });
    expect(g.world.get(c)?.components.pose).toEqual({ current: 'sit', seatId: 'test:room/table' });
  });
});

describe('eat (HU-GAME-042)', () => {
  it('first bite: bitesLeft 2, bite sprite, apple in a free hand, pose eat with yum, back after ~900 ms', () => {
    const g = game();
    const c = kid(g);
    spawn(g, 'rt_apple', 'test:apple');
    drop(g, 'rt_apple', AT.mouth);
    expect(last(g, 'interactionPerformed')).toMatchObject({ ruleId: 'test:eat_food' });
    const apple = g.world.get('rt_apple')!;
    expect(apple.components.edible?.bitesLeft).toBe(2);
    expect(apple.location).toEqual({ kind: 'held', holderId: c, hand: 'right' });
    expect(layer(g, c, 'heldR')?.asset).toBe('test_obj_teddy');
    expect(g.world.get(c)?.components.pose?.current).toBe('eat');
    expect(g.world.get(c)?.components.expression?.current).toBe('yum');
    g.advance(TEMPORARY_POSE_MS);
    expect(g.world.get(c)?.components.pose?.current).toBe('idle');
    expect(g.world.get(c)?.components.expression?.current).toBe('neutral');
  });

  it('the last bite replaces the apple with its core, in a free hand', () => {
    const g = game();
    const c = kid(g);
    spawn(g, 'rt_apple', 'test:apple');
    g.world.update('rt_apple', { edible: { ...g.world.get('rt_apple')!.components.edible!, bitesLeft: 1 } });
    drop(g, 'rt_apple', AT.mouth);
    expect(g.world.has('rt_apple')).toBe(false);
    const core = g.world.all().find((e) => e.prefabId === 'test:apple_core')!;
    expect(core.id).toMatch(/^rt_/);
    expect(core.location).toEqual({ kind: 'held', holderId: c, hand: 'right' });
  });

  it('without a free hand the food stays at the feet', () => {
    const g = game();
    const c = kid(g);
    spawn(g, 'rt_b1', 'test:ball', 300);
    spawn(g, 'rt_b2', 'test:ball', 400);
    g.world.update('rt_b1', {});
    g.dispatch({ type: 'dragStart', entityId: 'rt_b1', worldPoint: { x: 300, y: 950 } });
    g.dispatch({ type: 'dragEnd', entityId: 'rt_b1', worldPoint: AT.handR });
    g.dispatch({ type: 'dragStart', entityId: 'rt_b2', worldPoint: { x: 400, y: 950 } });
    g.dispatch({ type: 'dragEnd', entityId: 'rt_b2', worldPoint: AT.handR });
    expect(g.world.index.heldBy(c)).toHaveLength(2);
    spawn(g, 'rt_apple', 'test:apple');
    drop(g, 'rt_apple', AT.mouth);
    expect(g.world.get('rt_apple')?.components.edible?.bitesLeft).toBe(2);
    expect(g.world.get('rt_apple')?.location).toEqual({ kind: 'scene', sceneId: ROOM });
    expect(g.engine.absoluteTransform('rt_apple')).toMatchObject({ x: KID_X + 70, y: 960 });
  });

  it('no eating while asleep: rejection, bitesLeft unchanged', () => {
    const g = game();
    const c = kid(g);
    g.world.update(c, { pose: { current: 'sleep' } });
    spawn(g, 'rt_apple', 'test:apple');
    drop(g, 'rt_apple', AT.mouth);
    expect(last(g, 'interactionRejected')).toMatchObject({ reason: 'poseIsNot', targetId: c });
    expect(g.world.get('rt_apple')?.components.edible?.bitesLeft).toBeUndefined();
  });

  it('a one-bite scene cookie disappears and is recorded as removed', async () => {
    const store = new InMemorySaveStore();
    const g = game(store);
    const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    kid(g);
    drop(g, `${ROOM}/cookie`, { x: KID_X, y: 700 }); // head
    expect(g.world.has(`${ROOM}/cookie`)).toBe(false);
    await save.flush();
    expect(await store.loadRemoved('main')).toEqual([`${ROOM}/cookie`]);
  });

  it('bitesLeft persists', async () => {
    const store = new InMemorySaveStore();
    const g = game(store);
    const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    g.engine.setPlayerState({ currentSceneId: ROOM });
    kid(g);
    spawn(g, 'rt_apple', 'test:apple');
    drop(g, 'rt_apple', AT.mouth);
    g.advance(1000);
    await save.flush();
    const g2 = createTestGame({ packs: [pack()], saveStore: store });
    await new SaveService(g2.engine, store, { scheduler: g2.clock }).attach().load();
    expect(g2.world.get('rt_apple')?.components.edible).toMatchObject({ bites: 3, bitesLeft: 2 });
  });
});

describe('drink (HU-GAME-043)', () => {
  it('a sip: sipsLeft 2, in hand, pose drink; the last one leaves an empty glass', () => {
    const g = game();
    const c = kid(g);
    spawn(g, 'rt_juice', 'test:juice');
    drop(g, 'rt_juice', AT.mouth);
    expect(g.world.get('rt_juice')?.components.drinkable?.sipsLeft).toBe(2);
    expect(g.world.get(c)?.components.pose?.current).toBe('drink');
    g.advance(TEMPORARY_POSE_MS);
    g.world.update('rt_juice', { drinkable: { ...g.world.get('rt_juice')!.components.drinkable!, sipsLeft: 1 } });
    g.dispatch({ type: 'dragStart', entityId: 'rt_juice', worldPoint: AT.handR });
    g.dispatch({ type: 'dragEnd', entityId: 'rt_juice', worldPoint: AT.mouth });
    expect(g.world.has('rt_juice')).toBe(false);
    expect(g.world.all().some((e) => e.prefabId === 'test:glass' && e.location.kind === 'held')).toBe(true);
  });

  it('the empty glass is not drinkable: held or placed instead', () => {
    const g = game();
    const c = kid(g);
    spawn(g, 'rt_glass', 'test:glass');
    drop(g, 'rt_glass', AT.mouth);
    expect(last(g, 'interactionPerformed')?.type === 'interactionPerformed' && (last(g, 'interactionPerformed') as { ruleId: string }).ruleId).not.toBe('test:drink_drink');
    expect(['held', 'scene']).toContain(g.world.get('rt_glass')?.location.kind);
    void c;
  });
});

describe('dispensers (HU-GAME-044)', () => {
  const tapBowl = (g: TestGame) => g.dispatch({ type: 'pointerTap', worldPoint: { x: 3500, y: 940 } });
  const apples = (g: TestGame) => g.world.all().filter((e) => e.components.spawnedFrom?.spawnerId === `${ROOM}/bowl`);

  it('a tap creates an apple next to the bowl, marked with spawnedFrom', () => {
    const g = game();
    tapBowl(g);
    expect(last(g, 'interactionPerformed')).toMatchObject({ ruleId: 'test:tap_spawner' });
    const [a] = apples(g);
    expect(a).toMatchObject({ prefabId: 'test:apple', location: { kind: 'scene', sceneId: ROOM } });
    expect(a.id).toMatch(/^rt_/);
    expect(g.engine.absoluteTransform(a.id)).toMatchObject({ x: 3500, y: 960 });
  });

  it('at most 3 live instances; eating one frees a spot', () => {
    const g = game();
    for (let i = 0; i < 4; i++) tapBowl(g);
    expect(apples(g)).toHaveLength(3);
    expect(last(g, 'interactionRejected')).toMatchObject({ reason: 'belowMax' });
    g.world.remove(apples(g)[0].id);
    tapBowl(g);
    expect(apples(g)).toHaveLength(3);
  });

  it('what was created persists and still counts after reload', async () => {
    const store = new InMemorySaveStore();
    const g = game(store);
    const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    g.engine.setPlayerState({ currentSceneId: ROOM });
    tapBowl(g);
    tapBowl(g);
    await save.flush();
    const g2 = createTestGame({ packs: [pack()], saveStore: store });
    await new SaveService(g2.engine, store, { scheduler: g2.clock }).attach().load();
    expect(g2.world.all().filter((e) => e.components.spawnedFrom)).toHaveLength(2);
    g2.dispatch({ type: 'pointerTap', worldPoint: { x: 3500, y: 940 } });
    g2.dispatch({ type: 'pointerTap', worldPoint: { x: 3500, y: 940 } });
    expect(g2.world.all().filter((e) => e.components.spawnedFrom)).toHaveLength(3);
  });
});
