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

export interface FloorSegment {
  y: number;
  x1?: number;
  x2?: number;
}

export interface SpawnPointInfo {
  id: string;
  x: number;
  y: number;
  facing?: 'left' | 'right';
}

export interface ZoneInfo {
  id: string;
  name: string;
  x1: number;
  x2: number;
  snapCameraX?: number;
  audio?: { music?: string; ambience?: string };
}

export interface ActiveSceneInfo {
  id: SceneId;
  size: { width: number; height: 1080 };
  bounds?: SceneBounds;
  background: { layers: BackgroundLayer[] };
  /** Floor segments (absolute). Defaults to a single floor at y = DEFAULT_FLOOR_Y when absent (sandbox). */
  floor?: FloorSegment[];
  spawnPoints?: SpawnPointInfo[];
  zones?: ZoneInfo[];
  camera?: { startX?: number; startSpawnId?: string };
  /** Default music and ambience of the scene; zones may override them (HU-GAME-057). */
  audio?: { music?: string; ambience?: string };
}

export const DEFAULT_FLOOR_Y = 960;

export const WORLD_HEIGHT = 1080;

export function sceneBounds(scene: Pick<ActiveSceneInfo, 'size' | 'bounds'>): SceneBounds {
  return scene.bounds ?? { minX: 0, maxX: scene.size.width };
}
