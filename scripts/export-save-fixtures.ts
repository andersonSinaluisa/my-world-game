/**
 * Exports the saveVersion 1 fixtures of HU-GAME-072 (src/test/fixtures/saves/v1). They are played with the
 * real core pack through the headless harness and then FROZEN: checksums.json guards them, and a published
 * fixture is never edited (R4). Run only to create a new version's fixtures.
 *
 * Usage: npx tsx scripts/export-save-fixtures.ts
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { ContentRegistry } from '../src/engine/content/registry';
import { GameEngine } from '../src/engine/core/engine';
import { createSeededRandom, silentLogger } from '../src/engine/core/runtime';
import type { GameSave } from '../src/engine/persistence/migrations';
import { SaveService } from '../src/engine/persistence/save-service';
import { FakeClock } from '../src/test/fake-clock';
import { InMemorySaveStore } from '../src/test/in-memory-save-store';
import { readPackDir } from './lib/pack-fs';

const OUT = path.resolve(__dirname, '..', 'src', 'test', 'fixtures', 'saves', 'v1');
const CORE = path.resolve(__dirname, '..', 'content', 'core');
const H = (l: string) => `core:home/${l}`;
const LOOK = { bodyType: 'child', skinTone: 'skin_04', eyes: 'eyes_round', mouth: 'mouth_smile', hairStyle: 'hair_buns', hairColor: 'hair_berry' };

async function exportSave(store: InMemorySaveStore): Promise<GameSave> {
  return { slot: (await store.loadSlot('main'))!, entities: await store.loadEntities('main'), removed: await store.loadRemoved('main') };
}

function setup() {
  const clock = new FakeClock();
  const content = ContentRegistry.load([readPackDir(CORE)], { dev: true, logger: silentLogger, corePack: 'core' });
  const engine = GameEngine.create({ clock, scheduler: clock, random: createSeededRandom(72), content, logger: silentLogger, dev: true });
  const store = new InMemorySaveStore();
  const save = new SaveService(engine, store, { scheduler: clock }).attach();
  engine.dispatch({ type: 'viewportChanged', viewportW: 2338 });
  save.startNewGame();
  return { engine, store, save, clock };
}

function drag(engine: GameEngine, id: string, to: { x: number; y: number }) {
  const t = engine.absoluteTransform(id)!;
  engine.dispatch({ type: 'dragStart', entityId: id, worldPoint: { x: t.x, y: t.y - 20 } });
  engine.dispatch({ type: 'dragEnd', entityId: id, worldPoint: to });
}

async function fresh() {
  const { engine, store, save } = setup();
  const r = engine.dispatch({ type: 'createCharacter', appearance: LOOK, outfit: { top: 'core:shirt_star_yellow', bottom: 'core:jeans_blue', shoes: 'core:sneakers_red' } });
  await save.flush();
  const s = await exportSave(store);
  return { save: s, expected: { sceneId: 'core:home', characters: [r.ok ? r.entityId : ''], worn: 3 } };
}

async function rich() {
  const { engine, store, save, clock } = setup();
  const kid = engine.dispatch({ type: 'createCharacter', appearance: LOOK, outfit: { top: 'core:shirt_star_yellow', bottom: 'core:jeans_blue', shoes: 'core:sneakers_red' } });
  const kid2 = engine.dispatch({ type: 'createCharacter', appearance: { ...LOOK, bodyType: 'adult' }, outfit: { top: 'core:hoodie_purple' } });
  const a = kid.ok ? kid.entityId! : '';
  const b = kid2.ok ? kid2.entityId! : '';
  clock.advance(2000);
  // toy on the bed (SAVE_SCHEMA §6), states changed, containers, backpack, held, seated, spawned, removed
  drag(engine, H('toy_blocks'), { x: 4350, y: 850 });
  engine.dispatch({ type: 'pointerTap', worldPoint: { x: 1250, y: 780 } }); // TV on
  engine.dispatch({ type: 'pointerTap', worldPoint: { x: 2080, y: 700 } }); // fridge open
  drag(engine, H('banana'), { x: 2080, y: 600 }); // into the fridge
  drag(engine, H('book'), { x: 3000, y: 700 }); // floor
  engine.dispatch({ type: 'dragStart', entityId: H('teddy'), worldPoint: { x: 1050, y: 930 } });
  engine.dispatch({ type: 'dragEnd', entityId: H('teddy'), worldPoint: { x: 1200, y: 900 }, uiTarget: 'inventory' }); // backpack
  engine.world.update(a, { transform: { x: 3400, y: 960 } });
  drag(engine, H('apple_2'), { x: 3400 - 45, y: 960 - 148 }); // right hand of the child at 3400
  engine.dispatch({ type: 'pointerTap', worldPoint: { x: 3120, y: 830 } }); // fruit bowl → spawned apple
  drag(engine, b, { x: 420, y: 860 }); // adult sits on the sofa
  const cupboardCookie = H('cupboard_cookie_2');
  engine.world.remove(cupboardCookie); // eaten earlier
  clock.advance(2000);
  await save.flush();
  const s = await exportSave(store);
  const toy = engine.absoluteTransform(H('toy_blocks'))!;
  const spawned = engine.world.all().find((e) => e.components.spawnedFrom)!;
  return {
    save: s,
    expected: {
      toyBlocks: { x: toy.x, y: toy.y, supportOf: H('bed') },
      tv: 'on',
      fridge: 'open',
      banana: engine.world.get(H('banana'))!.location,
      teddy: engine.world.get(H('teddy'))!.location,
      apple2: engine.world.get(H('apple_2'))!.location,
      spawned: { id: spawned.id, spawnerId: H('fruit_bowl') },
      seated: { id: b, seatId: H('sofa') },
      removed: [cupboardCookie],
      characters: [a, b].sort(),
    },
  };
}

async function contentDrift() {
  const { engine, store, save } = setup();
  engine.dispatch({ type: 'createCharacter', appearance: LOOK, outfit: {} });
  await save.flush();
  const s = await exportSave(store);
  const lamp = s.entities.find((e) => e.id === H('lamp'))!;
  // Hand-edited on purpose to simulate a content update after the save was written:
  s.entities.push(
    { id: 'rt_01J8Z8RETIREDTOY000000000', prefabId: 'core:retired_toy', location: { kind: 'scene', sceneId: 'core:home' }, components: { transform: { x: 900, y: 960 } } },
    { id: 'rt_01J8Z8RENAMEDBALL00000000', prefabId: 'core:old_ball', location: { kind: 'scene', sceneId: 'core:home' }, components: { transform: { x: 950, y: 960 } } },
  );
  s.entities.push({ ...(lamp ?? { id: H('lamp'), prefabId: 'core:lamp_floor', location: { kind: 'scene', sceneId: 'core:home' } }), components: { transform: { x: 1560, y: 960 }, states: { current: 'broken' } } } as never);
  return {
    save: s,
    expected: { discarded: 'rt_01J8Z8RETIREDTOY000000000', aliased: { id: 'rt_01J8Z8RENAMEDBALL00000000', prefabId: 'core:ball' }, lampState: 'off' },
    note: 'retired_toy has no alias (discarded); old_ball needs idAliases core:old_ball → core:ball (the test adds it); lamp state "broken" no longer exists.',
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const checksums: Record<string, string> = {};
  for (const [name, make] of [['fresh', fresh], ['rich', rich], ['content_drift', contentDrift]] as const) {
    const { save, expected, ...rest } = await make();
    const saveJson = JSON.stringify(save, null, 2) + '\n';
    fs.writeFileSync(path.join(OUT, `${name}.json`), saveJson);
    fs.writeFileSync(path.join(OUT, `${name}.expected.json`), JSON.stringify({ ...expected, ...rest }, null, 2) + '\n');
    checksums[`v1/${name}.json`] = crypto.createHash('sha256').update(saveJson.replace(/\r\n/g, '\n')).digest('hex');
  }
  fs.writeFileSync(path.join(OUT, '..', 'checksums.json'), JSON.stringify(checksums, null, 2) + '\n');
  console.log('Wrote fixtures:', Object.keys(checksums).join(', '));
}

void main();
