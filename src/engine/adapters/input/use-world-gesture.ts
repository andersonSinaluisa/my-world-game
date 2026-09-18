import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { cancelAnimation, useSharedValue, withDecay, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { EntityId } from '../../core/types';
import { clampCameraX } from '../../scene/camera-math';
import type { SceneBounds } from '../../scene/scene-types';
import { screenToWorld } from './coords';

/** INPUT_SYSTEM §2: pan and drag start after ≥ 6 dp of movement; a tap moves less. */
export const PAN_MIN_DISTANCE_DP = 6;
/** INPUT_SYSTEM §6 / HU-GAME-027 R9: no drag starts within 16 dp of a screen edge (system gestures). */
export const EDGE_MARGIN_DP = 16;

const IDLE = 0;
const PENDING = 1;
const PAN = 2;
const DRAG = 3;

/** JS-thread callbacks. The gesture only converts dp → world units and decides pan vs drag. */
export interface WorldInputHandlers {
  /** First hit test (HU-GAME-026 R5b): draggable entity under the initial touch, if any. */
  pickDraggable(worldX: number, worldY: number): EntityId | undefined;
  /** Dispatches dragStart; false = the engine refused it and the gesture becomes a pan. */
  dragStart(id: EntityId, worldX: number, worldY: number): boolean;
  dragEnd(id: EntityId, worldX: number, worldY: number): void;
  /** Gesture cancelled by the system (HU-GAME-027 R11). */
  dragCancel(id: EntityId): void;
  tap(worldX: number, worldY: number): void;
}

export interface WorldGestureOptions {
  cameraX: SharedValue<number>;
  /** Finger position in world units, for the DragProxy (UI thread, no React renders, HU-GAME-027 R7). */
  pointerX: SharedValue<number>;
  pointerY: SharedValue<number>;
  scale: number;
  viewportW: number;
  canvasWidthDp: number;
  canvasHeightDp: number;
  bounds: SceneBounds;
  /** Called once when the camera settles after a pan. Never per frame (HU-GAME-007 R6). */
  onSettled: (cameraX: number) => void;
  handlers?: WorldInputHandlers;
}

/**
 * The single gesture detector of the world canvas (INPUT_SYSTEM §1, HU-GAME-027 R1):
 * tap, or one-finger pan / drag decided once with the initial touch point (INPUT_SYSTEM §6).
 */
export function useWorldGesture(o: WorldGestureOptions) {
  const mode = useSharedValue(IDLE);
  const dragId = useSharedValue('');
  const { cameraX, pointerX, pointerY, scale, viewportW, canvasWidthDp, canvasHeightDp, bounds, onSettled, handlers } = o;

  return useMemo(() => {
    const minX = clampCameraX(bounds.minX, bounds, viewportW);
    const maxX = clampCameraX(bounds.maxX, bounds, viewportW);

    // ---- JS thread ----
    const decide = (x0: number, y0: number, camera: number, edge: boolean) => {
      const p = screenToWorld(x0, y0, scale, camera);
      const id = edge ? undefined : handlers?.pickDraggable(p.x, p.y);
      if (id && handlers?.dragStart(id, p.x, p.y)) {
        dragId.set(id);
        mode.set(DRAG);
      } else {
        mode.set(PAN);
      }
    };
    // Runs after `decide` (scheduleOnRN is FIFO), so the mode is final here.
    const finish = (success: boolean, x: number, y: number, camera: number) => {
      const current = mode.get();
      const id = dragId.get();
      mode.set(IDLE);
      dragId.set('');
      if (current === DRAG && id) {
        const p = screenToWorld(x, y, scale, camera);
        if (success) handlers?.dragEnd(id, p.x, p.y);
        else handlers?.dragCancel(id);
      } else if (current === PENDING || current === IDLE) {
        onSettled(cameraX.get());
      }
    };
    const tap = (x: number, y: number, camera: number) => {
      const p = screenToWorld(x, y, scale, camera);
      handlers?.tap(p.x, p.y);
    };

    const pan = Gesture.Pan()
      .maxPointers(1) // HU-GAME-027 R10: a single pointer
      .minDistance(PAN_MIN_DISTANCE_DP)
      .onBegin(() => {
        cancelAnimation(cameraX);
      })
      .onStart((e) => {
        // Initial touch point = current position minus the translation so far.
        const x0 = e.x - e.translationX;
        const y0 = e.y - e.translationY;
        const edge =
          x0 < EDGE_MARGIN_DP || y0 < EDGE_MARGIN_DP || x0 > canvasWidthDp - EDGE_MARGIN_DP || y0 > canvasHeightDp - EDGE_MARGIN_DP;
        const p = screenToWorld(e.x, e.y, scale, cameraX.get());
        pointerX.set(p.x);
        pointerY.set(p.y);
        mode.set(PENDING);
        scheduleOnRN(decide, x0, y0, cameraX.get(), edge);
      })
      .onChange((e) => {
        const m = mode.get();
        if (m === PAN) {
          const next = cameraX.get() - e.changeX / scale;
          cameraX.set(Math.min(Math.max(next, minX), maxX));
        } else {
          const p = screenToWorld(e.x, e.y, scale, cameraX.get());
          pointerX.set(p.x);
          pointerY.set(p.y);
        }
      })
      .onEnd((e, success) => {
        if (mode.get() === PAN) {
          mode.set(IDLE);
          cameraX.set(
            withDecay({ velocity: -e.velocityX / scale, clamp: [minX, maxX] }, (finished) => {
              if (finished) scheduleOnRN(onSettled, cameraX.get());
            }),
          );
          return;
        }
        scheduleOnRN(finish, success, e.x, e.y, cameraX.get());
      });

    const tapGesture = Gesture.Tap()
      .maxDistance(PAN_MIN_DISTANCE_DP)
      .onEnd((e, success) => {
        if (success) scheduleOnRN(tap, e.x, e.y, cameraX.get());
      });

    return Gesture.Race(pan, tapGesture);
  }, [bounds, viewportW, scale, canvasWidthDp, canvasHeightDp, cameraX, pointerX, pointerY, mode, dragId, onSettled, handlers]);
}
