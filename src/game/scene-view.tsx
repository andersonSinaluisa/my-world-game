import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useState, type Ref } from 'react';
import { useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { WorldInputHandlers } from '@/engine/adapters/input/use-world-gesture';
import { DragProxy } from '@/engine/adapters/render/drag-proxy';
import { SceneCanvas } from '@/engine/adapters/render/scene-canvas';
import { SpriteNode } from '@/engine/adapters/render/sprite-node';
import type { TextureStore } from '@/engine/adapters/render/texture-store';
import type { Viewport } from '@/engine/adapters/render/viewport';
import type { Transform } from '@/engine/components/base';
import type { AssetKey, EntityId } from '@/engine/core/types';
import { MIN_HIT_DP } from '@/engine/rules/hit-test';
import { CAMERA_JUMP_MS, cameraTargetFor, clampCameraX } from '@/engine/scene/camera-math';
import { CULLING_RECOMPUTE_RATIO } from '@/engine/scene/culling';
import { sceneBounds } from '@/engine/scene/scene-types';
import { zoneSnapX } from '@/engine/scene/zones';

import { resolveAsset, type GameFacade } from './facade';
import { useGame } from './game-context';
import { useActiveScene, useEntityOf, useVisibleEntities } from './hooks';

export interface CameraController {
  /** Centers the camera on world x with a 450 ms animation (RENDERING §5), then reports cameraSettled. */
  jumpTo(x: number): void;
  /** Jumps to a zone of the active scene: snapCameraX or its middle (HU-GAME-012 R4). False if unknown. */
  jumpToZone(zoneId: string): boolean;
  /** Places the camera immediately (scene entry, HU-GAME-010). */
  setCameraX(x: number): void;
  viewport(): Viewport | null;
}

export interface SceneViewProps {
  textures: TextureStore;
  showGrid?: boolean;
  /** Tap and drag of world objects (HU-GAME-027/031). Off = the canvas only pans (render sandbox). */
  interactive?: boolean;
  cameraRef?: Ref<CameraController>;
  onViewport?: (viewport: Viewport) => void;
}

interface DragVisual {
  id: EntityId;
  asset: AssetKey;
  transform: Transform;
  pivot: { x: number; y: number };
  size?: { w: number; h: number };
  liftOffset?: number;
  grabOffset: { x: number; y: number };
}

interface EntityNodeProps {
  /** Passed explicitly: this renders inside the Skia <Canvas>, where React context is not available. */
  game: GameFacade;
  id: EntityId;
  textures: TextureStore;
  hidden: boolean;
}

/** Subscribes to a single entity so only it re-renders when it changes (PERFORMANCE §4 rule 2). */
const EntityNode = memo(function EntityNode({ game, id, textures, hidden }: EntityNodeProps) {
  const entity = useEntityOf(game, id);
  const sprite = entity?.components.sprite;
  // The original is hidden while its DragProxy is on screen (HU-GAME-027 R5).
  if (hidden || !entity || !sprite || entity.location.kind !== 'scene') return null;
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
 * World view for the active scene: Skia canvas + camera + culled, sorted entities + drag proxy.
 * The camera and the dragged item live in SharedValues; React only re-renders when the culling window
 * moves past its threshold (10 % of the viewport, RENDERING §7), when entities change, or when a drag
 * starts/ends.
 */
export function SceneView({ textures, showGrid, interactive = true, cameraRef, onViewport }: SceneViewProps) {
  const game = useGame();
  const scene = useActiveScene();
  const cameraX = useSharedValue(game.selectors.cameraX() ?? 0);
  const lastCullX = useSharedValue(game.selectors.cameraX() ?? 0);
  const viewportW = useSharedValue(0);
  const pointerX = useSharedValue(0);
  const pointerY = useSharedValue(0);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [cullX, setCullX] = useState(() => game.selectors.cameraX() ?? 0);
  const [drag, setDrag] = useState<DragVisual | null>(null);

  const bounds = useMemo(() => (scene ? sceneBounds(scene) : { minX: 0, maxX: 0 }), [scene]);

  useEffect(() => {
    if (scene) textures.setActiveScene(scene.id);
  }, [scene, textures]);

  useEffect(() => {
    game.setAssetSizeLookup((key) => textures.registry.size(key));
  }, [game, textures]);

  // A new scene places the camera where the engine decided (sceneLoaded.cameraX, SCENE_SYSTEM §2 step 6).
  // The initial scene is read on mount (initial values above); later ones arrive as events.
  useEffect(
    () =>
      game.events.subscribe((batch) => {
        for (const event of batch) {
          if (event.type !== 'sceneLoaded') continue;
          const active = game.selectors.activeScene();
          const w = viewportW.get();
          const x = event.cameraX ?? 0;
          const clamped = active && w > 0 ? clampCameraX(x, sceneBounds(active), w) : x;
          cameraX.set(clamped);
          lastCullX.set(clamped);
          setCullX(clamped);
          setDrag(null);
        }
      }),
    [game, cameraX, lastCullX, viewportW],
  );

  const handleViewport = useCallback(
    (v: Viewport) => {
      setViewport(v);
      viewportW.set(v.viewportW);
      game.dispatch({ type: 'viewportChanged', viewportW: v.viewportW });
      // HU-GAME-005 R6 / HU-GAME-007 R9: keep the camera inside the new bounds.
      const clamped = clampCameraX(cameraX.get(), bounds, v.viewportW);
      cameraX.set(clamped);
      lastCullX.set(clamped);
      setCullX(clamped);
      onViewport?.(v);
    },
    [bounds, cameraX, lastCullX, viewportW, onViewport, game],
  );

  const settle = useCallback(
    (x: number) => {
      const w = viewport?.viewportW ?? viewportW.get();
      if (w > 0) game.dispatch({ type: 'cameraSettled', cameraX: x, viewportW: w });
      setCullX(x);
    },
    [game, viewport, viewportW],
  );

  const input = useMemo<WorldInputHandlers | undefined>(() => {
    if (!interactive) return undefined;
    // INPUT_SYSTEM §8: 44 dp minimum touch size, converted to world units with the current scale.
    const minHitWorld = viewport ? MIN_HIT_DP / viewport.scale : undefined;
    return {
      pickDraggable: (x, y) => game.pickDraggable({ x, y }, minHitWorld),
      dragStart(id, x, y) {
        const result = game.dispatch({ type: 'dragStart', entityId: id, worldPoint: { x, y } });
        const e = game.getEntity(id);
        const sprite = e?.components.sprite;
        if (!result.ok || !e || !sprite) return false;
        const t = e.components.transform ?? { x, y };
        setDrag({
          id,
          asset: resolveAsset(e),
          transform: t,
          pivot: sprite.pivot ?? { x: 0.5, y: 1 },
          size: sprite.size,
          liftOffset: e.components.draggable?.liftOffset,
          grabOffset: { x: x - t.x, y: y - t.y },
        });
        return true;
      },
      dragEnd(id, x, y) {
        game.dispatch({ type: 'dragEnd', entityId: id, worldPoint: { x, y }, minHitWorld });
        setDrag(null);
      },
      dragCancel(id) {
        game.dispatch({ type: 'dragCancel', entityId: id });
        setDrag(null);
      },
      tap(x, y) {
        game.dispatch({ type: 'pointerTap', worldPoint: { x, y }, minHitWorld });
      },
    };
  }, [game, interactive, viewport]);

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

  const jumpTo = useCallback(
    (x: number) => {
      const w = viewportW.get();
      if (!(w > 0)) return;
      const target = cameraTargetFor(x, bounds, w);
      cameraX.set(
        withTiming(target, { duration: CAMERA_JUMP_MS }, (finished) => {
          if (finished) scheduleOnRN(settle, target);
        }),
      );
    },
    [bounds, cameraX, settle, viewportW],
  );

  useImperativeHandle(
    cameraRef,
    () => ({
      jumpTo,
      jumpToZone(zoneId: string) {
        const zone = scene?.zones?.find((z) => z.id === zoneId);
        if (!zone) return false;
        jumpTo(zoneSnapX(zone));
        return true;
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
    [bounds, cameraX, lastCullX, jumpTo, scene, viewport, viewportW],
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
      input={input}
      pointerX={pointerX}
      pointerY={pointerY}
      showGrid={showGrid}
      overlay={
        drag && (
          <DragProxy
            asset={drag.asset}
            transform={drag.transform}
            pivot={drag.pivot}
            size={drag.size}
            grabOffset={drag.grabOffset}
            liftOffset={drag.liftOffset}
            pointerX={pointerX}
            pointerY={pointerY}
            textures={textures}
          />
        )
      }>
      {visible.map((d) => (
        <EntityNode key={d.id} game={game} id={d.id} textures={textures} hidden={drag?.id === d.id} />
      ))}
    </SceneCanvas>
  );
}
