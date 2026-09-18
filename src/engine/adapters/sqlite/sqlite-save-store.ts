import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { EntityId, SceneId } from '../../core/types';
import type { SaveSlotData, SaveStore, SavedEntity, WriteBatch } from '../../persistence/save-store';

/**
 * SQLite implementation of the SaveStore port (SAVE_SCHEMA §3, ADR-006).
 * One row per entity, JSON `data`, transactional writes. Verified manually on devices (HU-GAME-072 R10):
 * SQLite is not available in the Node test harness, which uses InMemorySaveStore with the same contract.
 */

export const DB_NAME = 'myworld.db';
export const BACKUP_DB_NAME = 'myworld.backup.db';

/** Numbered SQL migrations; index + 1 = PRAGMA user_version they produce (SAVE_SCHEMA §5). */
export const SQL_MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS save_slot (
     slot_id TEXT PRIMARY KEY,
     save_version INTEGER NOT NULL,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     content_versions TEXT NOT NULL,
     player TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS entity_state (
     slot_id TEXT NOT NULL,
     entity_id TEXT NOT NULL,
     scene_id TEXT,
     data TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     PRIMARY KEY (slot_id, entity_id)
   );
   CREATE INDEX IF NOT EXISTS idx_entity_scene ON entity_state(slot_id, scene_id);
   CREATE TABLE IF NOT EXISTS entity_removed (
     slot_id TEXT NOT NULL,
     entity_id TEXT NOT NULL,
     PRIMARY KEY (slot_id, entity_id)
   );`,
];

const TABLES = ['save_slot', 'entity_state', 'entity_removed'] as const;

export type OpenStatus = 'ok' | 'incompatible';

interface SlotRow {
  slot_id: string;
  save_version: number;
  created_at: string;
  updated_at: string;
  content_versions: string;
  player: string;
}

const sceneOf = (e: SavedEntity): string | null => (e.location.kind === 'scene' ? e.location.sceneId : null);

export class SqliteSaveStore implements SaveStore {
  private constructor(
    private readonly db: SQLiteDatabase,
    private readonly backupPath: string,
  ) {}

  /**
   * Opens the DB and applies pending SQL migrations (backup first when a DB already existed).
   * A DB with a user_version newer than this app supports is never modified (SAVE_SCHEMA §5 rule 5).
   */
  static async open(name = DB_NAME): Promise<{ store: SqliteSaveStore; status: OpenStatus }> {
    const db = await openDatabaseAsync(name);
    await db.execAsync('PRAGMA journal_mode = WAL;');
    const dir = db.databasePath.slice(0, db.databasePath.lastIndexOf('/') + 1);
    const store = new SqliteSaveStore(db, dir + BACKUP_DB_NAME);
    const version = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
    if (version > SQL_MIGRATIONS.length) return { store, status: 'incompatible' };
    if (version > 0 && version < SQL_MIGRATIONS.length) await store.backup();
    for (let v = version; v < SQL_MIGRATIONS.length; v++) {
      await db.withExclusiveTransactionAsync(async (txn) => {
        await txn.execAsync(SQL_MIGRATIONS[v]);
        await txn.execAsync(`PRAGMA user_version = ${v + 1}`);
      });
    }
    return { store, status: 'ok' };
  }

  async loadSlot(slotId: string): Promise<SaveSlotData | undefined> {
    const row = await this.db.getFirstAsync<SlotRow>('SELECT * FROM save_slot WHERE slot_id = ?', slotId);
    if (!row) return undefined;
    return {
      slotId: row.slot_id,
      saveVersion: row.save_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      contentVersions: JSON.parse(row.content_versions),
      player: JSON.parse(row.player),
    };
  }

  async loadEntities(slotId: string, sceneId?: SceneId): Promise<SavedEntity[]> {
    const rows =
      sceneId === undefined
        ? await this.db.getAllAsync<{ data: string }>('SELECT data FROM entity_state WHERE slot_id = ?', slotId)
        : await this.db.getAllAsync<{ data: string }>('SELECT data FROM entity_state WHERE slot_id = ? AND scene_id = ?', slotId, sceneId);
    return rows.map((r) => JSON.parse(r.data) as SavedEntity);
  }

  async loadRemoved(slotId: string): Promise<EntityId[]> {
    const rows = await this.db.getAllAsync<{ entity_id: string }>('SELECT entity_id FROM entity_removed WHERE slot_id = ?', slotId);
    return rows.map((r) => r.entity_id);
  }

  async writeBatch(batch: WriteBatch): Promise<void> {
    const now = new Date().toISOString();
    // Serialize before opening the transaction: a non-serializable value aborts without touching the DB.
    const upserts = batch.upserts.map((e) => [e.id, sceneOf(e), JSON.stringify(e)] as const);
    await this.db.withExclusiveTransactionAsync(async (txn) => {
      for (const [id, scene, data] of upserts) {
        await txn.runAsync(
          `INSERT INTO entity_state (slot_id, entity_id, scene_id, data, updated_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(slot_id, entity_id) DO UPDATE SET scene_id = excluded.scene_id, data = excluded.data, updated_at = excluded.updated_at`,
          batch.slotId, id, scene, data, now,
        );
      }
      for (const id of batch.removals) {
        await txn.runAsync('DELETE FROM entity_state WHERE slot_id = ? AND entity_id = ?', batch.slotId, id);
        await txn.runAsync('INSERT OR IGNORE INTO entity_removed (slot_id, entity_id) VALUES (?, ?)', batch.slotId, id);
      }
      for (const id of batch.deletes ?? []) {
        await txn.runAsync('DELETE FROM entity_state WHERE slot_id = ? AND entity_id = ?', batch.slotId, id);
      }
      if (batch.slot) await this.writeSlot(txn, batch.slot);
    });
  }

  async replaceAll(data: { slot: SaveSlotData; entities: SavedEntity[]; removed: EntityId[] }): Promise<void> {
    const now = new Date().toISOString();
    const slotId = data.slot.slotId;
    const rows = data.entities.map((e) => [e.id, sceneOf(e), JSON.stringify(e)] as const);
    await this.db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('DELETE FROM entity_state WHERE slot_id = ?', slotId);
      await txn.runAsync('DELETE FROM entity_removed WHERE slot_id = ?', slotId);
      for (const [id, scene, json] of rows) {
        await txn.runAsync('INSERT INTO entity_state (slot_id, entity_id, scene_id, data, updated_at) VALUES (?, ?, ?, ?, ?)', slotId, id, scene, json, now);
      }
      for (const id of data.removed) await txn.runAsync('INSERT INTO entity_removed (slot_id, entity_id) VALUES (?, ?)', slotId, id);
      await this.writeSlot(txn, data.slot);
    });
  }

  private async writeSlot(db: Pick<SQLiteDatabase, 'runAsync'>, slot: SaveSlotData): Promise<void> {
    await db.runAsync(
      `INSERT INTO save_slot (slot_id, save_version, created_at, updated_at, content_versions, player) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(slot_id) DO UPDATE SET save_version = excluded.save_version, updated_at = excluded.updated_at,
         content_versions = excluded.content_versions, player = excluded.player`,
      slot.slotId, slot.saveVersion, slot.createdAt, slot.updatedAt, JSON.stringify(slot.contentVersions), JSON.stringify(slot.player),
    );
  }

  async deleteSlot(slotId: string): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (txn) => {
      for (const t of TABLES) await txn.runAsync(`DELETE FROM ${t} WHERE slot_id = ?`, slotId);
    });
  }

  /**
   * Copies every table into myworld.backup.db (SAVE_SCHEMA §5 rule 2). Uses ATTACH instead of
   * `VACUUM INTO` because VACUUM INTO fails when the target file exists and deleting it needs a
   * file-system dependency; the result is equivalent.
   */
  async backup(): Promise<void> {
    await this.withBackupAttached(async () => {
      for (const t of TABLES) {
        await this.db.execAsync(`CREATE TABLE IF NOT EXISTS backup.${t} AS SELECT * FROM main.${t} WHERE 0;`);
        await this.db.execAsync(`DELETE FROM backup.${t}; INSERT INTO backup.${t} SELECT * FROM main.${t};`);
      }
    });
  }

  async restoreBackup(): Promise<void> {
    await this.withBackupAttached(async () => {
      await this.db.execAsync('BEGIN EXCLUSIVE;');
      try {
        for (const t of TABLES) await this.db.execAsync(`DELETE FROM main.${t}; INSERT INTO main.${t} SELECT * FROM backup.${t};`);
        await this.db.execAsync('COMMIT;');
      } catch (e) {
        await this.db.execAsync('ROLLBACK;');
        throw e;
      }
    });
  }

  private async withBackupAttached(task: () => Promise<void>): Promise<void> {
    await this.db.runAsync('ATTACH DATABASE ? AS backup', this.backupPath);
    try {
      await task();
    } finally {
      await this.db.execAsync('DETACH DATABASE backup;');
    }
  }

  close(): Promise<void> {
    return this.db.closeAsync();
  }
}
