import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { entity } from '@/test/builders';
import { createTestGame } from '@/test/create-test-game';
import { TEST_ASSET_SIZES, TEST_ROOM, testRoomEntities } from '@/test/fixtures/test-pack';

import { createGameFacade } from './facade';
import { GameProvider } from './game-context';
import { useEntity } from './hooks';

function setup() {
  const game = createTestGame({ scene: TEST_ROOM, entities: testRoomEntities() });
  const facade = createGameFacade(game.engine, { assetSize: (k) => TEST_ASSET_SIZES[k] });
  return { ...game, facade };
}

describe('GameFacade (HU-GAME-004)', () => {
  it('entity subscriptions are granular', () => {
    const { facade, world } = setup();
    const onBall = jest.fn();
    facade.subscribeEntity('test:room/ball', onBall);
    world.update('test:room/table', { transform: { x: 1300, y: 960 } });
    expect(onBall).not.toHaveBeenCalled();
  });

  it('notifies once per transaction', () => {
    const { facade, world } = setup();
    const onBall = jest.fn();
    facade.subscribeEntity('test:room/ball', onBall);
    world.transaction(() => {
      for (const x of [1, 2, 3]) world.update('test:room/ball', { transform: { x, y: 960 } });
    });
    expect(onBall).toHaveBeenCalledTimes(1);
  });

  it('keeps a stable snapshot while nothing changes', () => {
    const { facade, world } = setup();
    const a = facade.getSnapshot();
    expect(facade.getSnapshot()).toBe(a);
    world.update('test:room/ball', { transform: { x: 5, y: 960 } });
    expect(facade.getSnapshot()).not.toBe(a);
  });

  it('visual effects do not change the snapshot', () => {
    const { facade } = setup();
    const a = facade.getSnapshot();
    facade.dev.playEffect('test:room/ball', 'bounce');
    expect(facade.getSnapshot()).toBe(a);
  });

  it('an invalid command reaches the UI as a result, not an exception', () => {
    const { facade } = setup();
    expect(() => facade.dispatch({ type: 'dragStart', entityId: 'ghost', worldPoint: { x: 0, y: 0 } })).not.toThrow();
    expect(facade.dispatch({ type: 'dragStart', entityId: 'ghost', worldPoint: { x: 0, y: 0 } })).toEqual({
      ok: false,
      reason: 'entityNotFound',
    });
  });

  it('visibleEntities returns sorted render data for scene entities only', () => {
    const { facade, world, engine } = setup();
    world.create(entity('test:room/in_box', { location: { kind: 'container', containerId: 'test:room/box', slot: 0 } }));
    engine.world.update('test:room/lamp', { states: { current: 'on', values: ['off', 'on'] } });
    const data = facade.selectors.visibleEntities();
    expect(data.map((d) => d.id)).not.toContain('test:room/in_box');
    expect(data).toHaveLength(5);
    expect(data.map((d) => d.layer)).toEqual(['furniture', 'furniture', 'furniture', 'props', 'characters']);
    expect(data.find((d) => d.id === 'test:room/lamp')!.asset).toBe('test_env_lamp_on');
    expect(data.every((d, i) => d.order === i)).toBe(true);
  });

  it('visibleEntities culls by viewport and memoizes per version', () => {
    const { facade } = setup();
    const first = facade.selectors.visibleEntities({ cameraX: 0, viewportW: 1000 });
    expect(first.map((d) => d.id).sort()).toEqual(['test:room/ball', 'test:room/character', 'test:room/table']);
    expect(facade.selectors.visibleEntities({ cameraX: 0, viewportW: 1000 })).toBe(first);
  });

  it('queues commands dispatched from listeners', () => {
    const { facade } = setup();
    const results: unknown[] = [];
    facade.subscribe(() => {
      results.push(facade.dispatch({ type: 'cameraSettled', cameraX: 10, viewportW: 1000 }));
    });
    facade.dispatch({ type: 'cameraSettled', cameraX: 500, viewportW: 1000 });
    expect(results[0]).toEqual({ ok: true });
  });
});

describe('hooks (HU-GAME-004)', () => {
  it('useEntity re-renders only its entity and cleans up on unmount', async () => {
    const { facade, world } = setup();
    const renders: Record<string, number> = { a: 0, b: 0 };
    function Probe({ id, name }: { id: string; name: 'a' | 'b' }) {
      renders[name]++;
      const e = useEntity(id);
      return <Text>{String(e?.components.transform?.x)}</Text>;
    }
    const view = await render(
      <GameProvider facade={facade}>
        <Probe id="test:room/ball" name="a" />
        <Probe id="test:room/table" name="b" />
      </GameProvider>,
    );
    const before = { ...renders };
    await act(async () => {
      world.update('test:room/ball', { transform: { x: 777, y: 960 } });
    });
    expect(renders.a).toBe(before.a + 1);
    expect(renders.b).toBe(before.b);
    expect(view.getByText('777')).toBeTruthy();
    await view.unmount();
    expect(facade.entityListenerCount('test:room/ball')).toBe(0);
  });

  it('useEntity returns undefined when the entity is removed', async () => {
    const { facade, world } = setup();
    function Probe() {
      const e = useEntity('test:room/ball');
      return <Text>{e ? 'present' : 'gone'}</Text>;
    }
    const view = await render(
      <GameProvider facade={facade}>
        <Probe />
      </GameProvider>,
    );
    await act(async () => {
      world.remove('test:room/ball');
    });
    expect(view.getByText('gone')).toBeTruthy();
  });
});
