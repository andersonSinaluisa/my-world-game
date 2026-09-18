import type { EntityId, SceneId, WorldPoint } from './types';

/**
 * Commands (GAME_ENGINE §4). Only the ones implemented so far are listed; each HU adds its own.
 * `cameraSettled` carries `viewportW` because the engine has no knowledge of screen size.
 * Input commands carry `minHitWorld` (44 dp in world units at the current scale, INPUT_SYSTEM §8).
 */
export type GameCommand =
  | { type: 'cameraSettled'; cameraX: number; viewportW: number }
  | { type: 'viewportChanged'; viewportW: number }
  | { type: 'enterScene'; sceneId: SceneId; spawnId: string; travelers?: EntityId[] }
  | { type: 'pointerTap'; worldPoint: WorldPoint; minHitWorld?: number }
  | { type: 'dragStart'; entityId: EntityId; worldPoint: WorldPoint }
  | { type: 'dragEnd'; entityId: EntityId; worldPoint: WorldPoint; uiTarget?: 'inventory' | 'trash'; minHitWorld?: number }
  | { type: 'dragCancel'; entityId: EntityId };

export type CommandFailure =
  | 'unknownCommand'
  | 'invalidCommand'
  | 'entityNotFound'
  | 'noActiveScene'
  | 'noContent'
  | 'unknownScene'
  | 'notDraggable'
  | 'notDragging'
  | 'alreadyDragging'
  | 'notImplemented'
  | 'internalError';

export type CommandResult = { ok: true; startDrag?: EntityId } | { ok: false; reason: CommandFailure };

export const OK: CommandResult = { ok: true };
