import type { ActiveSceneInfo, ZoneInfo } from './scene-types';

/**
 * Zones (rooms) inside a scene (SCENE_SYSTEM §3, HU-GAME-012). Pure functions.
 * Zones never block movement and are not stored on entities.
 */

/** Zone with x1 ≤ x < x2 (half-open interval, R1), or undefined. */
export function zoneAt(zones: readonly ZoneInfo[] | undefined, x: number): ZoneInfo | undefined {
  return zones?.find((z) => z.x1 <= x && x < z.x2);
}

/** World x at the center of the viewport. Without a known viewport, the camera x itself. */
export function cameraCenterX(cameraX: number, viewportW: number | undefined): number {
  return cameraX + (viewportW ?? 0) / 2;
}

/**
 * Active zone for a camera position (R2). In a gap between zones the previous zone is kept, so the
 * zone music is not cut (edge case of HU-GAME-012).
 */
export function activeZoneFor(
  scene: Pick<ActiveSceneInfo, 'zones'>,
  cameraX: number,
  viewportW: number | undefined,
  previous: string | undefined,
): string | undefined {
  const zone = zoneAt(scene.zones, cameraCenterX(cameraX, viewportW));
  if (zone) return zone.id;
  return previous && scene.zones?.some((z) => z.id === previous) ? previous : undefined;
}

/** World x to center when jumping to a zone (R4): snapCameraX, else the middle of the zone. */
export function zoneSnapX(zone: Pick<ZoneInfo, 'x1' | 'x2' | 'snapCameraX'>): number {
  return zone.snapCameraX ?? (zone.x1 + zone.x2) / 2;
}
