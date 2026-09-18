import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { cancelAnimation, useSharedValue, withDecay, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { clampCameraX } from '../../scene/camera-math';
import type { SceneBounds } from '../../scene/scene-types';
import { screenToWorld } from './coords';

/** INPUT_SYSTEM §2: pan starts after ≥ 6 dp of movement. */
export const PAN_MIN_DISTANCE_DP = 6;

export type GestureTargetKind = 'pan' | 'entity';

export interface CameraPanOptions {
  cameraX: SharedValue<number>;
  scale: number;
  viewportW: number;
  bounds: SceneBounds;
  /** Called once when pan inertia (or the pan itself) settles. Never per frame (HU-GAME-007 R6). */
  onSettled: (cameraX: number) => void;
  /**
   * First hit test (INPUT_SYSTEM §3/§6): decides pan vs entity drag at touch down, never mid-gesture.
   * Until HU-GAME-026 provides the real hit test, the default treats every touch as background.
   */
  resolveTarget?: (worldX: number, worldY: number) => GestureTargetKind;
}

/**
 * One-finger horizontal pan with decay inertia, clamped to scene bounds (RENDERING §5).
 * Runs entirely on the UI thread; the engine only hears about the final position.
 */
export function useCameraPan({ cameraX, scale, viewportW, bounds, onSettled, resolveTarget }: CameraPanOptions) {
  // Written on the JS thread by the hit test, read by the gesture worklets on the UI thread.
  const panAllowed = useSharedValue(true);
  return useMemo(() => {
    const minX = clampCameraX(bounds.minX, bounds, viewportW);
    const maxX = clampCameraX(bounds.maxX, bounds, viewportW);

    const decide = (xDp: number, yDp: number, camera: number) => {
      const p = screenToWorld(xDp, yDp, scale, camera);
      panAllowed.set((resolveTarget ? resolveTarget(p.x, p.y) : 'pan') === 'pan');
    };

    return Gesture.Pan()
      .maxPointers(1) // INPUT_SYSTEM §2: MVP follows a single pointer
      .minDistance(PAN_MIN_DISTANCE_DP)
      .onBegin((e) => {
        cancelAnimation(cameraX);
        panAllowed.set(true);
        scheduleOnRN(decide, e.x, e.y, cameraX.get());
      })
      .onChange((e) => {
        if (!panAllowed.get()) return;
        const next = cameraX.get() - e.changeX / scale;
        cameraX.set(Math.min(Math.max(next, minX), maxX));
      })
      .onEnd((e) => {
        if (!panAllowed.get()) return;
        cameraX.set(
          withDecay({ velocity: -e.velocityX / scale, clamp: [minX, maxX] }, (finished) => {
            if (finished) scheduleOnRN(onSettled, cameraX.get());
          }),
        );
      });
  }, [cameraX, panAllowed, scale, viewportW, bounds, onSettled, resolveTarget]);
}
