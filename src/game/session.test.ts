import { AppState } from 'react-native';

import { createTestLogger } from '@/test/create-test-game';
import { InMemorySaveStore } from '@/test/in-memory-save-store';

import { bundledTextureEntries, GameSession } from './session';

// Skia does not run under Jest; textures are verified on devices (EPIC-002 sandbox).
jest.mock('./textures', () => ({ createTextureStore: jest.fn(() => ({})) }));

const open = (store: InMemorySaveStore, status: 'ok' | 'incompatible' = 'ok') => () => Promise.resolve({ store, status });

describe('GameSession (HU-GAME-053/054/068)', () => {
  it('loads the bundled core pack and maps every image to a bundled module', () => {
    const session = new GameSession(open(new InMemorySaveStore()), createTestLogger());
    expect(session.content.packs().map((p) => p.id)).toEqual(['core']);
    expect(session.content.issues.filter((i) => i.severity === 'error')).toEqual([]);
    const entries = bundledTextureEntries(session.content);
    expect(Object.keys(entries).length).toBeGreaterThan(0);
    for (const key of Object.keys(entries)) expect(session.content.asset(key)).toBeDefined();
    expect(session.facade.t('ui.play.label')).toBe('Jugar');
    expect(session.facade.t('ui.play.label', 'en')).toBe('Play');
  });

  it('first start is a new game in the newGame scene; the next session continues it', async () => {
    const store = new InMemorySaveStore();
    const first = new GameSession(open(store), createTestLogger());
    first.setScreenSize(800, 360);
    expect(await first.start()).toBe('new');
    const sceneId = first.content.newGame()!.sceneId;
    expect(first.facade.selectors.activeScene()?.id).toBe(sceneId);
    first.facade.dispatch({ type: 'cameraSettled', cameraX: 1111, viewportW: 2400 });
    await first.flush();
    first.dispose();

    const second = new GameSession(open(store), createTestLogger());
    expect(await second.start()).toBe('loaded');
    expect(second.facade.selectors.activeScene()?.id).toBe(sceneId);
    expect(second.facade.selectors.cameraX()).toBe(1111);
    second.dispose();
  });

  it('start() is idempotent', async () => {
    const session = new GameSession(open(new InMemorySaveStore()), createTestLogger());
    const a = session.start();
    expect(session.start()).toBe(a);
    await a;
    session.dispose();
  });

  it('an incompatible database is never touched: the child plays an unsaved new game', async () => {
    const store = new InMemorySaveStore();
    const dump = store.dump();
    const session = new GameSession(open(store, 'incompatible'), createTestLogger());
    expect(await session.start()).toBe('incompatible');
    expect(session.facade.selectors.activeScene()).toBeDefined();
    session.facade.dispatch({ type: 'cameraSettled', cameraX: 500, viewportW: 2400 });
    await session.flush();
    expect(store.dump()).toBe(dump);
  });

  it('a database that cannot open still lets the child play', async () => {
    const logger = createTestLogger();
    const session = new GameSession(() => Promise.reject(new Error('disk full')), logger);
    expect(await session.start()).toBe('failed');
    expect(session.facade.selectors.activeScene()).toBeDefined();
    expect(logger.entries.some((e) => e.level === 'error')).toBe(true);
  });

  it('flushes the save when the app goes to background', async () => {
    const listeners: ((s: string) => void)[] = [];
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, fn) => {
      listeners.push(fn as (s: string) => void);
      return { remove: jest.fn() } as never;
    });
    const store = new InMemorySaveStore();
    const session = new GameSession(open(store), createTestLogger());
    await session.start();
    const writes = store.writeBatchCount;
    session.facade.dispatch({ type: 'cameraSettled', cameraX: 321, viewportW: 2400 });
    listeners.forEach((l) => l('background'));
    await new Promise((r) => setImmediate(r));
    expect(store.writeBatchCount).toBe(writes + 1);
    expect((await store.loadSlot('main'))?.player.cameraX).toBe(321);
    session.dispose();
    spy.mockRestore();
  });
});
