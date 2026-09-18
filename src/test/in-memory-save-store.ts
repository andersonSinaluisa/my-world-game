import type { SceneId, EntityId } from '@/engine/core/types';
import type { SaveSlotData, SaveStore, SavedEntity, WriteBatch } from '@/engine/persistence/save-store';

interface StoreState {
  slots: Record<string, string>; // JSON SaveSlotData
  entities: Record<string, Record<string, { sceneId?: string; data: string }>>; // slot → id → row
  removed: Record<string, string[]>;
}

const empty = (): StoreState => ({ slots: {}, entities: {}, removed: {} });

/** Serializes like SQLite would: functions, undefined in arrays and cycles are rejected. */
function strictJson(value: unknown): string {
  // JSON.stringify already throws on circular references.
  return JSON.stringify(value, (_key, v) => {
    if (typeof v === 'function') throw new TypeError('Non-serializable value: function');
    if (typeof v === 'symbol' || typeof v === 'bigint') throw new TypeError(`Non-serializable value: ${typeof v}`);
    if (Array.isArray(v) && v.some((item) => item === undefined)) throw new TypeError('Non-serializable value: undefined in array');
    return v;
  });
}

/**
 * SaveStore for the headless harness (SAVE_SYSTEM §2). Same contract as SqliteSaveStore:
 * JSON-serialized rows, atomic writeBatch, backup/restore. Exposes counters for autosave tests.
 */
export class InMemorySaveStore implements SaveStore {
  private state: StoreState = empty();
  private backupState: StoreState | undefined;
  writeBatchCount = 0;
  rowsWritten = 0;

  async loadSlot(slotId: string): Promise<SaveSlotData | undefined> {
    const raw = this.state.slots[slotId];
    return raw ? (JSON.parse(raw) as SaveSlotData) : undefined;
  }

  async loadEntities(slotId: string, sceneId?: SceneId): Promise<SavedEntity[]> {
    const rows = Object.values(this.state.entities[slotId] ?? {});
    return rows.filter((r) => sceneId === undefined || r.sceneId === sceneId).map((r) => JSON.parse(r.data) as SavedEntity);
  }

  async loadRemoved(slotId: string): Promise<EntityId[]> {
    return [...(this.state.removed[slotId] ?? [])];
  }

  async writeBatch(batch: WriteBatch): Promise<void> {
    // Serialize everything first: any failure aborts before touching state (atomicity).
    const rows = batch.upserts.map((e) => ({
      id: e.id,
      sceneId: e.location.kind === 'scene' ? e.location.sceneId : undefined,
      data: strictJson(e),
    }));
    const slotJson = batch.slot ? strictJson(batch.slot) : undefined;
    const next: StoreState = JSON.parse(JSON.stringify(this.state));
    const entities = (next.entities[batch.slotId] ??= {});
    for (const row of rows) entities[row.id] = { sceneId: row.sceneId, data: row.data };
    const removed = new Set(next.removed[batch.slotId] ?? []);
    for (const id of batch.removals) {
      delete entities[id];
      removed.add(id);
    }
    next.removed[batch.slotId] = [...removed];
    if (slotJson) next.slots[batch.slotId] = slotJson;
    this.state = next;
    this.writeBatchCount++;
    this.rowsWritten += rows.length;
  }

  async backup(): Promise<void> {
    this.backupState = JSON.parse(JSON.stringify(this.state));
  }

  async restoreBackup(): Promise<void> {
    if (!this.backupState) throw new Error('No backup to restore');
    this.state = JSON.parse(JSON.stringify(this.backupState));
  }
}
