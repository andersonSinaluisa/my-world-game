import { Canvas, Group } from '@shopify/react-native-skia';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { useWorldGesture, type WorldInputHandlers } from '../input/use-world-gesture';
import { sceneBounds, type ActiveSceneInfo } from '../../scene/scene-types';
import { BackgroundLayers } from './background-layers';
import { DebugGrid } from './debug-grid';
import type { TextureStore } from './texture-store';
import { computeViewport, type Viewport } from './viewport';

export interface SceneCanvasProps {
  scene: ActiveSceneInfo;
  textures: TextureStore;
  cameraX: SharedValue<number>;
  /** Thresholded camera position used for culling (HU-GAME-008); updated by the parent. */
  cullX: number;
  onViewportChange: (viewport: Viewport) => void;
  onCameraSettled: (cameraX: number) => void;
  /** Tap / drag callbacks (JS thread). Without them every touch pans. */
  input?: WorldInputHandlers;
  /** Finger position in world units while dragging, shared with the DragProxy. */
  pointerX: SharedValue<number>;
  pointerY: SharedValue<number>;
  showGrid?: boolean;
  /** Entity sprites, already culled and sorted (layers + z) by the facade selector. */
  children?: ReactNode;
  /** Drawn above every entity: the DragProxy (HU-GAME-027) and effects. */
  overlay?: ReactNode;
}

/**
 * Full-screen world canvas (RENDERING §3). The whole tree is expressed in world units:
 * root Group scales world → dp, the camera Group translates by −cameraX (a SharedValue, no React renders).
 * The Canvas also draws under the notch; the HUD (RN Views) uses safe areas (HU-GAME-005 R5).
 */
export function SceneCanvas({
  scene,
  textures,
  cameraX,
  cullX,
  onViewportChange,
  onCameraSettled,
  input,
  pointerX,
  pointerY,
  showGrid = false,
  children,
  overlay,
}: SceneCanvasProps) {
  const [viewport, setViewport] = useState<Viewport | null>(null);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      const next = computeViewport(width, height);
      setViewport(next);
      onViewportChange(next);
    },
    [onViewportChange],
  );

  const bounds = useMemo(() => sceneBounds(scene), [scene]);
  const gesture = useWorldGesture({
    cameraX,
    pointerX,
    pointerY,
    scale: viewport?.scale ?? 1,
    viewportW: viewport?.viewportW ?? scene.size.width,
    canvasWidthDp: viewport?.canvasWidthDp ?? 0,
    canvasHeightDp: viewport?.canvasHeightDp ?? 0,
    bounds,
    onSettled: onCameraSettled,
    handlers: input,
  });

  const cameraTransform = useDerivedValue(() => [{ translateX: -cameraX.get() }]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.fill} onLayout={onLayout} collapsable={false}>
        {viewport && (
          <Canvas style={styles.fill}>
            <Group transform={[{ scale: viewport.scale }]}>
              <Group transform={cameraTransform}>
                <BackgroundLayers
                  layers={scene.background.layers}
                  cameraX={cameraX}
                  cullX={cullX}
                  viewportW={viewport.viewportW}
                  textures={textures}
                />
                {children}
                {overlay}
                {showGrid && <DebugGrid width={scene.size.width} />}
              </Group>
            </Group>
          </Canvas>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
