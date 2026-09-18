import { createTestGame, type TestGame } from '@/test/create-test-game';
import { withCharacters } from '@/test/fixtures/test-characters';
import { testPack } from '@/test/fixtures/test-content';
import { InMemorySaveStore } from '@/test/in-memory-save-store';

import type { Appearance } from '../components/base';
import { validatePacks } from '../content/validate-pack';
import type { EntityId } from '../core/types';
import { SaveService } from '../persistence/save-service';
import { toSavedEntity } from '../persistence/serializer';
import { persistedPose, TEMPORARY_POSE_MS } from './character-system';

const ROOM = 'test:room';
const APPEARANCE: Appearance = {
  bodyType: 'child',
  skinTone: 'skin_04',
  eyes: 'eyes_round',
  mouth: 'mouth_smile',
  hairStyle: 'hair_buns',
  hairColor: 'hair_black',
};

function game(store?: InMemorySaveStore) {
  return createTestGame({ packs: [withCharacters(testPack())], enter: { sceneId: ROOM }, saveStore: store });
}

/** Adds a character (engine-side path used later by createCharacter). */
function addCharacter(g: TestGame, id: EntityId, x = 1500, appearance: Appearance = APPEARANCE) {
  g.world.create(
    g.engine.characters.newCharacter({ id, appearance, location: { kind: 'scene', sceneId: ROOM }, x, y: 960, createdAt: '2026-01-01T00:00:00Z' }),
  );
  return id;
}

function wear(g: TestGame, charId: EntityId, prefab: string, slot: 'top' | 'bottom' | 'shoes', id = `rt_${prefab}`) {
  const p = g.content!.prefab(prefab)!;
  g.world.create({ id, prefabId: p.qualifiedId, tags: p.tags ?? [], location: { kind: 'worn', characterId: charId, slot }, components: { ...p.components } });
  return id;
}

function spawnBall(g: TestGame, id: EntityId, x: number) {
  const p = g.content!.prefab('test:ball')!;
  g.world.create({ id, prefabId: p.qualifiedId, tags: p.tags ?? [], location: { kind: 'scene', sceneId: ROOM }, components: { ...p.components, transform: { x, y: 960 } } });
  return id;
}

const layersOf = (g: TestGame, id: EntityId) => g.engine.characterLayers(id);
const layer = (g: TestGame, id: EntityId, name: string) => layersOf(g, id).find((l) => l.layer === name);
const pose = (g: TestGame, id: EntityId) => g.world.get(id)?.components.pose;
const expr = (g: TestGame, id: EntityId) => g.world.get(id)?.components.expression?.current;

describe('character parts catalog (HU-GAME-013, CHARACTER_SCHEMA §1)', () => {
  it('the test catalog validates', () => {
    expect(validatePacks([withCharacters(testPack())]).issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('reports unknown assets, unknown defaults and wearables without sprites for a body', () => {
    const pack = withCharacters(testPack());
    const data = pack.characters!.data as { eyes: { asset: string }[]; defaults: { mouth: string } };
    data.eyes[0].asset = 'nope';
    data.defaults.mouth = 'mouth_ghost';
    const shoes = pack.prefabs.find((p) => (p.data as { id: string }).id === 'shoes_red')!.data as { components: { wearable: Record<string, unknown> } };
    shoes.components.wearable.layers = {};
    const codes = validatePacks([pack]).issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['unknownAsset', 'unknownPart', 'missingBodyVariant']));
  });

  it('is registered with qualified prefab ids', () => {
    const g = game();
    expect(g.content!.characterCatalog()?.defaults.outfit.top).toBe('test:shirt_star');
  });
});

describe('selectCharacterLayers (HU-GAME-013)', () => {
  it('draws every layer in the fixed order, clothes on their layers and skin tint on body layers', () => {
    const g = game();
    const c = addCharacter(g, 'rt_kid');
    wear(g, c, 'test:shirt_star', 'top');
    const order = layersOf(g, c).map((l) => l.layer);
    expect(order).toEqual(['shadow', 'hairBack', 'legs', 'torso', 'torsoClothes', 'armL', 'armClothesL', 'armR', 'armClothesR', 'head', 'eyes', 'mouth', 'hairFront']);
    expect(layer(g, c, 'torsoClothes')?.asset).toBe('chr_top_star');
    for (const l of ['legs', 'torso', 'armL', 'armR', 'head']) expect(layer(g, c, l)?.tint).toBe('#C68642');
    expect(layer(g, c, 'torsoClothes')?.tint).toBeUndefined();
    expect(layer(g, c, 'hairFront')?.tint).toBe('#2B2B2B');
  });

  it('falls back to the idle sprite when the pose does not define a layer', () => {
    const g = game();
    const c = addCharacter(g, 'rt_kid');
    g.world.update(c, { pose: { current: 'sit' } });
    expect(layer(g, c, 'legs')?.asset).toBe('chr_body_child_sit_legs');
    expect(layer(g, c, 'head')?.asset).toBe('chr_body_child_idle_head');
  });

  it('uses the body variant of a garment, else its default layers', () => {
    const g = game();
    const adult = addCharacter(g, 'rt_adult', 1500, { ...APPEARANCE, bodyType: 'adult' });
    const kid = addCharacter(g, 'rt_kid', 2500);
    wear(g, adult, 'test:shirt_star', 'top', 'rt_s1');
    wear(g, kid, 'test:shirt_star', 'top', 'rt_s2');
    expect(layer(g, adult, 'torsoClothes')?.asset).toBe('chr_top_star_adult');
    expect(layer(g, kid, 'torsoClothes')?.asset).toBe('chr_top_star');
  });

  it('uses a garment pose variant "{asset}_{pose}" only if it exists', () => {
    const g = game();
    const c = addCharacter(g, 'rt_kid');
    wear(g, c, 'test:shirt_star', 'top');
    g.world.update(c, { pose: { current: 'sit' } });
    expect(layer(g, c, 'torsoClothes')?.asset).toBe('chr_top_star_sit');
    expect(layer(g, c, 'armClothesL')?.asset).toBe('chr_top_star_arm_l');
  });

  it('hair: byBodyType variant, optional back; face parts of other bodies move by faceOffset', () => {
    const g = game();
    const adult = addCharacter(g, 'rt_adult', 1500, { ...APPEARANCE, bodyType: 'adult' });
    expect(layer(g, adult, 'hairFront')).toMatchObject({ asset: 'chr_hair_buns_front_adult' });
    expect(layer(g, adult, 'hairFront')?.offset).toBeUndefined();
    expect(layer(g, adult, 'eyes')?.offset).toEqual({ x: 0, y: -120 });
    const short = addCharacter(g, 'rt_short', 2500, { ...APPEARANCE, hairStyle: 'hair_short' });
    expect(layer(g, short, 'hairBack')).toBeUndefined();
  });

  it('closed eyes when sleepy or asleep; mouth by expression with fallback', () => {
    const g = game();
    const c = addCharacter(g, 'rt_kid');
    g.world.update(c, { expression: { current: 'sleepy' } });
    expect(layer(g, c, 'eyes')?.asset).toBe('chr_eyes_round_closed');
    g.world.update(c, { expression: { current: 'yum' } });
    expect(layer(g, c, 'mouth')?.asset).toBe('chr_mouth_smile_yum');
    g.world.update(c, { expression: { current: 'surprised' } });
    expect(layer(g, c, 'mouth')?.asset).toBe('chr_mouth_smile');
    const dot = addCharacter(g, 'rt_dot', 2500, { ...APPEARANCE, eyes: 'eyes_dot' });
    g.world.update(dot, { pose: { current: 'sleep' } });
    expect(layer(g, dot, 'eyes')?.asset).toBe('chr_eyes_dot'); // no closedAsset: normal eyes, no error
  });

  it('skips a layer whose asset is missing and warns once', () => {
    const pack = withCharacters(testPack());
    delete (pack.assets!.data as { images: Record<string, unknown> }).images.chr_hair_buns_back;
    const g = createTestGame({ packs: [pack], enter: { sceneId: ROOM }, dev: false });
    const c = addCharacter(g, 'rt_kid');
    expect(layer(g, c, 'hairBack')).toBeUndefined();
    expect(layer(g, c, 'hairFront')).toBeDefined();
    expect(g.logger.entries.filter((e) => e.message.includes('chr_hair_buns_back'))).toHaveLength(1);
  });

  it('is memoized: other entities changing keep the same array', () => {
    const g = game();
    const c = addCharacter(g, 'rt_kid');
    const first = layersOf(g, c);
    g.world.update('test:room/table', { transform: { x: 100, y: 960 } });
    expect(layersOf(g, c)).toBe(first);
    g.world.update(c, { expression: { current: 'happy' } });
    expect(layersOf(g, c)).not.toBe(first);
  });

  it('characters are drawn in the characters layer ordered by y', () => {
    const g = game();
    addCharacter(g, 'rt_b', 1500);
    addCharacter(g, 'rt_a', 1600);
    g.world.update('rt_a', { transform: { x: 1600, y: 900 } });
    const chars = g.world.query({ has: ['character'] });
    expect(chars.every((e) => e.components.sprite?.layer === 'characters')).toBe(true);
  });
});

describe('poses (HU-GAME-014)', () => {
  it('a temporary pose goes back to the previous persistent pose after ~900 ms', () => {
    const g = game();
    const c = addCharacter(g, 'rt_kid');
    g.world.update(c, { pose: { current: 'sit', seatId: 'test:room/chair' } });
    g.engine.characters.playTemporaryPose(c, 'eat');
    expect(pose(g, c)).toMatchObject({ current: 'eat', returnTo: 'sit' });
    g.advance(TEMPORARY_POSE_MS);
    expect(pose(g, c)).toEqual({ current: 'sit', seatId: 'test:room/chair' });
  });

  it('dragging cancels a temporary pose; its timer does not fire later', () => {
    const g = game();
    const c = addCharacter(g, 'rt_kid');
    g.engine.characters.playTemporaryPose(c, 'eat');
    g.dispatch({ type: 'dragStart', entityId: c, worldPoint: { x: 1500, y: 900 } });
    expect(pose(g, c)?.current).toBe('dangle');
    g.advance(TEMPORARY_POSE_MS * 2);
    expect(pose(g, c)?.current).toBe('dangle');
  });

  it('ignores an invalid transition with a warning', () => {
    const g = game();
    const c = addCharacter(g, 'rt_kid');
    g.world.update(c, { pose: { current: 'sleep' } });
    expect(g.engine.characters.setPose(c, 'eat')).toBe(false);
    expect(pose(g, c)?.current).toBe('sleep');
    expect(g.logger.entries.some((e) => e.level === 'warn' && e.message.includes('sleep → eat'))).toBe(true);
  });

  it('temporary poses are not saved', () => {
    expect(persistedPose({ current: 'drink', returnTo: 'idle' })).toEqual({ current: 'idle' });
    expect(persistedPose({ current: 'eat', returnTo: 'sit', seatId: 's' })).toEqual({ current: 'sit', seatId: 's' });
    const g = game();
    const c = addCharacter(g, 'rt_kid');
    g.engine.characters.playTemporaryPose(c, 'drink');
    expect(toSavedEntity(g.world.get(c)!).components.pose).toEqual({ current: 'idle' });
    expect(toSavedEntity(g.world.get(c)!).components).not.toHaveProperty('expression');
  });

  it('a second eat restarts the timer and keeps returnTo', () => {
    const g = game();
    const c = addCharacter(g, 'rt_kid');
    g.engine.characters.playTemporaryPose(c, 'eat');
    g.advance(600);
    g.engine.characters.playTemporaryPose(c, 'eat');
    expect(pose(g, c)?.returnTo).toBe('idle');
    g.advance(600);
    expect(pose(g, c)?.current).toBe('eat');
    g.advance(300);
    expect(pose(g, c)?.current).toBe('idle');
  });
});

describe('expressions (HU-GAME-015)', () => {
  const tapRule = (pack = withCharacters(testPack())) => {
    (pack.rules[0].data as unknown[]).push({
      id: 'tap_character',
      trigger: 'tap',
      target: { has: ['character'] },
      actions: [{ type: 'setExpression', expression: 'happy', durationMs: 1500 }],
      priority: 5,
    });
    return pack;
  };

  it('tapping a character makes it happy for 1.5 s; a second tap restarts the timer', () => {
    const g = createTestGame({ packs: [tapRule()], enter: { sceneId: ROOM } });
    const c = addCharacter(g, 'rt_kid');
    g.dispatch({ type: 'pointerTap', worldPoint: { x: 1500, y: 800 } });
    expect(g.events.some((e) => e.type === 'interactionPerformed' && e.ruleId === 'test:tap_character')).toBe(true);
    expect(expr(g, c)).toBe('happy');
    g.advance(1200);
    g.dispatch({ type: 'pointerTap', worldPoint: { x: 1500, y: 800 } });
    g.advance(1200);
    expect(expr(g, c)).toBe('happy');
    g.advance(300);
    expect(expr(g, c)).toBe('neutral');
  });

  it('surprised while dragged; neutral after a drop without rules', () => {
    const g = game();
    const c = addCharacter(g, 'rt_kid');
    g.dispatch({ type: 'dragStart', entityId: c, worldPoint: { x: 1500, y: 900 } });
    expect(expr(g, c)).toBe('surprised');
    g.dispatch({ type: 'dragEnd', entityId: c, worldPoint: { x: 700, y: 900 } });
    expect(expr(g, c)).toBe('neutral');
    expect(pose(g, c)?.current).toBe('idle');
  });

  it('expression changes do not trigger a save; the expression is not saved', async () => {
    const store = new InMemorySaveStore();
    const g = game(store);
    const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    const c = addCharacter(g, 'rt_kid');
    await save.flush();
    const writes = store.writeBatchCount;
    g.engine.characters.setExpression(c, 'happy', 1500);
    await save.flush();
    expect(store.writeBatchCount).toBe(writes);
  });
});

describe('holding (HU-GAME-016)', () => {
  const holdRule = (pack = withCharacters(testPack())) => {
    (pack.rules[0].data as unknown[]).push({
      id: 'hold_item',
      trigger: 'drop',
      source: { has: ['draggable'], notTags: ['furniture', 'character'] },
      target: { has: ['holder'], zone: ['handL', 'handR', 'body'] },
      conditions: [{ type: 'handFree' }],
      actions: [{ type: 'hold' }],
      priority: 50,
    });
    return pack;
  };
  const setup = () => {
    const g = createTestGame({ packs: [holdRule()], enter: { sceneId: ROOM } });
    const c = addCharacter(g, 'rt_kid', 1500);
    return { g, c };
  };
  const drop = (g: TestGame, id: EntityId, x: number, y: number) => {
    const t = g.world.get(id)!.components.transform!;
    g.dispatch({ type: 'dragStart', entityId: id, worldPoint: { x: t.x, y: t.y } });
    return g.dispatch({ type: 'dragEnd', entityId: id, worldPoint: { x, y } });
  };
  // child hand anchors: left (+50, −150) → x 1550, right (−50, −150) → x 1450
  const HAND_L = { x: 1550, y: 810 };
  const HAND_R = { x: 1450, y: 810 };

  it('a ball dropped on the left hand is held in the left hand and drawn in heldL at 0.8', () => {
    const { g, c } = setup();
    spawnBall(g, 'rt_ball', 600);
    drop(g, 'rt_ball', HAND_L.x, HAND_L.y);
    expect(g.world.get('rt_ball')?.location).toEqual({ kind: 'held', holderId: c, hand: 'left' });
    expect(layer(g, c, 'heldL')).toMatchObject({ asset: 'test_obj_ball', held: { entityId: 'rt_ball', scale: 0.8, anchor: { x: 50, y: -150 } } });
  });

  it('the touched hand is busy: the other one is used; body: right first', () => {
    const { g, c } = setup();
    spawnBall(g, 'rt_b1', 600);
    spawnBall(g, 'rt_b2', 800);
    drop(g, 'rt_b1', HAND_L.x, HAND_L.y);
    drop(g, 'rt_b2', HAND_L.x, HAND_L.y); // the left hand is busy: the other one takes it
    const where = ['rt_b1', 'rt_b2'].map((id) => g.world.get(id)?.location);
    expect(where).toEqual([
      { kind: 'held', holderId: c, hand: 'left' },
      { kind: 'held', holderId: c, hand: 'right' },
    ]);
  });

  it('both hands busy: handFree fails, rejection shake and place under the point', () => {
    const { g, c } = setup();
    for (const [i, id] of ['rt_b1', 'rt_b2', 'rt_b3'].entries()) spawnBall(g, id, 400 + i * 150);
    drop(g, 'rt_b1', HAND_R.x, HAND_R.y);
    drop(g, 'rt_b2', HAND_R.x, HAND_R.y);
    drop(g, 'rt_b3', HAND_R.x, HAND_R.y);
    expect(g.world.get('rt_b3')?.location).toEqual({ kind: 'scene', sceneId: ROOM });
    expect(g.events.some((e) => e.type === 'interactionRejected' && e.reason === 'handFree' && e.targetId === c)).toBe(true);
    expect(g.events.some((e) => e.type === 'visualEffect' && e.entityId === c && e.preset === 'shake')).toBe(true);
  });

  it('what is held travels with the character', () => {
    const { g, c } = setup();
    spawnBall(g, 'rt_ball', 600);
    drop(g, 'rt_ball', HAND_R.x, HAND_R.y);
    drop(g, c, 2300, 900);
    expect(g.world.get('rt_ball')?.location).toEqual({ kind: 'held', holderId: c, hand: 'right' });
    expect(g.engine.heldTransform('rt_ball')).toMatchObject({ x: 2250, y: 810 });
  });

  it('dragging the held item takes it out of the hand', () => {
    const { g, c } = setup();
    spawnBall(g, 'rt_ball', 600);
    drop(g, 'rt_ball', HAND_R.x, HAND_R.y);
    expect(g.engine.pickDraggable({ x: 1450, y: 790 })).toBe('rt_ball');
    g.dispatch({ type: 'dragStart', entityId: 'rt_ball', worldPoint: { x: 1450, y: 790 } });
    g.dispatch({ type: 'dragEnd', entityId: 'rt_ball', worldPoint: { x: 700, y: 900 } });
    expect(g.world.get('rt_ball')?.location).toEqual({ kind: 'scene', sceneId: ROOM });
    expect(g.world.index.heldBy(c)).toEqual([]);
  });

  it('held items and characters survive closing the app', async () => {
    const store = new InMemorySaveStore();
    const g = createTestGame({ packs: [holdRule()], saveStore: store });
    const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    save.startNewGame();
    const c = addCharacter(g, 'rt_kid', 1500);
    spawnBall(g, 'rt_ball', 600);
    drop(g, 'rt_ball', HAND_L.x, HAND_L.y);
    g.world.update(c, { pose: { current: 'sit', seatId: 'test:room/table' } });
    await save.flush();

    const g2 = createTestGame({ packs: [holdRule()], saveStore: store });
    const save2 = new SaveService(g2.engine, store, { scheduler: g2.clock }).attach();
    expect(await save2.load()).toEqual({ status: 'loaded' });
    expect(g2.world.get('rt_ball')?.location).toEqual({ kind: 'held', holderId: c, hand: 'left' });
    expect(g2.world.get(c)?.components.pose).toEqual({ current: 'sit', seatId: 'test:room/table' });
    expect(g2.world.get(c)?.components.expression?.current).toBe('neutral');
    expect(g2.world.get(c)?.components.hitbox).toBeDefined();
  });
});

describe('dragging characters (HU-GAME-017)', () => {
  it('lifting and dropping on the floor: dangle + surprised, then place + idle', () => {
    const g = game();
    const c = addCharacter(g, 'rt_kid', 1500);
    g.dispatch({ type: 'dragStart', entityId: c, worldPoint: { x: 1500, y: 900 } });
    expect(pose(g, c)?.current).toBe('dangle');
    g.dispatch({ type: 'dragEnd', entityId: c, worldPoint: { x: 1000, y: 500 } });
    expect(pose(g, c)?.current).toBe('idle');
    expect(g.world.get(c)?.components.transform).toMatchObject({ x: 1000, y: 960 });
  });

  it('lifting a seated character frees the seat (standUp implícito)', () => {
    const g = game();
    const c = addCharacter(g, 'rt_kid', 1500);
    g.world.update(c, { pose: { current: 'sit', seatId: 'test:room/chair' } });
    g.dispatch({ type: 'dragStart', entityId: c, worldPoint: { x: 1500, y: 900 } });
    expect(pose(g, c)).toEqual({ current: 'dangle' });
    expect(g.world.index.seatOccupant('test:room/chair')).toBeUndefined();
  });

  it('an interrupted drag restores the seat, pose and position', () => {
    const g = game();
    const c = addCharacter(g, 'rt_kid', 1500);
    g.world.update(c, { pose: { current: 'sit', seatId: 'test:room/chair' } });
    g.dispatch({ type: 'dragStart', entityId: c, worldPoint: { x: 1500, y: 900 } });
    g.dispatch({ type: 'dragCancel', entityId: c });
    expect(pose(g, c)).toEqual({ current: 'sit', seatId: 'test:room/chair' });
    expect(g.world.get(c)?.components.transform).toMatchObject({ x: 1500, y: 960 });
    expect(expr(g, c)).toBe('neutral');
  });

  it('characters stay loaded when the scene changes, and keep their position', () => {
    const g = game();
    const c = addCharacter(g, 'rt_kid', 1500);
    g.dispatch({ type: 'dragStart', entityId: c, worldPoint: { x: 1500, y: 900 } });
    g.dispatch({ type: 'dragEnd', entityId: c, worldPoint: { x: 3000, y: 900 } });
    g.dispatch({ type: 'enterScene', sceneId: 'test:hall', spawnId: 'default' });
    expect(g.world.has(c)).toBe(true);
    expect(g.engine.pickDraggable({ x: 3000, y: 900 })).toBeUndefined(); // not in the active scene
    g.dispatch({ type: 'enterScene', sceneId: ROOM, spawnId: 'default' });
    expect(g.world.get(c)?.components.transform?.x).toBe(3000);
  });
});
