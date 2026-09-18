import type { Appearance } from '../components/base';
import type { WearSlot } from './location';
import type { EntityId, PrefabId, SceneId, WorldPoint } from './types';

/**
 * Commands (GAME_ENGINE §4). Only the ones implemented so far are listed; each HU adds its own.
 * `cameraSettled` carries `viewportW` because the engine has no knowledge of screen size.
 * Input commands carry `minHitWorld` (44 dp in world units at the current scale, INPUT_SYSTEM §8).
 */
export type GameCommand =
  | { type: 'cameraSettled'; cameraX: number; viewportW: number }
  | { type: 'viewportChanged'; viewportW: number }
  | { type: 'enterScene'; sceneId: SceneId; spawnId: string; travelers?: EntityId[] }
  /** Map travel (HU-GAME-051): through the transition, nobody moves. */
  | { type: 'travelTo'; sceneId: SceneId; spawnId: string }
  /** The UI finished the fade-in: input is accepted again (HU-GAME-050 RN-4). */
  | { type: 'transitionDone' }
  | { type: 'pointerTap'; worldPoint: WorldPoint; minHitWorld?: number }
  | { type: 'pointerLongPress'; worldPoint: WorldPoint; minHitWorld?: number }
  | { type: 'dragStart'; entityId: EntityId; worldPoint: WorldPoint }
  | { type: 'dragEnd'; entityId: EntityId; worldPoint: WorldPoint; uiTarget?: 'inventory' | 'trash'; minHitWorld?: number }
  | { type: 'dragCancel'; entityId: EntityId }
  | { type: 'dragPreview'; entityId: EntityId; worldPoint: WorldPoint; uiTarget?: 'inventory' | 'trash'; minHitWorld?: number }
  | { type: 'createCharacter'; appearance: Appearance; outfit: Partial<Record<WearSlot, PrefabId>> }
  | { type: 'updateAppearance'; characterId: EntityId; patch: Partial<Appearance> }
  | { type: 'setOutfitSlot'; characterId: EntityId; slot: WearSlot; prefabId: PrefabId | null }
  | { type: 'focusEntity'; entityId: EntityId }
  | { type: 'takeFromInventory'; slot: number; worldPoint: WorldPoint }
  | { type: 'setSetting'; key: 'musicVolume' | 'sfxVolume' | 'muted' | 'language'; value: number | boolean | string };

export type CommandFailure =
  | 'unknownCommand'
  | 'invalidCommand'
  | 'entityNotFound'
  | 'noActiveScene'
  | 'noContent'
  | 'unknownScene'
  | 'transitioning'
  | 'notDraggable'
  | 'notDragging'
  | 'alreadyDragging'
  | 'maxCharacters'
  | 'invalidPart'
  | 'notCharacter'
  | 'notImplemented'
  | 'internalError';

/** `entityId`: entity created or affected (createCharacter returns the new character, HU-GAME-023 R4). */
export type CommandResult = { ok: true; startDrag?: EntityId; entityId?: EntityId } | { ok: false; reason: CommandFailure };

export const OK: CommandResult = { ok: true };
