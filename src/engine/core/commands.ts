import type { EntityId } from './types';

/**
 * Commands (GAME_ENGINE §4). Only the ones implemented so far are listed; each HU adds its own.
 * `cameraSettled` carries `viewportW` because the engine has no knowledge of screen size
 * and needs it to clamp the camera to the scene bounds.
 */
export type GameCommand =
  | { type: 'cameraSettled'; cameraX: number; viewportW: number }
  | { type: 'dragStart'; entityId: EntityId; worldPoint: { x: number; y: number } };

export type CommandFailure =
  | 'unknownCommand'
  | 'invalidCommand'
  | 'entityNotFound'
  | 'noActiveScene'
  | 'notImplemented'
  | 'internalError';

export type CommandResult = { ok: true; startDrag?: EntityId } | { ok: false; reason: CommandFailure };

export const OK: CommandResult = { ok: true };
