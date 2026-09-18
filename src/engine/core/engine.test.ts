import { createSeededRandom } from './runtime';
import { createTestGame } from '@/test/create-test-game';
import { FakeClock } from '@/test/fake-clock';
import { TEST_ROOM, testRoomEntities } from '@/test/fixtures/test-pack';

describe('GameEngine (HU-GAME-003 / HU-GAME-007)', () => {
  it('an unknown command does not throw', () => {
    const { dispatch } = createTestGame();
    expect(dispatch({ type: 'fly' } as never)).toEqual({ ok: false, reason: 'unknownCommand' });
    expect(dispatch(undefined as never)).toEqual({ ok: false, reason: 'unknownCommand' });
  });

  it('runtime ids are deterministic for the same clock and seed', () => {
    const a = createTestGame({ clock: new FakeClock(), random: createSeededRandom(7) });
    const b = createTestGame({ clock: new FakeClock(), random: createSeededRandom(7) });
    const idA = a.engine.newRuntimeId();
    expect(idA).toMatch(/^rt_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(b.engine.newRuntimeId()).toBe(idA);
  });

  it('activateScene loads entities in one batch and emits sceneLoaded', () => {
    const game = createTestGame();
    game.engine.activateScene(TEST_ROOM, testRoomEntities());
    expect(game.world.query({ sceneId: 'test:room' })).toHaveLength(5);
    expect(game.events.at(-1)).toEqual({ type: 'sceneLoaded', to: 'test:room' });
    expect(game.engine.playerState.currentSceneId).toBe('test:room');
  });

  describe('cameraSettled', () => {
    it('updates player.cameraX once', () => {
      const game = createTestGame({ scene: TEST_ROOM });
      const before = game.events.length;
      expect(game.dispatch({ type: 'cameraSettled', cameraX: 1234, viewportW: 2338 })).toEqual({ ok: true });
      expect(game.engine.playerState.cameraX).toBe(1234);
      expect(game.events.slice(before)).toEqual([{ type: 'playerChanged', keys: ['cameraX'] }]);
    });

    it('clamps to the scene bounds', () => {
      const game = createTestGame({ scene: TEST_ROOM });
      game.dispatch({ type: 'cameraSettled', cameraX: 5000, viewportW: 2338 });
      expect(game.engine.playerState.cameraX).toBe(1502);
    });

    it('fails without an active scene or with invalid values', () => {
      const game = createTestGame();
      expect(game.dispatch({ type: 'cameraSettled', cameraX: 0, viewportW: 2338 })).toEqual({
        ok: false,
        reason: 'noActiveScene',
      });
      expect(game.dispatch({ type: 'cameraSettled', cameraX: NaN, viewportW: 2338 })).toEqual({
        ok: false,
        reason: 'invalidCommand',
      });
    });
  });

  it('dragStart on a missing entity reports entityNotFound', () => {
    const { dispatch } = createTestGame();
    expect(dispatch({ type: 'dragStart', entityId: 'ghost', worldPoint: { x: 0, y: 0 } })).toEqual({
      ok: false,
      reason: 'entityNotFound',
    });
  });
});
