import { GameEngine } from '@/engine/core/engine';

import { createGameFacade, type GameFacade } from './facade';

/** Bare engine without content or saves, for the dev render sandbox (EPIC-002 manual checks). */
export function createSandboxFacade(): GameFacade {
  return createGameFacade(GameEngine.create());
}
