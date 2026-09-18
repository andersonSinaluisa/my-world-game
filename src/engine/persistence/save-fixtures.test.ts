import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { readPackDir } from '../../../scripts/lib/pack-fs';
import { createTestGame, createTestLogger } from '@/test/create-test-game';
import { InMemorySaveStore } from '@/test/in-memory-save-store';

import type { RawPack } from '../content/raw-pack';
import { CURRENT_SAVE_VERSION, migrateSave, MIGRATIONS, type GameSave, type Migration } from './migrations';
import { SaveService } from './save-service';

/** HU-GAME-072: the frozen saveVersion fixtures keep loading with the real core pack. */

const FIXTURES = path.resolve(__dirname, '..', '..', 'test', 'fixtures', 'saves');
const CORE = path.resolve(__dirname, '..', '..', '..', 'content', 'core');
const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(FIXTURES, rel), 'utf8'));
const H = (l: string) => `core:home/${l}`;

async function storeWith(save: GameSave) {
  const store = new InMemorySaveStore();
  await store.replaceAll(save);
  return store;
}

async function load(name: string, pack: RawPack = readPackDir(CORE), opts: { migrations?: Migration[]; saveVersion?: number } = {}) {
  const save = read(`v1/${name}.json`) as GameSave;
  const store = await storeWith(save);
  const logger = createTestLogger();
  const g = createTestGame({ packs: [pack], saveStore: store, logger });
  const service = new SaveService(g.engine, store, { scheduler: g.clock, ...opts }).attach();
  logger.entries.length = 0; // content-load warnings (placeholders) are not part of the save load
  const result = await service.load();
  return { g, store, result, logger, expected: fs.existsSync(path.join(FIXTURES, `v1/${name}.expected.json`)) ? read(`v1/${name}.expected.json`) : {} };
}

/** SAVE_SYSTEM §5 invariants: one entity per container slot, backpack slot and hand; valid locations. */
function checkInvariants(g: ReturnType<typeof createTestGame>) {
  const taken = new Set<string>();
  for (const e of g.world.all()) {
    const l = e.location;
    const key =
      l.kind === 'container' ? `c:${l.containerId}:${l.slot}` : l.kind === 'inventory' ? `i:${l.slot}` : l.kind === 'held' ? `h:${l.holderId}:${l.hand}` : l.kind === 'worn' ? `w:${l.characterId}:${l.slot}` : undefined;
    if (!key) continue;
    expect(taken.has(key)).toBe(false);
    taken.add(key);
    if (l.kind === 'held') expect(g.world.has(l.holderId)).toBe(true);
    if (l.kind === 'worn') expect(g.world.has(l.characterId)).toBe(true);
  }
}

describe('save fixtures (HU-GAME-072)', () => {
  it('published fixtures are never edited (checksums)', () => {
    const sums = read('checksums.json') as Record<string, string>;
    for (const [rel, sum] of Object.entries(sums)) {
      const text = fs.readFileSync(path.join(FIXTURES, rel), 'utf8').replace(/\r\n/g, '\n');
      expect(`${rel}:${crypto.createHash('sha256').update(text).digest('hex')}`).toBe(`${rel}:${sum}`);
    }
  });

  it('fresh.json loads without errors or warnings; the character is at home', async () => {
    const { g, result, logger, expected } = await load('fresh');
    expect(result).toEqual({ status: 'loaded' });
    expect(logger.entries.filter((e) => e.level !== 'debug')).toEqual([]);
    expect(g.engine.scene?.id).toBe(expected.sceneId);
    for (const id of expected.characters) {
      expect(g.world.get(id)?.location).toEqual({ kind: 'scene', sceneId: 'core:home' });
      expect(Object.keys(g.world.index.wornBy(id))).toHaveLength(expected.worn);
    }
    checkInvariants(g);
  });

  it('rich.json: toy on the bed, states, containers, backpack, hand, seat, spawned, removed', async () => {
    const { g, result, expected } = await load('rich');
    expect(result).toEqual({ status: 'loaded' });
    expect(g.engine.absoluteTransform(H('toy_blocks'))).toMatchObject({ x: expected.toyBlocks.x, y: expected.toyBlocks.y });
    expect(g.world.index.supportOf(H('toy_blocks'))).toBe(expected.toyBlocks.supportOf);
    expect(g.world.get(H('tv'))?.components.states?.current).toBe(expected.tv);
    expect(g.world.get(H('fridge'))?.components.states?.current).toBe(expected.fridge);
    expect(g.world.get(H('banana'))?.location).toEqual(expected.banana);
    expect(g.world.get(H('teddy'))?.location).toEqual(expected.teddy);
    expect(g.world.get(H('apple_2'))?.location).toEqual(expected.apple2);
    expect(g.world.get(expected.spawned.id)?.components.spawnedFrom).toEqual({ spawnerId: expected.spawned.spawnerId });
    expect(g.world.get(expected.seated.id)?.components.pose).toEqual({ current: 'sit', seatId: expected.seated.seatId });
    for (const id of expected.removed) expect(g.world.has(id)).toBe(false);
    expect(g.engine.characterCommands.characters().map((c) => c.id).sort()).toEqual(expected.characters);
    checkInvariants(g);
  });

  it('content_drift.json: retired prefab discarded, alias resolved, unknown state falls back', async () => {
    const pack = readPackDir(CORE);
    const manifest = pack.manifest.data as { idAliases?: Record<string, string> };
    manifest.idAliases = { ...(manifest.idAliases ?? {}), 'core:old_ball': 'core:ball' };
    const { g, result, logger, expected } = await load('content_drift', pack);
    expect(result).toEqual({ status: 'loaded' });
    expect(g.world.has(expected.discarded)).toBe(false);
    expect(g.world.get(expected.aliased.id)?.prefabId).toBe(expected.aliased.prefabId);
    expect(g.world.get(H('lamp'))?.components.states?.current).toBe(expected.lampState);
    expect(logger.entries.some((e) => e.level === 'warn' && e.message.includes('retired_toy'))).toBe(true);
    checkInvariants(g);
  });

  it('each migration step is idempotent on the fixtures (none in v1)', () => {
    for (const name of ['fresh', 'rich', 'content_drift']) {
      const save = read(`v1/${name}.json`) as GameSave;
      const once = migrateSave(save, CURRENT_SAVE_VERSION, MIGRATIONS);
      expect(migrateSave(once, CURRENT_SAVE_VERSION, MIGRATIONS)).toEqual(once);
    }
  });

  it('a save from a future version is not opened nor modified', async () => {
    const save = read('v1/rich.json') as GameSave;
    const store = await storeWith({ ...save, slot: { ...save.slot, saveVersion: CURRENT_SAVE_VERSION + 1 } });
    const dump = store.dump();
    const g = createTestGame({ packs: [readPackDir(CORE)], saveStore: store });
    const r = await new SaveService(g.engine, store, { scheduler: g.clock }).attach().load();
    expect(r.status).toBe('incompatible');
    expect(store.dump()).toBe(dump);
  });

  it('a failing migration restores the backup and reports failed without throwing', async () => {
    const boom: Migration[] = [{ from: 1, to: 2, migrate: () => { throw new Error('boom'); } }];
    const save = read('v1/rich.json') as GameSave;
    const store = await storeWith(save);
    const dump = store.dump();
    const g = createTestGame({ packs: [readPackDir(CORE)], saveStore: store });
    const r = await new SaveService(g.engine, store, { scheduler: g.clock, migrations: boom, saveVersion: 2 }).attach().load();
    expect(r.status).toBe('failed');
    expect(store.dump()).toBe(dump);
  });
});
