import type { AssetKey, SceneId } from '../core/types';

/**
 * Minimal runtime view of a scene definition needed by the camera, culling and render
 * (subset of SCENE_SCHEMA §2). HU-GAME-010 loads the full SceneDefinition from JSON and fills this.
 */
export interface BackgroundChunk {
  asset: AssetKey;
  x: number;
  width: number;
}

export interface BackgroundLayer {
  id: string;
  chunks: BackgroundChunk[];
  parallax?: number;
  y?: number;
}

export interface SceneBounds {
  minX: number;
  maxX: number;
}

export interface ActiveSceneInfo {
  id: SceneId;
  size: { width: number; height: 1080 };
  bounds?: SceneBounds;
  background: { layers: BackgroundLayer[] };
}

export const WORLD_HEIGHT = 1080;

export function sceneBounds(scene: Pick<ActiveSceneInfo, 'size' | 'bounds'>): SceneBounds {
  return scene.bounds ?? { minX: 0, maxX: scene.size.width };
}
