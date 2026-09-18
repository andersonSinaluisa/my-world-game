import { createTestGame, type TestGame } from '@/test/create-test-game';
import { sceneData, testPack } from '@/test/fixtures/test-content';

import type { RawPack } from '../content/raw-pack';
import type { EntityId, WorldPoint } from '../core/types';
import { toWorldShape } from '../scene/geometry';
import { SURFACE_TOLERANCE } from '../systems/surface-system';
import { DEFAULT_HIT_PADDING, hitTest } from './hit-test';

const ROOM = 'test:room';
const room = (local: string) => `${ROOM}/${local}`;
const BALL = room('ball');
const BOX = room('box');
const LAMP = room('lamp');
const TABLE = room('table');
const TABLE_TOP = 960 - 180;

function game(pack: RawPack = testPack()) {
  return createTestGame({ packs: [pack], enter: { sceneId: ROOM } });
}

/** Adds a runtime entity of a prefab to the room. */
function spawn(g: TestGame, id: EntityId, prefab: string, x: number, y = 960) {
  g.world.create({
    id,
    prefabId: prefab,
    tags: g.content!.prefab(prefab)!.tags ?? [],
    location: { kind: 'scene', sceneId: ROOM },
    components: { ...g.content!.prefab(prefab)!.components, transform: { x, y } },
  });
}

function drop(g: TestGame, id: EntityId, at: WorldPoint) {
  const t = g.world.get(id)!.components.transform!;
  expect(g.dispatch({ type: 'dragStart', entityId: id, worldPoint: { x: t.x, y: t.y } })).toEqual({ ok: true });
  return g.dispatch({ type: 'dragEnd', entityId: id, worldPoint: at });
}

const pos = (g: TestGame, id: EntityId) => {
  const t = g.world.get(id)!.components.transform!;
  return { x: t.x, y: t.y };
};
const state = (g: TestGame, id: EntityId) => g.world.get(id)!.components.states?.current;
const lastOf = (g: TestGame, type: string) => [...g.events].reverse().find((e) => e.type === type);

describe('hit testing (HU-GAME-026)', () => {
  const hits = (g: TestGame, p: WorldPoint, minHitWorld?: number) =>
    hitTest(g.world, p, { sceneId: ROOM, minHitWorld, hasDirectRules: (e) => g.engine.rules.hasDirectRules(e) }).map((h) => h.id);

  it('hits a circle hitbox with the default padding and misses beyond it', () => {
    const g = game();
    // ball: circle r=40 centered 40 above its pivot (1000, 960)
    expect(hits(g, { x: 1000, y: 920 - 40 - DEFAULT_HIT_PADDING + 1 })).toEqual([BALL]);
    expect(hits(g, { x: 1000, y: 920 - 40 - DEFAULT_HIT_PADDING - 2 })).toEqual([]);
  });

  it('grows small hitboxes to the minimum touch size', () => {
    const g = game();
    const p = { x: 1000, y: 920 - 60 };
    expect(hits(g, p)).toEqual([]);
    expect(hits(g, p, 130)).toEqual([BALL]);
  });

  it('decoration without rules nor draggable is transparent; tap-rule targets are not', () => {
    const g = game();
    spawn(g, 'rt_plant', 'test:plant', 1000); // foreground, in front of the ball
    expect(hits(g, { x: 1000, y: 920 })).toEqual([BALL]);
    expect(hits(g, { x: 3200, y: 800 })).toEqual([LAMP]); // lamp has a tap rule
  });

  it('orders candidates front-most first and resolves zones by smallest area', () => {
    const g = game();
    spawn(g, 'rt_ball', 'test:ball', 2000, 900); // props layer, in front of the box
    const result = hitTest(g.world, { x: 2000, y: 870 }, { sceneId: ROOM, hasDirectRules: () => true });
    expect(result.map((h) => h.id)).toEqual(['rt_ball', BOX]);
    expect(result[1].zone).toBe('front');
    const lid = hitTest(g.world, { x: 2000, y: 805 }, { sceneId: ROOM, hasDirectRules: () => true });
    expect(lid.find((h) => h.id === BOX)?.zone).toBe('lid');
    const body = hitTest(g.world, { x: 1920, y: 810 }, { sceneId: ROOM, hasDirectRules: () => true });
    expect(body.find((h) => h.id === BOX)?.zone).toBe('body');
  });

  it('shows contents of an open container at its slot, before the container', () => {
    const g = game();
    const slot0 = { x: 2000 - 75, y: 960 - 60 - 40 };
    const all = () => hitTest(g.world, slot0, { sceneId: ROOM, hasDirectRules: () => true }).map((h) => h.id);
    expect(all()).toEqual([BOX]); // closed: contents are hidden
    g.world.update(BOX, { states: { ...g.world.get(BOX)!.components.states!, current: 'open' } });
    expect(all()).toEqual([room('box_ball'), BOX]);
  });

  it('mirrors shapes with flipX and scales them', () => {
    const shape = { type: 'rect' as const, x: 10, y: -20, w: 20, h: 20 };
    expect(toWorldShape(shape, { x: 100, y: 0, flipX: true })).toEqual({ type: 'rect', rect: { x1: 70, x2: 90, y1: -20, y2: 0 } });
    expect(toWorldShape(shape, { x: 100, y: 0, scale: 2 })).toEqual({ type: 'rect', rect: { x1: 120, x2: 160, y1: -40, y2: 0 } });
  });
});

describe('pickDraggable (HU-GAME-026 R5b)', () => {
  it('returns the front-most interactive entity only when it is draggable', () => {
    const g = game();
    expect(g.engine.pickDraggable({ x: 1000, y: 920 })).toBe(BALL);
    expect(g.engine.pickDraggable({ x: 3200, y: 800 })).toBeUndefined(); // lamp: tap only
    expect(g.engine.pickDraggable({ x: 500, y: 300 })).toBeUndefined();
  });
});

describe('drag (HU-GAME-027)', () => {
  it('rejects non-draggable, unknown, double and stray drags', () => {
    const g = game();
    const p = { x: 0, y: 0 };
    expect(g.dispatch({ type: 'dragStart', entityId: LAMP, worldPoint: p })).toEqual({ ok: false, reason: 'notDraggable' });
    expect(g.dispatch({ type: 'dragStart', entityId: 'ghost', worldPoint: p })).toEqual({ ok: false, reason: 'entityNotFound' });
    expect(g.dispatch({ type: 'dragStart', entityId: room('box_ball'), worldPoint: p })).toEqual({ ok: false, reason: 'notDraggable' });
    expect(g.dispatch({ type: 'dragStart', entityId: BALL, worldPoint: p })).toEqual({ ok: true });
    expect(g.engine.draggingId).toBe(BALL);
    expect(g.dispatch({ type: 'dragStart', entityId: TABLE, worldPoint: p })).toEqual({ ok: false, reason: 'alreadyDragging' });
    expect(g.dispatch({ type: 'dragEnd', entityId: TABLE, worldPoint: p })).toEqual({ ok: false, reason: 'notDragging' });
    expect(g.dispatch({ type: 'dragCancel', entityId: BALL })).toEqual({ ok: true });
    expect(g.engine.draggingId).toBeUndefined();
    expect(g.dispatch({ type: 'dragCancel', entityId: BALL })).toEqual({ ok: false, reason: 'notDragging' });
  });

  it('dragCancel leaves the entity where it was', () => {
    const g = game();
    g.dispatch({ type: 'dragStart', entityId: BALL, worldPoint: { x: 1000, y: 920 } });
    g.dispatch({ type: 'dragCancel', entityId: BALL });
    expect(pos(g, BALL)).toEqual({ x: 1000, y: 960 });
  });

  it('a held item enters the scene at the pointer on dragStart and goes back on cancel', () => {
    const g = game();
    spawn(g, 'rt_kid', 'test:teddy', 400);
    g.world.create({
      id: 'rt_held',
      prefabId: 'test:ball',
      tags: ['toy'],
      location: { kind: 'held', holderId: 'rt_kid', hand: 'right' },
      components: { ...g.content!.prefab('test:ball')!.components, transform: { x: 0, y: 0 } },
    });
    g.dispatch({ type: 'dragStart', entityId: 'rt_held', worldPoint: { x: 450, y: 800 } });
    expect(g.world.get('rt_held')?.location).toEqual({ kind: 'scene', sceneId: ROOM });
    expect(pos(g, 'rt_held')).toEqual({ x: 450, y: 800 });
    g.dispatch({ type: 'dragCancel', entityId: 'rt_held' });
    expect(g.world.get('rt_held')?.location.kind).toBe('held');
  });
});

describe('surfaces and the floor (HU-GAME-028)', () => {
  it('a drop over the table rests on its top and records support', () => {
    const g = game();
    drop(g, BALL, { x: 2600, y: 700 });
    expect(pos(g, BALL)).toEqual({ x: 2600, y: TABLE_TOP });
    expect(g.world.index.supportOf(BALL)).toBe(TABLE);
  });

  it(`still lands on the surface up to ${SURFACE_TOLERANCE} units below it`, () => {
    const g = game();
    drop(g, BALL, { x: 2600, y: TABLE_TOP + SURFACE_TOLERANCE });
    expect(pos(g, BALL).y).toBe(TABLE_TOP);
    drop(g, BALL, { x: 2600, y: TABLE_TOP + SURFACE_TOLERANCE + 1 });
    expect(pos(g, BALL).y).toBe(960);
    expect(g.world.index.supportOf(BALL)).toBeUndefined();
  });

  it('falls to the floor outside surfaces and clamps x to the scene', () => {
    const g = game();
    drop(g, BALL, { x: -50, y: 300 });
    expect(pos(g, BALL)).toEqual({ x: 0, y: 960 });
    drop(g, BALL, { x: 9999, y: 300 });
    expect(pos(g, BALL)).toEqual({ x: 3840, y: 960 });
  });

  it('floorOnly items ignore surfaces', () => {
    const pack = testPack();
    sceneData(pack, 'room').entities.push({ localId: 'table2', prefabId: 'table', transform: { x: 600, y: 960 } });
    const g = game(pack);
    drop(g, TABLE, { x: 600, y: 700 });
    expect(pos(g, TABLE)).toEqual({ x: 600, y: 960 });
  });

  it('an item never rests on something it carries', () => {
    const g = game();
    drop(g, BALL, { x: 2600, y: 700 }); // ball on the table
    drop(g, TABLE, { x: 1000, y: 700 }); // table moves; it is floorOnly anyway
    expect(pos(g, TABLE)).toEqual({ x: 1000, y: 960 });
  });
});

describe('InteractionResolver (HU-GAME-031/032)', () => {
  it('tap on the lamp cycles its state and reports the rule', () => {
    const g = game();
    expect(g.dispatch({ type: 'pointerTap', worldPoint: { x: 3200, y: 800 } })).toEqual({ ok: true });
    expect(state(g, LAMP)).toBe('on');
    expect(lastOf(g, 'interactionPerformed')).toMatchObject({ ruleId: 'test:tap_cycle', targetId: LAMP, actions: ['cycleState'] });
    g.dispatch({ type: 'pointerTap', worldPoint: { x: 3200, y: 800 } });
    expect(state(g, LAMP)).toBe('off');
  });

  it('tap on nothing does nothing; tap on an object without rules plays its tap effect', () => {
    const g = game();
    const before = g.events.length;
    g.dispatch({ type: 'pointerTap', worldPoint: { x: 500, y: 200 } });
    expect(g.events.length).toBe(before);
    spawn(g, 'rt_teddy', 'test:teddy', 1400);
    g.dispatch({ type: 'pointerTap', worldPoint: { x: 1400, y: 920 } });
    expect(g.events.at(-1)).toEqual({ type: 'visualEffect', entityId: 'rt_teddy', preset: 'wiggle' });
  });

  it('a drop without matching rules places the item and plays its drop effect', () => {
    const g = game();
    const r = drop(g, BALL, { x: 1500, y: 500 });
    expect(r).toEqual({ ok: true });
    expect(pos(g, BALL)).toEqual({ x: 1500, y: 960 });
    expect(g.events.at(-1)).toEqual({ type: 'visualEffect', entityId: BALL, preset: 'squash' });
  });

  it('paint_open_box: on a closed box the condition fails and the next rule (tag_box) runs', () => {
    const g = game();
    spawn(g, 'rt_brush', 'test:brush', 500);
    drop(g, 'rt_brush', { x: 2000, y: 900 }); // box body/front
    expect(lastOf(g, 'interactionPerformed')).toMatchObject({ ruleId: 'test:tag_box' });
    expect(state(g, BOX)).toBe('open');
    drop(g, 'rt_brush', { x: 2000, y: 900 });
    expect(lastOf(g, 'interactionPerformed')).toMatchObject({ ruleId: 'test:paint_open_box' });
    expect(state(g, BOX)).toBe('painted');
  });

  it('hit_zone_lid: same priority, the more specific rule (zone) wins', () => {
    const g = game();
    spawn(g, 'rt_brush', 'test:brush', 500);
    drop(g, 'rt_brush', { x: 2000, y: 805 }); // lid zone
    expect(lastOf(g, 'interactionPerformed')).toMatchObject({ ruleId: 'test:hit_zone_lid', targetId: BOX });
    expect(state(g, BOX)).toBe('open');
  });

  it('a rule whose action does not validate is rejected: shake + place, nothing else changes', () => {
    const pack = testPack();
    (pack.rules[0].data as Record<string, unknown>[]).push({
      id: 'break_lamp',
      trigger: 'drop',
      source: { tags: ['toy'] },
      target: { has: ['switchable'] },
      actions: [
        { type: 'setState', entity: '$target', state: 'on' },
        { type: 'setState', entity: '$target', state: 'exploded' },
      ],
      priority: 50,
    });
    const g = game(pack);
    drop(g, BALL, { x: 3200, y: 800 });
    expect(state(g, LAMP)).toBe('off');
    expect(lastOf(g, 'interactionRejected')).toMatchObject({ ruleId: 'test:break_lamp', reason: 'unknownState', targetId: LAMP });
    expect(g.events.some((e) => e.type === 'visualEffect' && e.entityId === LAMP && e.preset === 'shake')).toBe(true);
    expect(pos(g, BALL)).toEqual({ x: 3200, y: 960 });
  });

  it('the dragged item is never its own target', () => {
    const g = game();
    spawn(g, 'rt_brush', 'test:brush', 2000, 700);
    const r = g.engine.resolver.candidates({ trigger: 'drop', sourceId: 'rt_brush', point: { x: 2000, y: 680 } });
    expect(r.every((c) => c.target?.id !== 'rt_brush')).toBe(true);
  });

  it('breaks ties by rule id when everything else is equal', () => {
    const pack = testPack();
    const rules = pack.rules[0].data as Record<string, unknown>[];
    rules.push(
      { id: 'zz_tap', trigger: 'tap', target: { has: ['switchable'] }, actions: [{ type: 'setState', state: 'on' }], priority: 20 },
      { id: 'aa_tap', trigger: 'tap', target: { has: ['switchable'] }, actions: [{ type: 'setState', state: 'on' }], priority: 20 },
    );
    const g = game(pack);
    g.dispatch({ type: 'pointerTap', worldPoint: { x: 3200, y: 800 } });
    expect(lastOf(g, 'interactionPerformed')).toMatchObject({ ruleId: 'test:aa_tap' });
  });
});

describe('drop preview (HU-GAME-033)', () => {
  const onlyPaint = (patch: Record<string, unknown> = {}) => {
    const pack = testPack();
    const rules = pack.rules[0].data as Record<string, unknown>[];
    const paint = rules.find((r) => r.id === 'paint_open_box')!;
    Object.assign(paint, patch);
    pack.rules[0].data = [paint];
    return pack;
  };
  const previews = (g: TestGame) => g.events.filter((e) => e.type === 'dropPreview');
  const start = (g: TestGame) => {
    spawn(g, 'rt_brush', 'test:brush', 500);
    g.dispatch({ type: 'dragStart', entityId: 'rt_brush', worldPoint: { x: 500, y: 930 } });
  };

  it('a valid target emits dropPreview ok', () => {
    const g = game(onlyPaint());
    g.world.update(BOX, { states: { ...g.world.get(BOX)!.components.states!, current: 'open' } });
    start(g);
    g.dispatch({ type: 'dragPreview', entityId: 'rt_brush', worldPoint: { x: 2000, y: 900 } });
    expect(previews(g).at(-1)).toMatchObject({ targetId: BOX, ok: true, ruleId: 'test:paint_open_box', highlight: true });
  });

  it('a matching rule whose condition fails: ok false with its reason and rejectHint', () => {
    const g = game(onlyPaint({ feedback: { rejectHint: 'ui_hint_closed' } }));
    start(g);
    g.dispatch({ type: 'dragPreview', entityId: 'rt_brush', worldPoint: { x: 2000, y: 900 } });
    expect(previews(g).at(-1)).toMatchObject({ targetId: BOX, ok: false, reason: 'isOpen', rejectHint: 'ui_hint_closed' });
  });

  it('previews never change the World', () => {
    const g = game();
    start(g);
    const before = g.world.all();
    const eventsBefore = g.events.length;
    for (let i = 0; i < 10; i++) g.dispatch({ type: 'dragPreview', entityId: 'rt_brush', worldPoint: { x: 300 + i * 350, y: 850 } });
    expect(g.world.all()).toEqual(before);
    expect(g.world.all().every((e, i) => e === before[i])).toBe(true);
    expect(g.events.slice(eventsBefore).every((e) => e.type === 'dropPreview')).toBe(true);
  });

  it('moving inside the same target and zone emits no new preview', () => {
    const g = game();
    start(g);
    g.dispatch({ type: 'dragPreview', entityId: 'rt_brush', worldPoint: { x: 1980, y: 900 } });
    const n = previews(g).length;
    g.dispatch({ type: 'dragPreview', entityId: 'rt_brush', worldPoint: { x: 2030, y: 910 } });
    expect(previews(g)).toHaveLength(n);
  });

  it('highlight false in the rule: ok but no outline', () => {
    const g = game(onlyPaint({ feedback: { highlight: false } }));
    g.world.update(BOX, { states: { ...g.world.get(BOX)!.components.states!, current: 'open' } });
    start(g);
    g.dispatch({ type: 'dragPreview', entityId: 'rt_brush', worldPoint: { x: 2000, y: 900 } });
    expect(previews(g).at(-1)).toMatchObject({ ok: true, highlight: false });
  });

  it('the drop applies the previewed rule', () => {
    const g = game();
    g.world.update(BOX, { states: { ...g.world.get(BOX)!.components.states!, current: 'open' } });
    start(g);
    g.dispatch({ type: 'dragPreview', entityId: 'rt_brush', worldPoint: { x: 2000, y: 900 } });
    const ruleId = (previews(g).at(-1) as { ruleId?: string }).ruleId;
    g.dispatch({ type: 'dragEnd', entityId: 'rt_brush', worldPoint: { x: 2000, y: 900 } });
    expect(lastOf(g, 'interactionPerformed')).toMatchObject({ ruleId });
  });

  it('only while dragging', () => {
    const g = game();
    expect(g.dispatch({ type: 'dragPreview', entityId: BALL, worldPoint: { x: 0, y: 0 } })).toEqual({ ok: false, reason: 'notDragging' });
  });
});
