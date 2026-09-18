import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { GameEngine, type GameEngineOptions } from '@/engine/core/engine';

import { createGameFacade, type GameFacade, type GameFacadeOptions } from './facade';

const GameContext = createContext<GameFacade | null>(null);

export interface GameProviderProps {
  children: ReactNode;
  /** Injected facade (tests). When absent, one engine is created for the app lifetime. */
  facade?: GameFacade;
  engineOptions?: GameEngineOptions;
  facadeOptions?: GameFacadeOptions;
}

/** Exposes the single GameEngine instance through React context (GAME_ENGINE §2, no module singletons). */
export function GameProvider({ children, facade, engineOptions, facadeOptions }: GameProviderProps) {
  const value = useMemo(
    () => facade ?? createGameFacade(GameEngine.create(engineOptions), facadeOptions),
    // The engine lives as long as the provider; options are read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [facade],
  );
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameFacade {
  const facade = useContext(GameContext);
  if (!facade) throw new Error('useGame must be used inside <GameProvider>');
  return facade;
}
