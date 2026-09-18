import { createTestGame, type TestGame } from '@/test/create-test-game';
import { FakeClock } from '@/test/fake-clock';
import { testPack } from '@/test/fixtures/test-content';
import { InMemorySaveStore } from '@/test/in-memory-save-store';

import type { RawPack } from '../content/raw-pack';
import { migrateSave, MigrationError, type Migration } from './migrations';
import { SAVE_DEBOUNCE_MS, SAVE_MAX_WAIT_MS, SaveService, type SaveServiceOptions } from './save-service';

const ROOM = 'test:room';
const room = (local: string) => `${ROOM}/${local}`;
const BALL = room('ball');
const LAMP = room('lamp');

/** Headless game + SaveService over an in-memory store, flushing all pending promises on `settle`. */
function setup(opts: { store?: InMemorySaveStore; packs?: RawPack[]; service?: SaveServiceOptions; clock?: FakeClock } = {}) {
  const clock = opts.clock ?? new FakeClock();
  const store = opts.store ?? new InMemorySaveStore();
  const game = createTestGame({ packs: opts.packs ?? [testPack()], saveStore: store, clock, viewportW: 1000 });
  const save = new SaveService(game.engine, store, { scheduler: clock, ...opts.service }).attach();
  return { game, store, save, clock };
}

const settle = () => new Promise((r) => setImmediate(r));
async function advance(clock: FakeClock, ms: number) {
  clock.advance(ms);
  await settle();
}

function tapLamp(game: TestGame) {
  game.dispatch({ type: 'pointerTap', worldPoint: { x: 3200, y: 800 } });
}

function moveBall(game: TestGame, x: number) {
  game.dispatch({ type: 'dragStart', entityId: BALL, worldPoint: { x: 1000, y: 920 } });
  game.dispatch({ type: 'dragEnd', entityId: BALL, worldPoint: { x, y: 500 } });
}

describe('new game (HU-GAME-054)', () => {
  it('starts from newGame of the core manifest and writes the first save', async () => {
    const { game, store, save, clock } = setup();
    expect(await save.load()).toEqual({ status: 'new' });
    save.startNewGame();
    expect(game.engine.scene?.id).toBe(ROOM);
    expect(game.engine.playerState).toMatchObject({ currentSceneId: ROOM, wallet: { coins: 50 }, inventory: { capacity: 12 } });
    await advance(clock, SAVE_DEBOUNCE_MS);
    const slot = await store.loadSlot('main');
    expect(slot).toMatchObject({ saveVersion: 1, contentVersions: { test: '1.0.0' }, player: { currentSceneId: ROOM, cameraX: 200 } });
    // Entities instantiated from content are not changes: nothing but the slot row is written.
    expect(await store.loadEntities('main')).toEqual([]);
  });
});

describe('autosave (HU-GAME-052)', () => {
  it('debounces changes for 1 s and writes only dirty entities', async () => {
    const { game, store, save, clock } = setup();
    save.startNewGame();
    await advance(clock, SAVE_DEBOUNCE_MS);
    const writes = store.writeBatchCount;
    tapLamp(game);
    await advance(clock, SAVE_DEBOUNCE_MS - 1);
    expect(store.writeBatchCount).toBe(writes);
    await advance(clock, 1);
    expect(store.writeBatchCount).toBe(writes + 1);
    const rows = await store.loadEntities('main');
    expect(rows).toEqual([{ id: LAMP, prefabId: 'test:lamp', location: { kind: 'scene', sceneId: ROOM }, components: { transform: { x: 3200, y: 960 }, states: { current: 'on' } } }]);
  });

  it('flushes at most 5 s after the first change even with continuous activity', async () => {
    const { game, store, save, clock } = setup();
    save.startNewGame();
    await advance(clock, SAVE_DEBOUNCE_MS);
    const writes = store.writeBatchCount;
    for (let t = 0; t < SAVE_MAX_WAIT_MS; t += 500) {
      tapLamp(game);
      await advance(clock, 500);
    }
    expect(store.writeBatchCount).toBe(writes + 1);
  });

  it('flush() writes immediately (app to background)', async () => {
    const { game, store, save } = setup();
    save.startNewGame();
    tapLamp(game);
    await save.flush();
    expect((await store.loadEntities('main')).map((r) => r.id)).toEqual([LAMP]);
  });

  it('presentation-only events do not trigger a save', async () => {
    const { game, store, save, clock } = setup();
    save.startNewGame();
    await advance(clock, SAVE_DEBOUNCE_MS);
    const writes = store.writeBatchCount;
    game.engine.effects.trigger(BALL, 'drop');
    await advance(clock, SAVE_MAX_WAIT_MS);
    expect(store.writeBatchCount).toBe(writes);
  });

  it('does not write an entity while it is being dragged', async () => {
    const { game, store, save } = setup();
    save.startNewGame();
    game.dispatch({ type: 'dragStart', entityId: 'test:room/table', worldPoint: { x: 2600, y: 900 } });
    game.world.update('test:room/table', { transform: { x: 2700, y: 960 } }); // simulated mid-drag change
    await save.flush();
    expect(await store.loadEntities('main')).toEqual([]);
    game.dispatch({ type: 'dragEnd', entityId: 'test:room/table', worldPoint: { x: 2700, y: 900 } });
    await save.flush();
    expect((await store.loadEntities('main')).map((r) => r.id)).toEqual(['test:room/table']);
  });

  it('a failed write is logged, never thrown, and retried with the next save', async () => {
    const { game, store, save } = setup();
    save.startNewGame();
    await save.flush();
    store.failNextWrite = true;
    tapLamp(game);
    await expect(save.flush()).resolves.toBeUndefined();
    expect(game.logger.entries.some((e) => e.level === 'error' && e.message.includes('Autosave failed'))).toBe(true);
    expect(await store.loadEntities('main')).toEqual([]);
    moveBall(game, 1500);
    await save.flush();
    expect((await store.loadEntities('main')).map((r) => r.id).sort()).toEqual([BALL, LAMP]);
  });

  it('snapshots pending changes before a scene unloads', async () => {
    const { game, store, save } = setup();
    save.startNewGame();
    tapLamp(game);
    game.dispatch({ type: 'enterScene', sceneId: 'test:hall', spawnId: 'door' });
    await save.flush();
    expect((await store.loadEntities('main')).map((r) => r.id)).toEqual([LAMP]);
    // coming back uses the latest diff
    game.dispatch({ type: 'enterScene', sceneId: ROOM, spawnId: 'door' });
    expect(game.world.get(LAMP)?.components.states?.current).toBe('on');
  });

  it('removals: scene entities are recorded, runtime entities just deleted', async () => {
    const { game, store, save } = setup();
    save.startNewGame();
    const ball = game.content!.prefab('test:ball')!;
    game.world.create({ id: 'rt_x', prefabId: 'test:ball', tags: [], location: { kind: 'scene', sceneId: ROOM }, components: { ...ball.components, transform: { x: 5, y: 960 } } });
    await save.flush();
    expect((await store.loadEntities('main')).map((r) => r.id)).toEqual(['rt_x']);
    game.world.remove('rt_x');
    game.world.remove(BALL);
    await save.flush();
    expect(await store.loadEntities('main')).toEqual([]);
    expect(await store.loadRemoved('main')).toEqual([BALL]);
  });
});

describe('load (HU-GAME-053)', () => {
  async function played() {
    const first = setup();
    first.save.startNewGame();
    tapLamp(first.game);
    moveBall(first.game, 2600); // onto the table
    first.game.dispatch({ type: 'cameraSettled', cameraX: 1234, viewportW: 1000 });
    first.game.world.remove('test:room/rug');
    await first.save.flush();
    return first.store;
  }

  it('restores the scene, entity state, support and camera (canonical round trip)', async () => {
    const store = await played();
    const { game, save } = setup({ store });
    expect(await save.load()).toEqual({ status: 'loaded' });
    expect(game.engine.scene?.id).toBe(ROOM);
    expect(game.engine.playerState.cameraX).toBe(1234);
    expect(game.world.get(LAMP)?.components.states?.current).toBe('on');
    expect(game.world.get(BALL)?.components.transform).toEqual({ x: 2600, y: 780 });
    expect(game.world.index.supportOf(BALL)).toBe('test:room/table');
    expect(game.world.has('test:room/rug')).toBe(false);
  });

  it('loading is not a change: nothing is written back', async () => {
    const store = await played();
    const { save, clock } = setup({ store });
    const writes = store.writeBatchCount;
    await save.load();
    await advance(clock, SAVE_MAX_WAIT_MS);
    expect(store.writeBatchCount).toBe(writes);
  });

  it('refuses a save written by a newer app and leaves it untouched', async () => {
    const store = await played();
    const slot = (await store.loadSlot('main'))!;
    await store.writeBatch({ slotId: 'main', upserts: [], removals: [], slot: { ...slot, saveVersion: 99 } });
    const dump = store.dump();
    const { save } = setup({ store });
    expect(await save.load()).toMatchObject({ status: 'incompatible' });
    expect(store.dump()).toBe(dump);
  });

  it('refuses a save from a newer major version of a pack', async () => {
    const store = await played();
    const slot = (await store.loadSlot('main'))!;
    await store.writeBatch({ slotId: 'main', upserts: [], removals: [], slot: { ...slot, contentVersions: { test: '2.0.0' } } });
    const { save } = setup({ store });
    expect(await save.load()).toMatchObject({ status: 'incompatible' });
  });

  it('migrates old saves after a backup and persists the result', async () => {
    const store = await played();
    const migrations: Migration[] = [
      { from: 1, to: 2, migrate: (s) => ({ ...s, slot: { ...s.slot, player: { ...s.slot.player, migrated: true } } }) },
    ];
    const backup = jest.spyOn(store, 'backup');
    const { game, save } = setup({ store, service: { migrations, saveVersion: 2 } });
    expect(await save.load()).toEqual({ status: 'loaded' });
    expect(backup).toHaveBeenCalled();
    expect(game.engine.playerState.migrated).toBe(true);
    expect((await store.loadSlot('main'))?.saveVersion).toBe(2);
  });

  it('a failed migration restores the backup and reports failed', async () => {
    const store = await played();
    const dump = store.dump();
    const migrations: Migration[] = [
      {
        from: 1,
        to: 2,
        migrate: () => {
          throw new Error('boom');
        },
      },
    ];
    const { save } = setup({ store, service: { migrations, saveVersion: 2 } });
    expect(await save.load()).toMatchObject({ status: 'failed' });
    expect(store.dump()).toBe(dump);
  });

  it('applies idAliases and removedIds of the installed content', async () => {
    const store = await played();
    const ball = (await store.loadEntities('main')).find((r) => r.id === BALL)!;
    await store.writeBatch({
      slotId: 'main',
      upserts: [
        { ...ball, id: 'rt_old', prefabId: 'test:old_ball', components: { transform: { x: 100, y: 960 } } },
        { ...ball, id: 'rt_gone', prefabId: 'test:retired_toy', components: { transform: { x: 200, y: 960 } } },
      ],
      removals: [],
    });
    const { game, save } = setup({ store });
    await save.load();
    expect(game.world.get('rt_old')?.prefabId).toBe('test:ball');
    expect(game.world.has('rt_gone')).toBe(false);
  });

  it('falls back to the newGame scene when the saved scene no longer exists', async () => {
    const store = await played();
    const slot = (await store.loadSlot('main'))!;
    await store.writeBatch({ slotId: 'main', upserts: [], removals: [], slot: { ...slot, player: { ...slot.player, currentSceneId: 'test:attic' } } });
    const { game, save } = setup({ store });
    expect(await save.load()).toEqual({ status: 'loaded' });
    expect(game.engine.scene?.id).toBe(ROOM);
  });
});

describe('migrateSave', () => {
  const save = { slot: { slotId: 'main', saveVersion: 1, createdAt: '', updatedAt: '', contentVersions: {}, player: {} }, entities: [], removed: [] };

  it('chains steps and sets the version', () => {
    const steps: Migration[] = [
      { from: 1, to: 2, migrate: (s) => s },
      { from: 2, to: 3, migrate: (s) => ({ ...s, removed: ['x'] }) },
    ];
    const out = migrateSave(save, 3, steps);
    expect(out.slot.saveVersion).toBe(3);
    expect(out.removed).toEqual(['x']);
  });

  it('throws on a gap in the chain', () => {
    expect(() => migrateSave(save, 3, [{ from: 1, to: 2, migrate: (s) => s }])).toThrow(MigrationError);
  });
});
