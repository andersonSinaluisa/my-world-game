import path from 'path';

import { readPackDir } from '../../../scripts/lib/pack-fs';
import { createTestGame } from '@/test/create-test-game';
import { sceneData, testPack } from '@/test/fixtures/test-content';

import { validatePacks } from '../content/validate-pack';
import { cameraTargetFor } from './camera-math';
import { activeZoneFor, zoneAt, zoneSnapX } from './zones';

const CORE_DIR = path.resolve(__dirname, '..', '..', '..', 'content', 'core');
const W = 2338;

/** Enters core:home of the real core pack, read from disk (the scenarios of HU-GAME-012 use it). */
function enterHome(viewportW = W) {
  const game = createTestGame({ packs: [readPackDir(CORE_DIR)], viewportW });
  game.dispatch({ type: 'enterScene', sceneId: 'core:home', spawnId: 'default' });
  return game;
}

const zoneEvents = (game: ReturnType<typeof enterHome>, from = 0) => game.events.slice(from).filter((e) => e.type === 'zoneChanged');

describe('zoneAt (HU-GAME-012 R1)', () => {
  const zones = [
    { id: 'living', name: 'n', x1: 0, x2: 1920 },
    { id: 'kitchen', name: 'n', x1: 1920, x2: 3840 },
  ];

  it('uses a half-open interval: the border belongs to the next zone', () => {
    expect(zoneAt(zones, 1920)?.id).toBe('kitchen');
    expect(zoneAt(zones, 1919.9)?.id).toBe('living');
    expect(zoneAt(zones, 3840)).toBeUndefined();
  });

  it('a scene without zones has no zone', () => {
    expect(zoneAt(undefined, 500)).toBeUndefined();
    expect(activeZoneFor({}, 500, W, undefined)).toBeUndefined();
  });

  it('keeps the previous zone in a gap between zones', () => {
    const gappy = [zones[0], { id: 'kitchen', name: 'n', x1: 2100, x2: 3840 }];
    expect(activeZoneFor({ zones: gappy }, 2000 - W / 2, W, 'living')).toBe('living');
  });

  it('snaps to snapCameraX, else to the middle of the zone', () => {
    expect(zoneSnapX({ x1: 0, x2: 1920, snapCameraX: 700 })).toBe(700);
    expect(zoneSnapX({ x1: 1920, x2: 3840 })).toBe(2880);
  });
});

describe('active zone in core:home (HU-GAME-012)', () => {
  it('the active zone follows the camera center: cameraX 1000 → center 2169 → kitchen', () => {
    const game = enterHome();
    game.dispatch({ type: 'cameraSettled', cameraX: 1000, viewportW: W });
    expect(game.engine.activeZoneId).toBe('kitchen');
  });

  it('is computed on scene entry with the initial camera', () => {
    const game = enterHome();
    expect(game.engine.activeZoneId).toBe('living');
    expect(zoneEvents(game)).toEqual([{ type: 'zoneChanged', sceneId: 'core:home', zoneId: 'living' }]);
  });

  it('notifies a zone change exactly once', () => {
    const game = enterHome();
    const before = game.events.length;
    game.dispatch({ type: 'cameraSettled', cameraX: 1331, viewportW: W }); // center 2500
    expect(zoneEvents(game, before)).toEqual([{ type: 'zoneChanged', sceneId: 'core:home', zoneId: 'kitchen' }]);
  });

  it('emits nothing when the zone does not change', () => {
    const game = enterHome();
    game.dispatch({ type: 'cameraSettled', cameraX: 1331, viewportW: W });
    const before = game.events.length;
    game.dispatch({ type: 'cameraSettled', cameraX: 1500, viewportW: W }); // center 2669
    expect(zoneEvents(game, before)).toEqual([]);
  });

  it('jumping to the bedroom ends at cameraX 3631', () => {
    const game = enterHome();
    const bedroom = game.engine.scene!.zones!.find((z) => z.id === 'bedroom')!;
    const target = cameraTargetFor(zoneSnapX(bedroom), { minX: 0, maxX: 7680 }, W);
    expect(target).toBe(3631);
    game.dispatch({ type: 'cameraSettled', cameraX: target, viewportW: W });
    expect(game.engine.activeZoneId).toBe('bedroom');
  });

  it('objects cross zones without changing scene or location', () => {
    const game = enterHome();
    const apple = game.world.all().find((e) => e.prefabId === 'core:apple_red')!;
    const t = apple.components.transform!;
    game.dispatch({ type: 'dragStart', entityId: apple.id, worldPoint: { x: t.x, y: t.y - 20 } });
    game.dispatch({ type: 'dragEnd', entityId: apple.id, worldPoint: { x: 1200, y: 900 } });
    expect(game.world.get(apple.id)?.location).toEqual({ kind: 'scene', sceneId: 'core:home' });
    expect(game.world.get(apple.id)?.components.transform?.x).toBe(1200);
  });
});

describe('zone validation (HU-GAME-012 R6)', () => {
  it('overlapping zones fail with an error at /zones/1', () => {
    const pack = testPack();
    sceneData(pack, 'room').zones = [
      { id: 'left', name: 'zone.left.name', x1: 0, x2: 2000 },
      { id: 'right', name: 'zone.right.name', x1: 1900, x2: 3840 },
    ];
    const issue = validatePacks([pack]).issues.find((i) => i.code === 'zoneOverlap');
    expect(issue).toMatchObject({ file: 'scenes/room.json', path: '/zones/1', severity: 'error' });
  });

  it('a scene without zones is valid and has no active zone', () => {
    const pack = testPack();
    delete sceneData(pack, 'room').zones;
    expect(validatePacks([pack]).errorCount).toBe(0);
    const game = createTestGame({ packs: [pack], enter: { sceneId: 'test:room' } });
    expect(game.engine.activeZoneId).toBeUndefined();
  });
});
