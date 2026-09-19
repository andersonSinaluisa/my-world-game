import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { createGameFacade } from '@/game/facade';
import { GameProvider } from '@/game/game-context';
import { createTestGame } from '@/test/create-test-game';
import { withCharacters } from '@/test/fixtures/test-characters';
import { testPack } from '@/test/fixtures/test-content';

import CharactersScreen from '@/app/characters';
import CreatorScreen from '@/app/creator';

// The preview is the Skia character renderer: verified on devices, not in Jest.
jest.mock('@/game/character-preview', () => ({ CharacterPreview: () => null }));

const mockRouter = { back: jest.fn(), push: jest.fn(), dismissTo: jest.fn(), replace: jest.fn(), dismissAll: jest.fn(), canGoBack: () => true };
let mockParams: { id?: string } = {};
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(cb, [cb]);
  },
  Link: ({ children }: { children: unknown }) => children,
}));

const mockSession = { textures: {}, assetSource: () => undefined, flush: jest.fn(async () => {}), requestFocus: jest.fn(), uiTap: jest.fn(), start: jest.fn(async () => 'loaded') };
jest.mock('@/game/game-context', () => {
  const actual = jest.requireActual('@/game/game-context');
  return { ...actual, useGameSession: () => mockSession };
});

function setup(mutate?: (parts: Record<string, unknown[]>) => void) {
  const pack = withCharacters(testPack());
  mutate?.(pack.characters!.data as Record<string, unknown[]>);
  const game = createTestGame({ packs: [pack], enter: { sceneId: 'test:room' } });
  const facade = createGameFacade(game.engine);
  return { game, facade };
}

beforeEach(() => {
  mockParams = {};
  jest.clearAllMocks();
});

describe('creator screen (HU-GAME-018..022)', () => {
  it('shows the options of the content: 3 bodies and 4 skin tones', async () => {
    const { facade } = setup((parts) => {
      parts.bodyTypes.push({ ...(parts.bodyTypes[0] as object), id: 'baby', name: 'body.child.name' });
      parts.skinTones.push({ id: 'skin_09', color: '#123456' });
    });
    await render(
      <GameProvider facade={facade}>
        <CreatorScreen />
      </GameProvider>,
    );
    expect(screen.getAllByRole('button', { name: /body\.(child|adult)\.name/ })).toHaveLength(3);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'ui.creator.tab.skin' })));
    expect(screen.getAllByRole('button', { name: /^skin_0/ })).toHaveLength(4);
  });

  it('confirm creates the character and returns to play focusing it', async () => {
    const { facade, game } = setup();
    await render(
      <GameProvider facade={facade}>
        <CreatorScreen />
      </GameProvider>,
    );
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'ui.creator.confirm' })));
    const chars = game.world.query({ has: ['character'] });
    expect(chars).toHaveLength(1);
    expect(mockSession.requestFocus).toHaveBeenCalledWith(chars[0].id);
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/play');
  });

  it('back without confirming creates nothing', async () => {
    const { facade, game } = setup();
    await render(
      <GameProvider facade={facade}>
        <CreatorScreen />
      </GameProvider>,
    );
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'ui.creator.tab.face' })));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'eyes_dot' })));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'ui.back.label' })));
    expect(game.world.query({ has: ['character'] })).toHaveLength(0);
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('edit mode sends only the changed fields', async () => {
    const { facade, game } = setup();
    const r = facade.dispatch({ type: 'createCharacter', appearance: { bodyType: 'child', skinTone: 'skin_01', eyes: 'eyes_round', mouth: 'mouth_smile', hairStyle: 'hair_buns', hairColor: 'hair_black' }, outfit: {} });
    mockParams = { id: r.ok ? r.entityId : undefined };
    const spy = jest.spyOn(facade, 'dispatch');
    await render(
      <GameProvider facade={facade}>
        <CreatorScreen />
      </GameProvider>,
    );
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'ui.creator.tab.hair' })));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'hair_berry' })));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'ui.creator.confirm' })));
    expect(spy).toHaveBeenCalledWith({ type: 'updateAppearance', characterId: mockParams.id, patch: { hairColor: 'hair_berry' } });
    expect(game.world.get(mockParams.id!)?.components.appearance?.hairColor).toBe('hair_berry');
  });
});

describe('characters screen (HU-GAME-022 R2)', () => {
  it('with 12 characters "new" shakes instead of opening the creator', async () => {
    const { facade } = setup();
    for (let i = 0; i < 12; i++) {
      facade.dispatch({ type: 'createCharacter', appearance: { bodyType: 'child', skinTone: 'skin_01', eyes: 'eyes_round', mouth: 'mouth_smile', hairStyle: 'hair_buns', hairColor: 'hair_black' }, outfit: {} });
    }
    await render(
      <GameProvider facade={facade}>
        <CharactersScreen />
      </GameProvider>,
    );
    expect(screen.getAllByRole('button', { name: 'ui.characters.edit' })).toHaveLength(12);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'ui.characters.full' })));
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

describe('backpack HUD (HU-GAME-037/038)', () => {
  it('the tray shows the 12 slots with the stored item', async () => {
    const { Backpack } = jest.requireActual('@/game/backpack') as typeof import('@/game/backpack');
    const { facade, game } = setup();
    game.engine.setPlayerState({ inventory: { capacity: 12 } });
    const p = game.content!.prefab('test:ball')!;
    game.world.create({ id: 'rt_ball', prefabId: p.qualifiedId, tags: ['toy'], location: { kind: 'inventory', slot: 0 }, components: { ...p.components, transform: { x: 0, y: 0 } } });
    await render(
      <GameProvider facade={facade}>
        <Backpack cameraRef={{ current: null }} onBounds={() => {}} />
      </GameProvider>,
    );
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'ui.backpack.label' })));
    expect(screen.getAllByLabelText('ui.backpack.empty')).toHaveLength(11);
    expect(screen.getByLabelText('Pelota')).toBeTruthy();
  });
});

describe('title and settings (HU-GAME-073/075)', () => {
  it('without a save only "create a character" is offered', async () => {
    const TitleScreen = jest.requireActual('@/app/index').default;
    (mockSession as unknown as { inspect: () => Promise<string> }).inspect = async () => 'none';
    const { facade } = setup();
    await render(
      <GameProvider facade={facade}>
        <TitleScreen />
      </GameProvider>,
    );
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Jugar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'ui.title.create' })).toBeTruthy();
  });

  it('with a save, Continue and Create are shown; the gear never opens settings with a tap', async () => {
    const TitleScreen = jest.requireActual('@/app/index').default;
    (mockSession as unknown as { inspect: () => Promise<string> }).inspect = async () => 'save';
    const { facade } = setup();
    await render(
      <GameProvider facade={facade}>
        <TitleScreen />
      </GameProvider>,
    );
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Jugar' })).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'ui.settings.open' })));
    expect(mockRouter.push).not.toHaveBeenCalledWith('/settings');
  });

  it('settings: changing the effects volume dispatches setSetting', async () => {
    const SettingsScreen = jest.requireActual('@/app/settings').default;
    const { facade, game } = setup();
    await render(
      <GameProvider facade={facade}>
        <SettingsScreen />
      </GameProvider>,
    );
    const minus = screen.getAllByRole('button', { name: '−' });
    await act(async () => fireEvent.press(minus[1]));
    expect(game.engine.settings.sfxVolume).toBe(0.8);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'English' })));
    expect(game.engine.settings.language).toBe('en');
  });
});

/**
 * HU-GAME-070 RN-1/RN-2/RN-5: every button has a label and an explicit touch area of at least 64 dp
 * (child screens) or 48 dp (adult screens). Size = explicit width/height or minWidth/minHeight, plus hitSlop.
 */
function touchIssues(min: number, minButtons = 2): string[] {
  const { StyleSheet } = jest.requireActual('react-native') as typeof import('react-native');
  const issues: string[] = [];
  const buttons = screen.getAllByRole('button');
  if (buttons.length < minButtons) issues.push(`only ${buttons.length} buttons found`);
  for (const b of buttons) {
    const label = b.props.accessibilityLabel as string | undefined;
    if (!label) issues.push(`button without accessibilityLabel (${JSON.stringify(b.props.testID ?? '')})`);
    const s = (StyleSheet.flatten(b.props.style) ?? {}) as Record<string, unknown>;
    const slop = typeof b.props.hitSlop === 'number' ? b.props.hitSlop * 2 : 0;
    const side = (a: string, m: string) => Math.max(Number(s[a]) || 0, Number(s[m]) || 0) + slop;
    if (side('width', 'minWidth') < min || side('height', 'minHeight') < min) {
      issues.push(`${label}: ${side('width', 'minWidth')}×${side('height', 'minHeight')} < ${min}`);
    }
  }
  return issues;
}

describe('touch targets and labels (HU-GAME-070)', () => {
  it('title (child UI): ≥ 64 dp and labelled', async () => {
    const TitleScreen = jest.requireActual('@/app/index').default;
    (mockSession as unknown as { inspect: () => Promise<string> }).inspect = async () => 'save';
    const { facade } = setup();
    await render(
      <GameProvider facade={facade}>
        <TitleScreen />
      </GameProvider>,
    );
    await act(async () => {});
    expect(touchIssues(64)).toEqual([]);
  });

  it('creator and characters (child UI): ≥ 64 dp and labelled', async () => {
    const { facade } = setup();
    facade.dispatch({ type: 'createCharacter', appearance: { bodyType: 'child', skinTone: 'skin_01', eyes: 'eyes_round', mouth: 'mouth_smile', hairStyle: 'hair_buns', hairColor: 'hair_black' }, outfit: {} });
    const view = await render(
      <GameProvider facade={facade}>
        <CreatorScreen />
      </GameProvider>,
    );
    expect(touchIssues(64)).toEqual([]);
    await view.unmount();
    await render(
      <GameProvider facade={facade}>
        <CharactersScreen />
      </GameProvider>,
    );
    expect(touchIssues(64)).toEqual([]);
  });

  it('settings (adult UI): ≥ 48 dp and labelled', async () => {
    const SettingsScreen = jest.requireActual('@/app/settings').default;
    const { facade } = setup();
    await render(
      <GameProvider facade={facade}>
        <SettingsScreen />
      </GameProvider>,
    );
    expect(touchIssues(48)).toEqual([]);
  });
});

describe('map (HU-GAME-051)', () => {
  it('lists the locations, travels to another one, closes on the current one and jumps to zones', async () => {
    const { MapOverlay } = jest.requireActual('@/game/map-overlay') as typeof import('@/game/map-overlay');
    const pack = withCharacters(testPack());
    (pack.manifest.data as { provides: Record<string, unknown> }).provides.locations = [
      { id: 'room', name: 'scene.room.name', icon: 'test_obj_ball', entrySceneId: 'room', entrySpawnId: 'default' },
      { id: 'hall', name: 'scene.hall.name', icon: 'test_obj_ball', entrySceneId: 'hall', entrySpawnId: 'door' },
    ];
    const game = createTestGame({ packs: [pack], enter: { sceneId: 'test:room' } });
    const facade = createGameFacade(game.engine);
    const onClose = jest.fn();
    const onZone = jest.fn();
    await render(
      <GameProvider facade={facade}>
        <MapOverlay visible onClose={onClose} onZone={onZone} />
      </GameProvider>,
    );
    expect(touchIssues(64)).toEqual([]);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Cuarto' })));
    expect(game.engine.scene?.id).toBe('test:room');
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Derecha' })));
    expect(onZone).toHaveBeenCalledWith('right');
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Pasillo' })));
    expect(game.engine.scene?.id).toBe('test:hall');
  });
});

describe('wallet HUD (HU-GAME-065/067)', () => {
  it('shows the coins and claims the daily gift once', async () => {
    const { CoinCounter, GiftBox } = jest.requireActual('@/game/wallet-hud') as typeof import('@/game/wallet-hud');
    const pack = withCharacters(testPack());
    (pack.manifest.data as { newGame: Record<string, unknown> }).newGame = { sceneId: 'test:room', spawnId: 'default', coins: 50, dailyGiftCoins: 10, unlocks: [], inventoryCapacity: 12 };
    const game = createTestGame({ packs: [pack], enter: { sceneId: 'test:room' } });
    game.engine.setPlayerState({ ...game.engine.playerState, wallet: { coins: 50 } });
    const facade = createGameFacade(game.engine);
    await render(
      <GameProvider facade={facade}>
        <CoinCounter />
        <GiftBox />
      </GameProvider>,
    );
    expect(screen.getByLabelText('50 ui.wallet.label')).toBeTruthy();
    expect(touchIssues(64, 1)).toEqual([]);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'ui.gift.open' })));
    expect(screen.getByLabelText('60 ui.wallet.label')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'ui.gift.open' })).toBeNull();
  });
});
