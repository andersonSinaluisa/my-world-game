import { SqliteSaveStore } from '@/engine/adapters/sqlite/sqlite-save-store';

import { GameSession } from './session';

/** The real app session: bundled content + SQLite saves (ADR-006). */
export function createAppSession(): GameSession {
  return new GameSession(() => SqliteSaveStore.open());
}
