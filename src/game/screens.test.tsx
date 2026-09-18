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

const mockRouter = { back: jest.fn(), push: jest.fn(), dismissTo: jest.fn() };
let mockParams: { id?: string } = {};
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => mockParams,
}));

const mockSession = { textures: {}, assetSource: () => undefined, flush: jest.fn(async () => {}), requestFocus: jest.fn() };
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
