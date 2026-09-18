import type { EntityId } from '../core/types';
import type { SaveSlotData, SavedEntity } from './save-store';

/** Current format of the saved data (SAVE_SCHEMA §5). v1 = 1. */
export const CURRENT_SAVE_VERSION = 1;

/** Logical view of a whole slot (SAVE_SCHEMA §1), used by migrations. */
export interface GameSave {
  slot: SaveSlotData;
  entities: SavedEntity[];
  removed: EntityId[];
}

/** Pure, chained, idempotent per step (SAVE_SCHEMA §5 rule 1). One per saveVersion bump. */
export interface Migration {
  from: number;
  to: number;
  migrate(save: GameSave): GameSave;
}

/** Real migrations of the game. Empty in the MVP: only saveVersion 1 exists (HU-GAME-072). */
export const MIGRATIONS: Migration[] = [];

export class MigrationError extends Error {}

/** Applies the chain from save.slot.saveVersion up to `target`. Throws MigrationError on gaps. */
export function migrateSave(save: GameSave, target: number, migrations: Migration[]): GameSave {
  let current = save;
  while (current.slot.saveVersion < target) {
    const step = migrations.find((m) => m.from === current.slot.saveVersion);
    if (!step) throw new MigrationError(`No migration from saveVersion ${current.slot.saveVersion}`);
    current = step.migrate(current);
    if (current.slot.saveVersion !== step.to) {
      current = { ...current, slot: { ...current.slot, saveVersion: step.to } };
    }
  }
  return current;
}
