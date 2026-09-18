import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useState, type Ref } from 'react';
import { useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { GestureTargetKind } from '@/engine/adapters/input/use-camera-pan';
import { SceneCanvas } from '@/engine/adapters/render/scene-canvas';
import { SpriteNode } from '@/engine/adapters/render/sprite-node';
import type { TextureStore } from '@/engine/adapters/render/texture-store';
import type { Viewport } from '@/engine/adapters/render/viewport';
import type { EntityId } from '@/engine/core/types';
import { CAMERA_JUMP_MS, cameraTargetFor, clampCameraX } from '@/engine/scene/camera-math';
import { CULLING_RECOMPUTE_RATIO } from '@/engine/scene/culling';
import { sceneBounds } from '@/engine/scene/scene-types';

import { resolveAsset } from './facade';
import { useGame } from './game-context';
import { useActiveScene, useEntity, useVisibleEntities } from './hooks';

export interface CameraController {
  /** Centers the camera on world x with a 450 ms animation (RENDERING §5), then reports cameraSettled. */
  jumpTo(x: number): void;
  /** Places the camera immediately (scene entry, HU-GAME-010). */
  setCameraX(x: number): void;
  viewport(): Viewport | null;
}

export interface SceneViewProps {
  textures: TextureStore;
  showGrid?: boolean;
  resolveTarget?: (worldX: number, worldY: number) => GestureTargetKind;
  cameraRef?: Ref<CameraController>;
  onViewport?: (viewport: Viewport) => void;
}

/** Subscribes to a single entity so only it re-renders when it changes (PERFORMANCE §4 rule 2). */
const EntityNode = memo(function EntityNode({ id, textures }: { id: EntityId; textures: TextureStore }) {
  const game = useGame();
  const entity = useEntity(id);
  const sprite = entity?.components.sprite;
  if (!entity || !sprite || entity.location.kind !== 'scene') return null;
  return (
    <SpriteNode
      id={id}
      asset={resolveAsset(entity)}
      transform={entity.components.transform ?? { x: 0, y: 0 }}
      pivot={sprite.pivot ?? { x: 0.5, y: 1 }}
      size={sprite.size}
      textures={textures}
      events={game.events}
    />
  );
});

/**
 * World view for the active scene: Skia canvas + camera + culled, sorted entities.
 * The camera lives in a SharedValue; React only re-renders when the culling window moves past
 * its threshold (10 % of the viewport, RENDERING §7) or when entities change.
 */
export function SceneView({ textures, showGrid, resolveTarget, cameraRef, onViewport }: SceneViewProps) {
  const game = useGame();
  const scene = useActiveScene();
  const cameraX = useSharedValue(0);
  const lastCullX = useSharedValue(0);
  const viewportW = useSharedValue(0);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [cullX, setCullX] = useState(0);

  const bounds = useMemo(() => (scene ? sceneBounds(scene) : { minX: 0, maxX: 0 }), [scene]);

  useEffect(() => {
    if (scene) textures.setActiveScene(scene.id);
  }, [scene, textures]);

  useEffect(() => {
    game.setAssetSizeLookup((key) => textures.registry.size(key));
  }, [game, textures]);

  const handleViewport = useCallback(
    (v: Viewport) => {
      setViewport(v);
      viewportW.set(v.viewportW);
      // HU-GAME-005 R6 / HU-GAME-007 R9: keep the camera inside the new bounds.
      const clamped = clampCameraX(cameraX.get(), bounds, v.viewportW);
      cameraX.set(clamped);
      lastCullX.set(clamped);
      setCullX(clamped);
      onViewport?.(v);
    },
    [bounds, cameraX, lastCullX, viewportW, onViewport],
  );

  const settle = useCallback(
    (x: number) => {
      const w = viewport?.viewportW ?? viewportW.get();
      if (w > 0) game.dispatch({ type: 'cameraSettled', cameraX: x, viewportW: w });
      setCullX(x);
    },
    [game, viewport, viewportW],
  );

  // Culling window follows the camera only past the threshold; never a React render per frame.
  useAnimatedReaction(
    () => cameraX.get(),
    (x) => {
      const w = viewportW.get();
      if (w > 0 && Math.abs(x - lastCullX.get()) > w * CULLING_RECOMPUTE_RATIO) {
        lastCullX.set(x);
        scheduleOnRN(setCullX, x);
      }
    },
  );

  useImperativeHandle(
    cameraRef,
    () => ({
      jumpTo(x: number) {
        const w = viewportW.get();
        if (!(w > 0)) return;
        const target = cameraTargetFor(x, bounds, w);
        cameraX.set(
          withTiming(target, { duration: CAMERA_JUMP_MS }, (finished) => {
            if (finished) scheduleOnRN(settle, target);
          }),
        );
      },
      setCameraX(x: number) {
        const w = viewportW.get();
        const clamped = w > 0 ? clampCameraX(x, bounds, w) : x;
        cameraX.set(clamped);
        lastCullX.set(clamped);
        setCullX(clamped);
      },
      viewport: () => viewport,
    }),
    [bounds, cameraX, lastCullX, settle, viewport, viewportW],
  );

  const visible = useVisibleEntities(viewport ? { cameraX: cullX, viewportW: viewport.viewportW } : undefined);

  if (!scene) return null;
  return (
    <SceneCanvas
      scene={scene}
      textures={textures}
      cameraX={cameraX}
      cullX={cullX}
      onViewportChange={handleViewport}
      onCameraSettled={settle}
      resolveTarget={resolveTarget}
      showGrid={showGrid}>
      {visible.map((d) => (
        <EntityNode key={d.id} id={d.id} textures={textures} />
      ))}
    </SceneCanvas>
  );
}
