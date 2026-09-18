import { createTestGame, type TestGame } from '@/test/create-test-game';
import { withCharacters } from '@/test/fixtures/test-characters';
import { sceneData, testPack } from '@/test/fixtures/test-content';
import { InMemorySaveStore } from '@/test/in-memory-save-store';

import type { Appearance } from '../components/base';
import type { EntityId } from '../core/types';
import { SaveService } from '../persistence/save-service';
import { MAX_CHARACTERS } from './character-system';

const ROOM = 'test:room';
const LOOK: Appearance = { bodyType: 'child', skinTone: 'skin_01', eyes: 'eyes_round', mouth: 'mouth_smile', hairStyle: 'hair_buns', hairColor: 'hair_black' };
const OUTFIT = { top: 'test:shirt_star', bottom: 'test:pants_blue', shoes: 'test:shoes_red' };

function game(opts: { wardrobe?: number; store?: InMemorySaveStore } = {}) {
  const pack = withCharacters(testPack());
  if (opts.wardrobe !== undefined) {
    // A wardrobe is just a container that accepts clothing (HU-GAME-041).
    pack.prefabs.push({
      file: 'prefabs/furniture/wardrobe.json',
      data: {
        id: 'wardrobe',
        category: 'furniture',
        tags: ['furniture'],
        components: {
          sprite: { asset: 'test_env_box', layer: 'furniture' },
          hitbox: { shape: { type: 'rect', x: -100, y: -160, w: 200, h: 160 } },
          container: { capacity: Math.max(opts.wardrobe, 1), accepts: ['clothing'] },
        },
        metadata: { name: 'object.box.name' },
      },
    });
    sceneData(pack, 'room').entities.push({ localId: 'wardrobe', prefabId: 'wardrobe', transform: { x: 3500, y: 960 } });
    if (opts.wardrobe === 0) sceneData(pack, 'room').entities.push({ localId: 'old_shirt', prefabId: 'shirt_plain', inContainer: { localId: 'wardrobe', slot: 0 } });
  }
  return createTestGame({ packs: [pack], enter: { sceneId: ROOM }, saveStore: opts.store });
}

const create = (g: TestGame, look: Partial<Appearance> = {}, outfit: Record<string, string> = OUTFIT) =>
  g.dispatch({ type: 'createCharacter', appearance: { ...LOOK, ...look }, outfit });

const idOf = (r: ReturnType<TestGame['dispatch']>): EntityId => (r.ok ? r.entityId! : '');

describe('createCharacter (HU-GAME-021/022/023)', () => {
  it('creates the character and its three garments as real worn entities in one batch', () => {
    const g = game();
    const before = g.events.length;
    const r = create(g);
    expect(r).toMatchObject({ ok: true, entityId: expect.stringMatching(/^rt_/) });
    const id = idOf(r);
    const c = g.world.get(id)!;
    expect(c.components.character).toMatchObject({ isNpc: false, colorTag: '#FFB5C2' });
    expect(c.components.appearance).toEqual(LOOK);
    expect(c.components.pose).toEqual({ current: 'idle' });
    const worn = g.world.index.wornBy(id);
    expect(Object.keys(worn).sort()).toEqual(['bottom', 'shoes', 'top']);
    expect(g.world.get(worn.top!)).toMatchObject({ prefabId: 'test:shirt_star', location: { kind: 'worn', characterId: id, slot: 'top' } });
    const created = g.events.slice(before).filter((e) => e.type === 'entityCreated');
    expect(created).toHaveLength(4);
  });

  it('appears at the default spawn, idle, happy with a bounce', () => {
    const g = game();
    const id = idOf(create(g));
    expect(g.world.get(id)?.location).toEqual({ kind: 'scene', sceneId: ROOM });
    expect(g.world.get(id)?.components.transform).toMatchObject({ x: 700, y: 960 });
    expect(g.world.get(id)?.components.expression?.current).toBe('happy');
    expect(g.events.some((e) => e.type === 'visualEffect' && e.entityId === id && e.preset === 'bounce')).toBe(true);
  });

  it('moves 120 units right when the spawn is taken', () => {
    const g = game();
    create(g);
    const second = idOf(create(g));
    expect(g.world.get(second)?.components.transform?.x).toBe(820);
  });

  it('each character gets its own garment instances and colorTag', () => {
    const g = game();
    const a = idOf(create(g));
    const b = idOf(create(g));
    expect(g.world.index.wornBy(a).top).not.toBe(g.world.index.wornBy(b).top);
    expect(g.world.get(b)?.components.character?.colorTag).toBe('#9ED8FF');
  });

  it('respects the 12-character limit even if the UI fails', () => {
    const g = game();
    for (let i = 0; i < MAX_CHARACTERS; i++) expect(create(g).ok).toBe(true);
    const count = g.world.size;
    expect(create(g)).toEqual({ ok: false, reason: 'maxCharacters' });
    expect(g.world.size).toBe(count);
  });

  it('rejects unknown parts and garments in the wrong slot', () => {
    const g = game();
    expect(create(g, { eyes: 'eyes_laser' })).toEqual({ ok: false, reason: 'invalidPart' });
    expect(create(g, {}, { top: 'test:pants_blue' })).toEqual({ ok: false, reason: 'invalidPart' });
    expect(g.world.query({ has: ['character'] })).toHaveLength(0);
  });

  it('lists characters with their outfit prefabs', () => {
    const g = game();
    const id = idOf(create(g));
    expect(g.engine.characterCommands.characters()).toEqual([
      expect.objectContaining({ id, appearance: LOOK, sceneId: ROOM, outfit: OUTFIT, colorTag: '#FFB5C2' }),
    ]);
  });
});

describe('updateAppearance (HU-GAME-022)', () => {
  it('patches only the given fields and keeps pose, place and clothes', () => {
    const g = game();
    const id = idOf(create(g));
    g.world.update(id, { pose: { current: 'sit', seatId: 'test:room/table' } });
    const top = g.world.index.wornBy(id).top;
    expect(g.dispatch({ type: 'updateAppearance', characterId: id, patch: { hairColor: 'hair_berry' } })).toMatchObject({ ok: true });
    const c = g.world.get(id)!;
    expect(c.components.appearance).toEqual({ ...LOOK, hairColor: 'hair_berry' });
    expect(c.components.pose).toEqual({ current: 'sit', seatId: 'test:room/table' });
    expect(g.world.index.wornBy(id).top).toBe(top);
  });

  it('a body change keeps the clothes and refreshes the hitbox', () => {
    const g = game();
    const id = idOf(create(g));
    const before = g.world.get(id)!.components.hitbox;
    g.dispatch({ type: 'updateAppearance', characterId: id, patch: { bodyType: 'adult' } });
    expect(g.world.get(id)!.components.hitbox).not.toEqual(before);
    expect(Object.keys(g.world.index.wornBy(id))).toHaveLength(3);
    expect(g.engine.characterLayers(id).find((l) => l.layer === 'torsoClothes')?.asset).toBe('chr_top_star_adult');
  });

  it('fails safely for unknown ids, non-characters and unknown parts', () => {
    const g = game();
    const id = idOf(create(g));
    expect(g.dispatch({ type: 'updateAppearance', characterId: 'ghost', patch: { eyes: 'eyes_dot' } })).toEqual({ ok: false, reason: 'entityNotFound' });
    expect(g.dispatch({ type: 'updateAppearance', characterId: 'test:room/ball', patch: { eyes: 'eyes_dot' } })).toEqual({ ok: false, reason: 'notCharacter' });
    expect(g.dispatch({ type: 'updateAppearance', characterId: id, patch: { eyes: 'eyes_x' } })).toEqual({ ok: false, reason: 'invalidPart' });
  });
});

describe('setOutfitSlot (HU-GAME-021 R9)', () => {
  it('wears a new instance and puts the old garment in the wardrobe', () => {
    const g = game({ wardrobe: 6 });
    const id = idOf(create(g));
    const oldTop = g.world.index.wornBy(id).top!;
    expect(g.dispatch({ type: 'setOutfitSlot', characterId: id, slot: 'top', prefabId: 'test:shirt_plain' })).toMatchObject({ ok: true });
    const newTop = g.world.index.wornBy(id).top!;
    expect(newTop).not.toBe(oldTop);
    expect(g.world.get(newTop)?.prefabId).toBe('test:shirt_plain');
    expect(g.world.get(oldTop)?.location).toEqual({ kind: 'container', containerId: 'test:room/wardrobe', slot: 0 });
  });

  it('with a full wardrobe the old garment lands at the character’s feet', () => {
    const g = game({ wardrobe: 0 });
    const id = idOf(create(g));
    const oldTop = g.world.index.wornBy(id).top!;
    g.dispatch({ type: 'setOutfitSlot', characterId: id, slot: 'top', prefabId: 'test:shirt_plain' });
    expect(g.world.get(oldTop)?.location).toEqual({ kind: 'scene', sceneId: ROOM });
    expect(g.world.get(oldTop)?.components.transform).toMatchObject({ x: 760, y: 960 });
  });

  it('null takes the garment off without a replacement', () => {
    const g = game();
    const id = idOf(create(g));
    g.dispatch({ type: 'setOutfitSlot', characterId: id, slot: 'shoes', prefabId: null });
    expect(g.world.index.wornBy(id).shoes).toBeUndefined();
  });

  it('rejects a garment of another slot', () => {
    const g = game();
    const id = idOf(create(g));
    expect(g.dispatch({ type: 'setOutfitSlot', characterId: id, slot: 'shoes', prefabId: 'test:shirt_plain' })).toEqual({ ok: false, reason: 'invalidPart' });
  });
});

describe('focusEntity (HU-GAME-023 R4)', () => {
  it('asks the camera to center the entity; enters its scene when needed', () => {
    const g = game();
    const id = idOf(create(g));
    g.dispatch({ type: 'focusEntity', entityId: id });
    expect(g.events.at(-1)).toEqual({ type: 'focusRequested', entityId: id, x: 700 });
    g.dispatch({ type: 'enterScene', sceneId: 'test:hall', spawnId: 'default' });
    g.dispatch({ type: 'focusEntity', entityId: id });
    expect(g.engine.scene?.id).toBe(ROOM);
    expect(g.events.at(-1)).toMatchObject({ type: 'focusRequested', entityId: id });
  });
});

describe('creator persistence (HU-GAME-021/022 AC-PERSIST-02)', () => {
  it('created and edited characters, with their clothes, survive closing the app', async () => {
    const store = new InMemorySaveStore();
    const g = createTestGame({ packs: [withCharacters(testPack())], saveStore: store });
    const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    save.startNewGame();
    const id = idOf(create(g));
    g.dispatch({ type: 'updateAppearance', characterId: id, patch: { hairStyle: 'hair_short' } });
    g.advance(1000);
    await save.flush();

    const g2 = createTestGame({ packs: [withCharacters(testPack())], saveStore: store });
    const save2 = new SaveService(g2.engine, store, { scheduler: g2.clock }).attach();
    await save2.load();
    const list = g2.engine.characterCommands.characters();
    expect(list).toHaveLength(1);
    expect(list[0].appearance.hairStyle).toBe('hair_short');
    expect(list[0].outfit).toEqual(OUTFIT);
  });
});

describe('previewLayers (HU-GAME-018 R5)', () => {
  it('uses the same resolution as the game, without creating entities', () => {
    const g = game();
    const size = g.world.size;
    const layers = g.engine.characterCommands.previewLayers({ appearance: { ...LOOK, skinTone: 'skin_06' }, outfit: OUTFIT });
    expect(layers.find((l) => l.layer === 'torsoClothes')?.asset).toBe('chr_top_star');
    expect(layers.find((l) => l.layer === 'head')?.tint).toBe('#6B3E26');
    expect(g.world.size).toBe(size);
  });

  it('lists starter clothes by slot with their loose sprite as icon', () => {
    const g = game();
    const opts = g.engine.characterCommands.clothingOptions();
    expect(opts.map((o) => [o.prefabId, o.slot])).toEqual([
      ['test:shirt_star', 'top'],
      ['test:shirt_plain', 'top'],
      ['test:pants_blue', 'bottom'],
      ['test:shoes_red', 'shoes'],
    ]);
    expect(opts[0].icon).toBe('obj_shirt_star');
  });
});
