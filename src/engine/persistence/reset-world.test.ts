import { createTestGame } from '@/test/create-test-game';
import { withCharacters } from '@/test/fixtures/test-characters';
import { testPack } from '@/test/fixtures/test-content';
import { InMemorySaveStore } from '@/test/in-memory-save-store';

import type { Appearance } from '../components/base';
import { SaveService } from './save-service';

const ROOM = 'test:room';
const LOOK: Appearance = { bodyType: 'child', skinTone: 'skin_01', eyes: 'eyes_round', mouth: 'mouth_smile', hairStyle: 'hair_buns', hairColor: 'hair_black' };

async function played() {
  const store = new InMemorySaveStore();
  const g = createTestGame({ packs: [withCharacters(testPack())], saveStore: store });
  const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
  save.startNewGame();
  const ids: string[] = [];
  for (let i = 0; i < 2; i++) {
    const r = g.dispatch({ type: 'createCharacter', appearance: LOOK, outfit: { top: 'test:shirt_star' } });
    if (r.ok) ids.push(r.entityId!);
  }
  g.dispatch({ type: 'setSetting', key: 'sfxVolume', value: 0.3 });
  g.dispatch({ type: 'dragStart', entityId: `${ROOM}/ball`, worldPoint: { x: 1000, y: 920 } });
  g.dispatch({ type: 'dragEnd', entityId: `${ROOM}/ball`, worldPoint: { x: 3000, y: 900 } });
  g.world.remove(`${ROOM}/rug`);
  g.dispatch({ type: 'enterScene', sceneId: 'test:hall', spawnId: 'default' }); // one character stays in the room
  await save.flush();
  return { store, g, save, ids };
}

describe('reset the world (HU-GAME-055)', () => {
  it('reset everything: backup first, empty slot, settings kept, new game', async () => {
    const { store, g, save } = await played();
    const backup = jest.spyOn(store, 'backup');
    const r = await save.resetWorld(false);
    expect(r).toEqual({ ok: true, status: 'new' });
    expect(backup).toHaveBeenCalled();
    expect(await store.loadSlot('main')).toBeUndefined();
    expect(await store.loadEntities('main')).toEqual([]);
    expect(await store.loadRemoved('main')).toEqual([]);
    expect(g.world.size).toBe(0);
    expect(g.engine.settings.sfxVolume).toBe(0.3);
    expect(await save.load()).toEqual({ status: 'new' });
  });

  it('reset keeping characters: they stand at the new-game spawn with their clothes', async () => {
    const { store, g, save, ids } = await played();
    expect(await save.resetWorld(true)).toEqual({ ok: true, status: 'loaded' });
    expect(g.engine.scene?.id).toBe(ROOM);
    for (const [i, id] of ids.sort().entries()) {
      const c = g.world.get(id)!;
      expect(c.location).toEqual({ kind: 'scene', sceneId: ROOM });
      expect(c.components.transform).toMatchObject({ x: 700 + i * 120, y: 960 });
      expect(c.components.pose).toEqual({ current: 'idle' });
      expect(g.world.index.wornBy(id).top).toBeDefined();
    }
    // the rest of the scene is back to its content
    expect(g.world.get(`${ROOM}/ball`)?.components.transform).toEqual({ x: 1000, y: 960 });
    expect(g.world.has(`${ROOM}/rug`)).toBe(true);
    expect(g.engine.settings.sfxVolume).toBe(0.3);
    expect((await store.loadSlot('main'))?.player.wallet).toEqual({ coins: 50 });
  });

  it('a failed backup changes nothing', async () => {
    const { store, save } = await played();
    const dump = store.dump();
    store.failNextBackup = true;
    expect(await save.resetWorld(false)).toEqual({ ok: false, reason: 'backupFailed' });
    expect(store.dump()).toBe(dump);
  });

  it('the reset persists after closing the app', async () => {
    const { store, save, ids } = await played();
    await save.resetWorld(true);
    await save.flush();
    const g2 = createTestGame({ packs: [withCharacters(testPack())], saveStore: store });
    await new SaveService(g2.engine, store, { scheduler: g2.clock }).attach().load();
    expect(g2.engine.characterCommands.characters().map((c) => c.id).sort()).toEqual([...ids].sort());
    expect(g2.world.get(`${ROOM}/ball`)?.components.transform).toEqual({ x: 1000, y: 960 });
  });
});
