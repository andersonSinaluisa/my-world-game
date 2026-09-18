import { entity, TEST_SCENE_ID } from '@/test/builders';
import { createTestGame, createTestLogger } from '@/test/create-test-game';

import { ComponentValidationError } from '../components/registry';
import type { GameEvent } from './events';
import { InvariantError } from './world';

describe('World (HU-GAME-003)', () => {
  it('creating an entity emits entityCreated', () => {
    const { world, events } = createTestGame();
    world.create(entity('test:room/ball', { at: { x: 100, y: 960 } }));
    expect(world.get('test:room/ball')?.components.transform).toEqual({ x: 100, y: 960 });
    expect(events).toEqual([{ type: 'entityCreated', id: 'test:room/ball' }]);
  });

  it('update keeps references of untouched components', () => {
    const { world, events } = createTestGame();
    world.create(entity('a', { components: { sprite: { asset: 'x', layer: 'props' } } }));
    const before = world.get('a')!;
    world.update('a', { transform: { ...before.components.transform!, x: 500 } });
    const after = world.get('a')!;
    expect(after.components.transform!.x).toBe(500);
    expect(after.components.sprite).toBe(before.components.sprite);
    expect(events.at(-1)).toEqual({ type: 'entityChanged', id: 'a', components: ['transform'] });
  });

  it('publishes transaction events together at the end, in order', () => {
    const { engine, world } = createTestGame();
    ['a', 'b', 'c'].forEach((id) => world.create(entity(id)));
    const batches: (readonly GameEvent[])[] = [];
    engine.events.subscribe((b) => batches.push(b));
    world.transaction(() => {
      for (const id of ['a', 'b', 'c']) {
        world.update(id, { transform: { x: 1, y: 2 } });
        expect(batches).toHaveLength(0);
      }
    });
    expect(batches).toHaveLength(1);
    expect(batches[0].map((e) => (e as { id: string }).id)).toEqual(['a', 'b', 'c']);
  });

  it('a failing transaction leaves no trace', () => {
    const { engine, world } = createTestGame();
    world.create(entity('a', { at: { x: 100, y: 960 } }));
    const listener = jest.fn();
    engine.events.subscribe(listener);
    expect(() =>
      world.transaction(() => {
        world.update('a', { transform: { x: 500, y: 960 } });
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(world.get('a')!.components.transform!.x).toBe(100);
    expect(listener).not.toHaveBeenCalled();
  });

  it('rejects unknown components with a validation error naming them', () => {
    const { world } = createTestGame();
    expect(() => world.create(entity('a', { components: { flying: {} } }))).toThrow(ComponentValidationError);
    expect(() => world.create(entity('a', { components: { flying: {} } }))).toThrow(/flying/);
  });

  it('rejects unknown fields and out-of-range values (strict schemas)', () => {
    const { world } = createTestGame();
    expect(() => world.create(entity('a', { components: { transform: { x: 0, y: 0, z: 3 } } }))).toThrow(
      ComponentValidationError,
    );
    expect(() => world.create(entity('b', { components: { transform: { x: 0, y: 0, scale: 9 } } }))).toThrow(
      /scale/,
    );
  });

  it('checks cross-component dependencies (openable requires states)', () => {
    const { world } = createTestGame();
    expect(() =>
      world.create(entity('a', { components: { openable: { openState: 'open', closedState: 'closed' } } })),
    ).toThrow(/openable requires states/);
  });

  it('queries by components, tags, scene and location kind', () => {
    const { world } = createTestGame();
    world.create(entity('a', { tags: ['toy'], components: { draggable: {} } }));
    world.create(entity('b', { tags: ['furniture'] }));
    world.create(entity('c', { location: { kind: 'limbo' } }));
    expect(world.query({ has: ['draggable'] }).map((e) => e.id)).toEqual(['a']);
    expect(world.query({ tags: ['furniture'] }).map((e) => e.id)).toEqual(['b']);
    expect(world.query({ sceneId: TEST_SCENE_ID }).map((e) => e.id)).toEqual(['a', 'b']);
    expect(world.query({ locationKind: 'limbo' }).map((e) => e.id)).toEqual(['c']);
    expect(world.query()).toHaveLength(3);
  });

  it('freezes returned entities in dev mode', () => {
    const { world } = createTestGame();
    world.create(entity('a'));
    expect(Object.isFrozen(world.get('a'))).toBe(true);
    expect(Object.isFrozen(world.get('a')!.components.transform)).toBe(true);
  });

  describe('invariants', () => {
    it('dev: updating a missing entity throws', () => {
      const { world } = createTestGame();
      expect(() => world.update('nope', { transform: { x: 0, y: 0 } })).toThrow(InvariantError);
    });

    it('prod: updating a missing entity is a logged no-op', () => {
      const logger = createTestLogger();
      const { world } = createTestGame({ dev: false, logger });
      expect(world.update('nope', { transform: { x: 0, y: 0 } })).toBeUndefined();
      expect(logger.entries.some((e) => e.level === 'warn' && e.message.includes('nope'))).toBe(true);
    });
  });

  it('removing an entity emits entityRemoved and frees its slot', () => {
    const { world, events } = createTestGame();
    world.create(entity('box'));
    world.create(entity('ball', { location: { kind: 'container', containerId: 'box', slot: 0 } }));
    world.remove('ball');
    expect(world.index.inContainer('box')).toEqual([]);
    expect(events.at(-1)).toEqual({ type: 'entityRemoved', id: 'ball' });
  });
});
