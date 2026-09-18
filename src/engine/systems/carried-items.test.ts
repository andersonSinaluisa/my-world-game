import { createTestGame, type TestGame } from '@/test/create-test-game';
import { prefabData, sceneData, testPack } from '@/test/fixtures/test-content';
import { InMemorySaveStore } from '@/test/in-memory-save-store';

import type { EntityId } from '../core/types';
import { SaveService } from '../persistence/save-service';

const ROOM = 'test:room';
const TABLE = `${ROOM}/table`;
const BALL = `${ROOM}/ball`;

function game(carries = true, store?: InMemorySaveStore) {
  const pack = testPack();
  (prefabData(pack, 'table').components.surface as Record<string, unknown>).carriesItems = carries;
  return createTestGame({ packs: [pack], enter: { sceneId: ROOM }, saveStore: store });
}

function drop(g: TestGame, id: EntityId, x: number, y: number) {
  const t = g.engine.absoluteTransform(id)!;
  g.dispatch({ type: 'dragStart', entityId: id, worldPoint: { x: t.x, y: t.y } });
  g.dispatch({ type: 'dragEnd', entityId: id, worldPoint: { x, y } });
}

describe('items carried by furniture (HU-GAME-030)', () => {
  it('an item dropped on a carrier is linked with relative coordinates', () => {
    const g = game();
    drop(g, BALL, 2650, 700);
    expect(g.world.get(BALL)?.components.transform).toEqual({ x: 50, y: -180, parentId: TABLE });
    expect(g.engine.absoluteTransform(BALL)).toMatchObject({ x: 2650, y: 780 });
  });

  it('moving the table takes the ball with it', () => {
    const g = game();
    drop(g, BALL, 2650, 700);
    drop(g, TABLE, 3000, 900);
    expect(g.engine.absoluteTransform(BALL)).toMatchObject({ x: 3050, y: 780 });
    expect(g.world.index.supportOf(BALL)).toBe(TABLE);
  });

  it('lifting the ball unlinks it', () => {
    const g = game();
    drop(g, BALL, 2650, 700);
    drop(g, BALL, 1000, 900);
    expect(g.world.get(BALL)?.components.transform).toEqual({ x: 1000, y: 960 });
  });

  it('a surface without carriesItems does not link', () => {
    const g = game(false);
    drop(g, BALL, 2650, 700);
    expect(g.world.get(BALL)?.components.transform).toEqual({ x: 2650, y: 780 });
    drop(g, TABLE, 1500, 900);
    expect(g.engine.absoluteTransform(BALL)).toMatchObject({ x: 2650, y: 780 });
  });

  it('no chains: an item on a carried tray does not link to the tray', () => {
    const pack = testPack();
    (prefabData(pack, 'table').components.surface as Record<string, unknown>).carriesItems = true;
    // A small tray that also carries items, standing on the table.
    pack.prefabs.push({
      file: 'prefabs/furniture/tray.json',
      data: {
        id: 'tray',
        category: 'furniture',
        tags: ['furniture'],
        components: {
          sprite: { asset: 'test_obj_brush', layer: 'props' },
          hitbox: { shape: { type: 'rect', x: -30, y: -20, w: 60, h: 20 } },
          draggable: {},
          surface: { segments: [{ x1: -30, x2: 30, y: -20 }], carriesItems: true },
        },
        metadata: { name: 'object.brush.name' },
      },
    });
    sceneData(pack, 'room').entities.push({ localId: 'tray', prefabId: 'tray', transform: { x: 500, y: 960 } });
    const g = createTestGame({ packs: [pack], enter: { sceneId: ROOM } });
    const TRAY = `${ROOM}/tray`;
    drop(g, TRAY, 2600, 700);
    expect(g.world.get(TRAY)?.components.transform?.parentId).toBe(TABLE);
    drop(g, BALL, 2600, 740);
    expect(g.world.get(BALL)?.components.transform?.parentId).toBeUndefined();
    expect(g.engine.absoluteTransform(BALL)?.y).toBe(760);
  });

  it('a child that would leave the scene is clamped and unlinked', () => {
    const g = game();
    drop(g, BALL, 2710, 700); // x +110 relative to the table
    drop(g, TABLE, 3800, 900); // ball would be at 3910 > 3840
    expect(g.world.get(BALL)?.components.transform?.parentId).toBeUndefined();
    expect(g.world.get(BALL)?.components.transform?.x).toBe(3840);
  });

  it('dragCancel of a carried item restores the link', () => {
    const g = game();
    drop(g, BALL, 2650, 700);
    g.dispatch({ type: 'dragStart', entityId: BALL, worldPoint: { x: 2650, y: 760 } });
    expect(g.world.get(BALL)?.components.transform?.parentId).toBeUndefined();
    g.dispatch({ type: 'dragCancel', entityId: BALL });
    expect(g.world.get(BALL)?.components.transform).toEqual({ x: 50, y: -180, parentId: TABLE });
  });

  it('the link survives closing the app', async () => {
    const store = new InMemorySaveStore();
    const g = game(true, store);
    const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    drop(g, BALL, 2650, 700);
    await save.flush();
    const pack = testPack();
    (prefabData(pack, 'table').components.surface as Record<string, unknown>).carriesItems = true;
    const g2 = createTestGame({ packs: [pack], saveStore: store });
    const save2 = new SaveService(g2.engine, store, { scheduler: g2.clock }).attach();
    await save2.load();
    expect(g2.world.get(BALL)?.components.transform?.parentId).toBe(TABLE);
    expect(g2.engine.absoluteTransform(BALL)).toMatchObject({ x: 2650, y: 780 });
    expect(g2.world.index.supportOf(BALL)).toBe(TABLE);
  });
});
