import type { Components } from '../components/registry';
import type { Location } from '../core/location';
import type { EntityId, PrefabId, SceneId } from '../core/types';

/**
 * Persistence port (SAVE_SYSTEM §2). The engine depends on this interface only;
 * SqliteSaveStore (adapter, HU-GAME-052) and InMemorySaveStore (tests) implement it.
 * Shapes follow SAVE_SCHEMA §1; fields are completed by the save HUs.
 */

export interface SavedEntity {
  id: EntityId;
  prefabId?: PrefabId;
  tags?: string[];
  location: Location;
  components: Components;
}

export interface PlayerState {
  currentSceneId?: SceneId;
  cameraX?: number;
  wallet?: { coins: number };
  unlocks?: string[];
  inventory?: { capacity: number };
  flags?: Record<string, boolean | number | string>;
  /** HU-GAME-058: audio settings; kept by resetWorld (HU-GAME-055). */
  settings?: { musicVolume: number; sfxVolume: number; muted: boolean };
  [key: string]: unknown;
}

export interface SaveSlotData {
  slotId: string;
  saveVersion: number;
  createdAt: string;
  updatedAt: string;
  contentVersions: Record<string, string>;
  player: PlayerState;
}

export interface WriteBatch {
  slotId: string;
  upserts: SavedEntity[];
  /** Scene-declared entities gone for good: row deleted and id recorded in entity_removed. */
  removals: EntityId[];
  /** Runtime entities gone: only their row is deleted (HU-GAME-052 RN-7). */
  deletes?: EntityId[];
  /** Full slot row to write (player + metadata), when it changed. */
  slot?: SaveSlotData;
}

export interface SaveStore {
  loadSlot(slotId: string): Promise<SaveSlotData | undefined>;
  /** Entities of a scene, or all entities of the slot when sceneId is omitted. */
  loadEntities(slotId: string, sceneId?: SceneId): Promise<SavedEntity[]>;
  loadRemoved(slotId: string): Promise<EntityId[]>;
  /** Replaces the whole slot (used after migrations). Atomic. */
  replaceAll(data: { slot: SaveSlotData; entities: SavedEntity[]; removed: EntityId[] }): Promise<void>;
  /** Atomic: either everything is written or nothing is. */
  writeBatch(batch: WriteBatch): Promise<void>;
  backup(): Promise<void>;
  restoreBackup(): Promise<void>;
}

export function sceneIdOfLocation(location: Location): SceneId | undefined {
  return location.kind === 'scene' ? location.sceneId : undefined;
}
