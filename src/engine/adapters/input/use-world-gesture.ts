import { useEffect, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { cancelAnimation, useFrameCallback, useSharedValue, withDecay, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { EntityId } from '../../core/types';
import { clampCameraX } from '../../scene/camera-math';
import type { SceneBounds } from '../../scene/scene-types';
import { autoScrollStep, autoScrollVelocity } from './auto-scroll';
import { screenToWorld } from './coords';

/** INPUT_SYSTEM §2: long press = 450 ms without moving more than 10 dp (HU-GAME-040 R1). */
export const LONG_PRESS_MS = 450;
export const LONG_PRESS_MAX_DP = 10;

/** INPUT_SYSTEM §2: pan and drag start after ≥ 6 dp of movement; a tap moves less. */
export const PAN_MIN_DISTANCE_DP = 6;
/** INPUT_SYSTEM §6 / HU-GAME-027 R9: no drag starts within 16 dp of a screen edge (system gestures). */
export const EDGE_MARGIN_DP = 16;

/** HU-GAME-033 R1 fallback: drop preview sampling (≤ 10 Hz). */
export const PREVIEW_INTERVAL_MS = 100;

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
  /** screenX/screenY: finger in dp, to detect HUD drop targets such as the backpack (HU-GAME-037 R3). */
  dragEnd(id: EntityId, worldX: number, worldY: number, screenX: number, screenY: number): void;
  /** Gesture cancelled by the system (HU-GAME-027 R11). */
  dragCancel(id: EntityId): void;
  /** Finger position while dragging, sampled at ≤ 10 Hz, for the drop preview (HU-GAME-033 R1 fallback). */
  dragMove?(id: EntityId, worldX: number, worldY: number, screenX: number, screenY: number): void;
  tap(worldX: number, worldY: number): void;
  /** pointerLongPress; returns the entity whose drag starts now (unwear → startDrag), if any. */
  longPress?(worldX: number, worldY: number): EntityId | undefined;
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
  // Finger position in dp while dragging (-1 = none) and camera limits, read by the auto-scroll frame callback.
  const fingerX = useSharedValue(-1);
  const fingerY = useSharedValue(0);
  const scrolling = useSharedValue(false);
  const panActive = useSharedValue(false);
  const limits = useSharedValue({ minX: 0, maxX: 0, scale: 1, widthDp: 0 });
  const lastPreview = useSharedValue({ t: 0, x: NaN, y: NaN });
  const dragMove = handlers?.dragMove;

  useEffect(() => {
    limits.set({
      minX: clampCameraX(bounds.minX, bounds, viewportW),
      maxX: clampCameraX(bounds.maxX, bounds, viewportW),
      scale,
      widthDp: canvasWidthDp,
    });
  }, [bounds, viewportW, scale, canvasWidthDp, limits]);

  // HU-GAME-029: auto-scroll near the edges, only while dragging an entity, on the UI thread (R4, R7).
  useFrameCallback((frame) => {
    const l = limits.get();
    // HU-GAME-033: preview the drop target at most every 100 ms, and only if the finger moved.
    if (dragMove && mode.get() === DRAG && dragId.get()) {
      const last = lastPreview.get();
      const px = pointerX.get();
      const py = pointerY.get();
      if (frame.timestamp - last.t >= PREVIEW_INTERVAL_MS && (px !== last.x || py !== last.y)) {
        lastPreview.set({ t: frame.timestamp, x: px, y: py });
        scheduleOnRN(dragMove, dragId.get(), px, py, fingerX.get(), fingerY.get());
      }
    }
    const v = mode.get() === DRAG && fingerX.get() >= 0 ? autoScrollVelocity(fingerX.get(), l.widthDp) : 0;
    const current = cameraX.get();
    const next = v === 0 ? current : autoScrollStep(current, v, frame.timeSincePreviousFrame ?? 16, l.minX, l.maxX);
    if (next === current) {
      // R6: stopped (finger left the zone, bounds reached or drag ended) → one cameraSettled.
      if (scrolling.get()) {
        scrolling.set(false);
        scheduleOnRN(onSettled, current);
      }
      return;
    }
    scrolling.set(true);
    cameraX.set(next);
    // R5: the dragged item stays under the finger while the world scrolls.
    pointerX.set(fingerX.get() / l.scale + next);
    pointerY.set(fingerY.get() / l.scale);
  });

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
        if (success) handlers?.dragEnd(id, p.x, p.y, x, y);
        else handlers?.dragCancel(id);
      } else if (current === PENDING || current === IDLE) {
        onSettled(cameraX.get());
      }
    };
    const tap = (x: number, y: number, camera: number) => {
      const p = screenToWorld(x, y, scale, camera);
      handlers?.tap(p.x, p.y);
    };
    // Long press: the rule may hand back a drag (a garment taken off keeps following the finger).
    const longPress = (x: number, y: number, camera: number) => {
      if (mode.get() !== IDLE) return;
      const p = screenToWorld(x, y, scale, camera);
      const id = handlers?.longPress?.(p.x, p.y);
      if (!id) return;
      dragId.set(id);
      mode.set(DRAG);
    };

    const pan = Gesture.Pan()
      .maxPointers(1) // HU-GAME-027 R10: a single pointer
      .minDistance(PAN_MIN_DISTANCE_DP)
      .onBegin(() => {
        cancelAnimation(cameraX);
      })
      .onStart((e) => {
        panActive.set(true);
        fingerX.set(e.x);
        fingerY.set(e.y);
        // A long press already started a drag (HU-GAME-040): keep it.
        if (mode.get() === DRAG) return;
        // Initial touch point = current position minus the translation so far.
        const x0 = e.x - e.translationX;
        const y0 = e.y - e.translationY;
        const edge =
          x0 < EDGE_MARGIN_DP || y0 < EDGE_MARGIN_DP || x0 > canvasWidthDp - EDGE_MARGIN_DP || y0 > canvasHeightDp - EDGE_MARGIN_DP;
        const p = screenToWorld(e.x, e.y, scale, cameraX.get());
        pointerX.set(p.x);
        pointerY.set(p.y);
        fingerX.set(e.x);
        fingerY.set(e.y);
        mode.set(PENDING);
        scheduleOnRN(decide, x0, y0, cameraX.get(), edge);
      })
      .onChange((e) => {
        const m = mode.get();
        if (m === PAN) {
          const next = cameraX.get() - e.changeX / scale;
          cameraX.set(Math.min(Math.max(next, minX), maxX));
        } else {
          fingerX.set(e.x);
          fingerY.set(e.y);
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
        fingerX.set(-1);
        panActive.set(false);
        // R8: the drop uses the camera after any auto-scroll.
        scheduleOnRN(finish, success, e.x, e.y, cameraX.get());
      });

    const tapGesture = Gesture.Tap()
      .maxDuration(LONG_PRESS_MS)
      .maxDistance(PAN_MIN_DISTANCE_DP)
      .onEnd((e, success) => {
        if (success) scheduleOnRN(tap, e.x, e.y, cameraX.get());
      });

    const longPressGesture = Gesture.LongPress()
      .minDuration(LONG_PRESS_MS)
      .maxDistance(LONG_PRESS_MAX_DP)
      .onStart((e) => {
        pointerX.set(screenToWorld(e.x, e.y, scale, cameraX.get()).x);
        pointerY.set(screenToWorld(e.x, e.y, scale, cameraX.get()).y);
        scheduleOnRN(longPress, e.x, e.y, cameraX.get());
      })
      .onEnd((e) => {
        // Released without moving after a long press that started a drag: drop it right there.
        if (!panActive.get()) scheduleOnRN(finish, true, e.x, e.y, cameraX.get());
      });

    return Gesture.Simultaneous(Gesture.Race(pan, tapGesture), longPressGesture);
  }, [bounds, viewportW, scale, canvasWidthDp, canvasHeightDp, cameraX, pointerX, pointerY, mode, dragId, fingerX, fingerY, panActive, onSettled, handlers]);
}
