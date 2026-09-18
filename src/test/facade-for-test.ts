import { createGameFacade, type GameFacade } from '@/game/facade';

import type { TestGame } from './create-test-game';

/** A facade over a headless test game, for selectors used by the renderer (no React). */
export function createFacadeForTest(game: TestGame): GameFacade {
  return createGameFacade(game.engine);
}
