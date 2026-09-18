import { entity } from '@/test/builders';
import { createTestGame, createTestLogger } from '@/test/create-test-game';

import { InvariantError } from './world';

describe('LocationService (HU-GAME-003 R9)', () => {
  function setup(dev = true) {
    const logger = createTestLogger();
    const game = createTestGame({ dev, logger });
    game.world.create(entity('test:room/box'));
    game.world.create(entity('test:room/ball'));
    game.world.create(entity('test:room/cube'));
    return { ...game, logger };
  }

  it('moving an entity updates its location and indexes and emits entityMoved', () => {
    const { engine, world, events } = setup();
    const result = engine.locations.move('test:room/ball', { kind: 'container', containerId: 'test:room/box', slot: 0 });
    expect(result).toEqual({ ok: true });
    expect(world.get('test:room/ball')!.location).toEqual({ kind: 'container', containerId: 'test:room/box', slot: 0 });
    expect(world.index.inContainer('test:room/box')[0]).toBe('test:room/ball');
    expect(events.at(-1)).toEqual({
      type: 'entityMoved',
      id: 'test:room/ball',
      from: { kind: 'scene', sceneId: 'test:room' },
      to: { kind: 'container', containerId: 'test:room/box', slot: 0 },
    });
  });

  it('dev: occupying a taken slot throws an invariant error naming container and slot', () => {
    const { engine } = setup();
    engine.locations.move('test:room/ball', { kind: 'container', containerId: 'test:room/box', slot: 0 });
    expect(() =>
      engine.locations.move('test:room/cube', { kind: 'container', containerId: 'test:room/box', slot: 0 }),
    ).toThrow(InvariantError);
    expect(() =>
      engine.locations.move('test:room/cube', { kind: 'container', containerId: 'test:room/box', slot: 0 }),
    ).toThrow(/test:room\/box.*"slot":0/);
  });

  it('prod: occupying a taken slot is rejected, the object stays and a warning is logged', () => {
    const { engine, world, logger } = setup(false);
    engine.locations.move('test:room/ball', { kind: 'container', containerId: 'test:room/box', slot: 0 });
    const result = engine.locations.move('test:room/cube', { kind: 'container', containerId: 'test:room/box', slot: 0 });
    expect(result).toEqual({ ok: false, reason: 'occupied' });
    expect(world.get('test:room/cube')!.location.kind).toBe('scene');
    expect(logger.entries.some((e) => e.level === 'warn')).toBe(true);
  });

  it('rejects a missing target and self references', () => {
    const { engine } = setup(false);
    expect(engine.locations.move('test:room/ball', { kind: 'held', holderId: 'ghost', hand: 'left' })).toEqual({
      ok: false,
      reason: 'targetNotFound',
    });
    expect(
      engine.locations.move('test:room/box', { kind: 'container', containerId: 'test:room/box', slot: 0 }),
    ).toEqual({ ok: false, reason: 'selfReference' });
  });

  it('derives held, worn and inventory indexes', () => {
    const { engine, world } = setup();
    world.create(entity('char'));
    engine.locations.move('test:room/ball', { kind: 'held', holderId: 'char', hand: 'right' });
    engine.locations.move('test:room/cube', { kind: 'inventory', slot: 2 });
    world.create(entity('shirt', { location: { kind: 'worn', characterId: 'char', slot: 'top' } }));
    expect(world.index.heldBy('char')).toEqual(['test:room/ball']);
    expect(world.index.wornBy('char')).toEqual({ top: 'shirt' });
    expect(world.index.inventory()).toEqual([null, null, 'test:room/cube']);
  });

  it('rollback restores indexes', () => {
    const { engine, world } = setup();
    expect(() =>
      world.transaction(() => {
        engine.locations.move('test:room/ball', { kind: 'inventory', slot: 0 });
        throw new Error('abort');
      }),
    ).toThrow('abort');
    expect(world.index.inventory()).toEqual([]);
    expect(engine.locations.move('test:room/cube', { kind: 'inventory', slot: 0 })).toEqual({ ok: true });
  });
});
