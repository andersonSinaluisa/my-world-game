import { Canvas, Group } from '@shopify/react-native-skia';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { useCameraPan, type GestureTargetKind } from '../input/use-camera-pan';
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
  resolveTarget?: (worldX: number, worldY: number) => GestureTargetKind;
  showGrid?: boolean;
  /** Entity sprites, already culled and sorted (layers + z) by the facade selector. */
  children?: ReactNode;
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
  resolveTarget,
  showGrid = false,
  children,
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
  const pan = useCameraPan({
    cameraX,
    scale: viewport?.scale ?? 1,
    viewportW: viewport?.viewportW ?? scene.size.width,
    bounds,
    onSettled: onCameraSettled,
    resolveTarget,
  });

  const cameraTransform = useDerivedValue(() => [{ translateX: -cameraX.get() }]);

  return (
    <GestureDetector gesture={pan}>
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
                {/* DragProxy (HU-GAME-027) and Effects go here, always on top. */}
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
