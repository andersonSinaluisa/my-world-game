import { createSeededRandom } from '@/engine/core/runtime';
import type { SavedEntity } from '@/engine/persistence/save-store';

import { createTestGame } from './create-test-game';
import { FakeClock } from './fake-clock';
import { InMemorySaveStore } from './in-memory-save-store';

const saved = (id: string, x = 0): SavedEntity => ({
  id,
  location: { kind: 'scene', sceneId: 'test:room' },
  components: { transform: { x, y: 960 } },
});

const slot = {
  slotId: 'main',
  saveVersion: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  contentVersions: { test: '1.0.0' },
  player: { cameraX: 10 },
};

describe('headless harness (HU-GAME-002)', () => {
  it('createTestGame returns an empty World, fake clock, seeded random and empty store', async () => {
    const game = createTestGame();
    expect(game.world.size).toBe(0);
    expect(game.clock.now()).toBe(Date.parse('2026-01-01T00:00:00Z'));
    expect(await game.saveStore.loadEntities('main')).toEqual([]);
  });

  it('the fake clock only moves with advance', () => {
    const game = createTestGame();
    game.advance(1500);
    expect(new Date(game.clock.now()).toISOString()).toBe('2026-01-01T00:00:01.500Z');
  });

  it('fake timers fire in order when time advances', () => {
    const clock = new FakeClock();
    const fired: string[] = [];
    clock.setTimeout(() => fired.push('b'), 200);
    const id = clock.setTimeout(() => fired.push('x'), 100);
    clock.setTimeout(() => fired.push('a'), 100);
    clock.clearTimeout(id);
    clock.advance(150);
    expect(fired).toEqual(['a']);
    clock.advance(100);
    expect(fired).toEqual(['a', 'b']);
  });

  it('the seeded random is reproducible', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    const seqA = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(seqA);
    expect(seqA.every((n) => n >= 0 && n < 1)).toBe(true);
  });
});

describe('InMemorySaveStore (HU-GAME-002 R5)', () => {
  it('stores and loads a batch', async () => {
    const store = new InMemorySaveStore();
    await store.writeBatch({ slotId: 'main', upserts: [saved('a'), saved('b')], removals: [], slot });
    expect(await store.loadEntities('main')).toEqual([saved('a'), saved('b')]);
    expect((await store.loadSlot('main'))?.player).toEqual({ cameraX: 10 });
    expect(store.writeBatchCount).toBe(1);
    expect(store.rowsWritten).toBe(2);
  });

  it('filters by scene and tracks removals', async () => {
    const store = new InMemorySaveStore();
    await store.writeBatch({
      slotId: 'main',
      upserts: [saved('a'), { ...saved('b'), location: { kind: 'inventory', slot: 0 } }],
      removals: [],
    });
    await store.writeBatch({ slotId: 'main', upserts: [], removals: ['a'] });
    expect(await store.loadEntities('main', 'test:room')).toEqual([]);
    expect(await store.loadEntities('main')).toHaveLength(1);
    expect(await store.loadRemoved('main')).toEqual(['a']);
  });

  it('writeBatch is atomic', async () => {
    const store = new InMemorySaveStore();
    await store.writeBatch({ slotId: 'main', upserts: [saved('original')], removals: [] });
    const bad = { ...saved('bad'), components: { transform: { x: 0, y: 0, fn: () => 1 } } } as unknown as SavedEntity;
    await expect(store.writeBatch({ slotId: 'main', upserts: [saved('ok'), bad], removals: [] })).rejects.toThrow(
      /function/,
    );
    expect((await store.loadEntities('main')).map((e) => e.id)).toEqual(['original']);
  });

  it('backup and restore', async () => {
    const store = new InMemorySaveStore();
    await store.writeBatch({ slotId: 'main', upserts: [saved('a', 1)], removals: [] });
    await store.backup();
    await store.writeBatch({ slotId: 'main', upserts: [saved('a', 99), saved('b')], removals: [] });
    await store.restoreBackup();
    expect(await store.loadEntities('main')).toEqual([saved('a', 1)]);
  });
});
