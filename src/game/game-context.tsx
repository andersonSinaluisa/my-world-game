import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';

import type { GameFacade } from './facade';
import type { GameSession } from './session';

const GameContext = createContext<GameFacade | null>(null);
const SessionContext = createContext<GameSession | null>(null);

export interface GameProviderProps {
  children: ReactNode;
  /** Injected facade (tests, sandbox). */
  facade?: GameFacade;
  /** App session: engine + bundled content + persistence. Created once for the app lifetime. */
  createSession?: () => GameSession;
}

/** Exposes the single GameEngine instance through React context (GAME_ENGINE §2, no module singletons). */
export function GameProvider({ children, facade, createSession }: GameProviderProps) {
  const session = useMemo(
    () => (facade ? null : (createSession?.() ?? null)),
    // The session lives as long as the provider; the factory is read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [facade],
  );
  useEffect(() => () => session?.dispose(), [session]);
  const value = facade ?? session?.facade ?? null;
  if (!value) throw new Error('GameProvider needs a facade or a createSession factory');
  return (
    <SessionContext.Provider value={session}>
      <GameContext.Provider value={value}>{children}</GameContext.Provider>
    </SessionContext.Provider>
  );
}

export function useGame(): GameFacade {
  const facade = useContext(GameContext);
  if (!facade) throw new Error('useGame must be used inside <GameProvider>');
  return facade;
}

/** The app session (null when the provider was given a bare facade, e.g. in tests). */
export function useGameSession(): GameSession | null {
  return useContext(SessionContext);
}
