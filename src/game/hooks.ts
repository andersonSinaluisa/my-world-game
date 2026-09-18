import { useCallback, useSyncExternalStore } from 'react';

import type { Entity } from '@/engine/core/entity';
import type { EntityId } from '@/engine/core/types';
import type { ActiveSceneInfo } from '@/engine/scene/scene-types';

import type { CharacterLayerData } from '@/engine/characters/layers';

import type { EntityRenderData, GameFacade, ViewportQuery } from './facade';
import { useGame } from './game-context';

/** Re-renders only when this entity changes (PERFORMANCE §4 rule 2). */
export function useEntity(id: EntityId): Entity | undefined {
  return useEntityOf(useGame(), id);
}

/**
 * Same as useEntity with an explicit facade. Required inside the Skia <Canvas>: its reconciler does not
 * reliably forward React context from the host tree.
 */
export function useEntityOf(game: GameFacade, id: EntityId): Entity | undefined {
  const subscribe = useCallback((listener: () => void) => game.subscribeEntity(id, listener), [game, id]);
  const get = useCallback(() => game.getEntity(id), [game, id]);
  return useSyncExternalStore(subscribe, get, get);
}

/** Visible, sorted entities for the renderer. Pass the culling viewport (HU-GAME-008) or undefined for all. */
export function useVisibleEntities(viewport?: ViewportQuery): EntityRenderData[] {
  const game = useGame();
  const cameraX = viewport?.cameraX;
  const viewportW = viewport?.viewportW;
  const get = useCallback(
    () =>
      game.selectors.visibleEntities(
        cameraX === undefined || viewportW === undefined ? undefined : { cameraX, viewportW },
      ),
    [game, cameraX, viewportW],
  );
  return useSyncExternalStore(game.subscribe, get, get);
}

export function useActiveScene(): ActiveSceneInfo | undefined {
  const game = useGame();
  const get = useCallback(() => game.selectors.activeScene(), [game]);
  return useSyncExternalStore(game.subscribe, get, get);
}

/** Active zone (room) of the camera (HU-GAME-012). */
export function useActiveZone(): string | undefined {
  const game = useGame();
  const get = useCallback(() => game.selectors.activeZone(), [game]);
  return useSyncExternalStore(game.subscribe, get, get);
}

/** Character layers (HU-GAME-013). Explicit facade: used inside the Skia Canvas, where context is unavailable. */
export function useCharacterLayersOf(game: GameFacade, id: EntityId): CharacterLayerData[] {
  const get = useCallback(() => game.selectors.characterLayers(id), [game, id]);
  return useSyncExternalStore(game.subscribe, get, get);
}
