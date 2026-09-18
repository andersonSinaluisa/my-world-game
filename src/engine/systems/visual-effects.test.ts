import { entity } from '@/test/builders';
import { createTestGame } from '@/test/create-test-game';

import { presetFor } from './visual-effects';

describe('visual effects (HU-GAME-009)', () => {
  function setup() {
    const game = createTestGame();
    game.world.create(entity('ball', { components: { animations: { drop: 'squash' } } }));
    game.world.create(entity('plain'));
    return game;
  }

  it('picks the preset from the animations component', () => {
    const { world } = setup();
    expect(presetFor(world.get('ball')!, 'drop')).toBe('squash');
    expect(presetFor(world.get('ball')!, 'tap')).toBeUndefined();
  });

  it('emits visualEffect only when a preset exists', () => {
    const { engine, events } = setup();
    const before = events.length;
    engine.effects.trigger('ball', 'tap');
    expect(events.length).toBe(before);
    engine.effects.trigger('ball', 'drop');
    expect(events.at(-1)).toEqual({ type: 'visualEffect', entityId: 'ball', preset: 'squash' });
  });

  it('a rejection always shakes the target', () => {
    const { engine, events } = setup();
    engine.effects.rejected('plain');
    expect(events.at(-1)).toEqual({ type: 'visualEffect', entityId: 'plain', preset: 'shake' });
  });

  it('effects never change logical state', () => {
    const { engine, world, events } = setup();
    const before = world.get('ball');
    engine.effects.trigger('ball', 'drop');
    expect(world.get('ball')).toBe(before);
    expect(events.filter((e) => e.type === 'entityChanged' || e.type === 'entityMoved')).toHaveLength(0);
  });

  it('unknown presets are rejected by the schema', () => {
    const { world } = createTestGame();
    expect(() => world.create(entity('x', { components: { animations: { tap: 'explode' } } }))).toThrow(
      /animations\.tap/,
    );
  });
});
