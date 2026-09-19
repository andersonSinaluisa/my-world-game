import { createTestGame, type TestGame } from '@/test/create-test-game';
import { withCharacters } from '@/test/fixtures/test-characters';
import { sceneData, testPack } from '@/test/fixtures/test-content';
import { InMemorySaveStore } from '@/test/in-memory-save-store';

import type { Appearance } from '../components/base';
import type { RawPack } from '../content/raw-pack';
import type { EntityId } from '../core/types';
import { SaveService } from '../persistence/save-service';
import { MAX_COINS } from './economy-actions';

/** EPIC-020: wallet (HU-065), buying (HU-066), daily gift and hidden coins (HU-067). */

const ROOM = 'test:room';
const HALL = 'test:hall';
const R = (l: string) => `${ROOM}/${l}`;
const LOOK: Appearance = { bodyType: 'child', skinTone: 'skin_01', eyes: 'eyes_round', mouth: 'mouth_smile', hairStyle: 'hair_buns', hairColor: 'hair_black' };
const REGISTER_X = 2600; // the table plays the register (tag checkout)
const TOP = 960 - 180;

function pack(): RawPack {
  const p = withCharacters(testPack());
  p.rules[0].data = [
    { id: 'travel_portal', trigger: 'drop', source: { has: ['character'] }, target: { has: ['portal'] }, actions: [{ type: 'teleport' }], priority: 95 },
    { id: 'buy_at_register', trigger: 'drop', source: { has: ['purchasable'] }, target: { tags: ['checkout'] }, conditions: [{ type: 'isPurchased', value: false }, { type: 'canAfford' }], actions: [{ type: 'purchase' }], priority: 95, fallback: 'returnToOrigin', feedback: { rejectHint: 'ui_hint_need_coins' } },
    { id: 'store_in_container', trigger: 'drop', source: { has: ['draggable'] }, target: { has: ['container'], zone: 'inside' }, actions: [{ type: 'store' }], priority: 60 },
    { id: 'store_in_backpack', trigger: 'drop', source: { has: ['draggable'] }, target: { ui: 'inventory' }, conditions: [{ type: 'isPurchased', value: true, ifMissing: true }], actions: [{ type: 'addToInventory' }], priority: 90 },
    { id: 'tap_collect', trigger: 'tap', target: { has: ['collectible'] }, actions: [{ type: 'collect' }], priority: 30 },
  ];
  const room = sceneData(p, 'room');
  const table = room.entities.find((e) => e.localId === 'table')!;
  table.tags = ['checkout'];
  // A shelf product (ball) and a product inside the box (slot 0).
  const ball = room.entities.find((e) => e.localId === 'ball')!;
  ball.overrides = { purchasable: { price: 8 } };
  const boxBall = room.entities.find((e) => e.localId === 'box_ball')!;
  boxBall.overrides = { purchasable: { price: 3 } };
  room.entities.push(
    { localId: 'coin', inline: { components: { sprite: { asset: 'test_obj_ball', layer: 'props' }, hitbox: { shape: { type: 'circle', x: 0, y: -20, r: 20 } }, collectible: { reward: { coins: 5 } } }, tags: ['coin'] }, transform: { x: 3400, y: 960 } },
    { localId: 'door', inline: { components: { sprite: { asset: 'test_env_box', layer: 'furniture' }, hitbox: { shape: { type: 'rect', x: -80, y: -300, w: 160, h: 300 } }, portal: { targetSceneId: HALL, targetSpawnId: 'door' } }, tags: ['door'] }, transform: { x: 3700, y: 960 } },
  );
  (p.manifest.data as { newGame: Record<string, unknown> }).newGame = { sceneId: ROOM, spawnId: 'default', coins: 10, dailyGiftCoins: 10, unlocks: [], inventoryCapacity: 12 };
  return p;
}

function game(coins = 10, store?: InMemorySaveStore) {
  const g = createTestGame({ packs: [pack()], enter: { sceneId: ROOM }, saveStore: store });
  g.engine.setPlayerState({ ...g.engine.playerState, wallet: { coins }, inventory: { capacity: 12 } });
  return g;
}

function drop(g: TestGame, id: EntityId, at: { x: number; y: number }, uiTarget?: 'inventory') {
  const t = g.engine.absoluteTransform(id)!;
  expect(g.dispatch({ type: 'dragStart', entityId: id, worldPoint: { x: t.x, y: t.y - 10 } }).ok).toBe(true);
  return g.dispatch({ type: 'dragEnd', entityId: id, worldPoint: at, uiTarget });
}

const wallet = (g: TestGame) => g.events.filter((e) => e.type === 'walletChanged');
const products = (g: TestGame, prefab: string) => g.world.all().filter((e) => e.prefabId === prefab && e.location.kind !== 'limbo');

describe('wallet (HU-GAME-065)', () => {
  it('never goes below 0 and caps at 999; walletChanged carries the applied delta', () => {
    const g = game(995);
    expect(g.engine.addCoins(10)).toBe(true);
    expect(g.engine.coins).toBe(MAX_COINS);
    expect(wallet(g).at(-1)).toMatchObject({ coins: 999, delta: 4 });
    expect(g.engine.addCoins(-1000)).toBe(false);
    expect(g.engine.coins).toBe(999);
  });

  it('a coin change is written at once, without waiting for the debounce', async () => {
    const store = new InMemorySaveStore();
    const g = game(10, store);
    const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    save.startNewGame();
    await save.flush();
    g.engine.addCoins(7);
    await Promise.resolve();
    await save.flush(); // waits for the write in flight, the clock did not move
    expect((await store.loadSlot('main'))?.player.wallet).toEqual({ coins: 17 });
  });
});

describe('buying (HU-GAME-066)', () => {
  it('paying at the register: coins down, product owned, a new unpaid copy at the origin', () => {
    const g = game(10);
    drop(g, R('ball'), { x: REGISTER_X, y: TOP - 10 });
    expect(g.engine.coins).toBe(2);
    expect(g.world.get(R('ball'))?.components.purchasable?.purchased).toBe(true);
    expect(g.world.get(R('ball'))?.components.transform?.y).toBe(TOP);
    const copies = products(g, 'test:ball').filter((e) => e.id.startsWith('rt_'));
    expect(copies).toHaveLength(1);
    expect(copies[0].components.purchasable).toMatchObject({ price: 8, purchased: false, origin: { x: 1000, y: 960 } });
    expect(copies[0].components.transform).toMatchObject({ x: 1000, y: 960 });
  });

  it('a product from a container restocks in its slot', () => {
    const g = game(10);
    g.world.update(R('box'), { states: { ...g.world.get(R('box'))!.components.states!, current: 'open' } });
    g.engine.locations.move(R('box_ball'), { kind: 'scene', sceneId: ROOM });
    g.world.update(R('box_ball'), { transform: { x: 1500, y: 960 } });
    drop(g, R('box_ball'), { x: REGISTER_X, y: TOP - 10 });
    expect(g.engine.coins).toBe(7);
    const copy = products(g, 'test:ball').find((e) => e.id.startsWith('rt_'));
    expect(copy?.location).toEqual({ kind: 'container', containerId: R('box'), slot: 0 });
  });

  it('not enough coins: gentle rejection with the hint, the product goes back to its origin', () => {
    const g = game(5);
    drop(g, R('ball'), { x: REGISTER_X, y: TOP - 10 });
    expect(g.engine.coins).toBe(5);
    expect(g.world.get(R('ball'))?.components.purchasable?.purchased).toBe(false);
    expect(g.world.get(R('ball'))?.components.transform).toMatchObject({ x: 1000, y: 960 });
    expect([...g.events].reverse().find((e) => e.type === 'interactionRejected')).toMatchObject({ reason: 'canAfford' });
    expect(wallet(g)).toEqual([]);
  });

  it('something already paid (or not for sale) just rests on the counter', () => {
    const g = game(10);
    drop(g, R('ball'), { x: REGISTER_X, y: TOP - 10 });
    drop(g, R('ball'), { x: REGISTER_X + 50, y: TOP - 10 });
    expect(g.engine.coins).toBe(2);
    expect(g.world.get(R('ball'))?.components.transform).toMatchObject({ x: REGISTER_X + 50, y: TOP });
  });

  it('an unpaid product cannot go into the backpack', () => {
    const g = game(10);
    drop(g, R('ball'), { x: 1200, y: 900 }, 'inventory');
    expect(g.world.get(R('ball'))?.location.kind).toBe('scene');
  });

  it('a character carrying an unpaid product stays at the door and the product goes home', () => {
    const g = game(10);
    const r = g.dispatch({ type: 'createCharacter', appearance: LOOK, outfit: {} });
    const kid = r.ok ? r.entityId! : '';
    g.world.update(kid, { transform: { x: 3000, y: 960 } });
    g.engine.locations.move(R('ball'), { kind: 'held', holderId: kid, hand: 'right' });
    drop(g, kid, { x: 3700, y: 800 });
    expect(g.engine.scene?.id).toBe(ROOM);
    expect(g.world.get(R('ball'))?.location).toEqual({ kind: 'scene', sceneId: ROOM });
    expect(g.world.get(R('ball'))?.components.transform).toMatchObject({ x: 1000 });
  });

  it('an unpaid product left out of place reloads on its shelf; a paid one and the copy persist', async () => {
    const store = new InMemorySaveStore();
    const g = game(0, store);
    const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    save.startNewGame();
    g.engine.addCoins(10);
    drop(g, R('ball'), { x: REGISTER_X, y: TOP - 10 }); // bought
    const copy = products(g, 'test:ball').find((e) => e.id.startsWith('rt_'))!;
    drop(g, copy.id, { x: 3000, y: 900 }); // unpaid copy left on the floor
    await save.flush();
    const g2 = createTestGame({ packs: [pack()], saveStore: store });
    await new SaveService(g2.engine, store, { scheduler: g2.clock }).attach().load();
    expect(g2.world.get(R('ball'))?.components.purchasable?.purchased).toBe(true);
    expect(g2.world.get(copy.id)?.components.purchasable).toMatchObject({ price: 8, purchased: false });
    expect(g2.world.get(copy.id)?.components.transform).toMatchObject({ x: 3000 }); // runtime copy: no declared place to reset to
    expect(g2.engine.coins).toBe(12); // newGame 10 + 10 − 8
  });
});

describe('daily gift and hidden coins (HU-GAME-067)', () => {
  it('the gift gives newGame.dailyGiftCoins once per local day', () => {
    const g = game(0);
    expect(g.engine.dailyGiftAvailable).toBe(true);
    expect(g.dispatch({ type: 'claimDailyGift' })).toEqual({ ok: true });
    expect(g.engine.coins).toBe(10);
    expect(g.dispatch({ type: 'claimDailyGift' })).toEqual({ ok: false, reason: 'alreadyClaimed' });
    g.advance(24 * 3600 * 1000);
    expect(g.engine.dailyGiftAvailable).toBe(true);
    g.dispatch({ type: 'claimDailyGift' });
    expect(g.engine.coins).toBe(20);
  });

  it('a hidden coin gives its reward and is gone for good', async () => {
    const store = new InMemorySaveStore();
    const g = game(0, store);
    const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    save.startNewGame();
    g.dispatch({ type: 'pointerTap', worldPoint: { x: 3400, y: 940 } });
    expect(g.engine.coins).toBe(10 + 5); // newGame coins + the reward
    expect(g.world.has(R('coin'))).toBe(false);
    await save.flush();
    const g2 = createTestGame({ packs: [pack()], saveStore: store });
    await new SaveService(g2.engine, store, { scheduler: g2.clock }).attach().load();
    expect(g2.world.has(R('coin'))).toBe(false);
  });
});
