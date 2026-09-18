import type { EntityInit } from '@/engine/core/entity';
import type { Location } from '@/engine/core/location';
import type { WorldPoint } from '@/engine/core/types';

/** World point helper. */
export const p = (x: number, y: number): WorldPoint => ({ x, y });

export const TEST_SCENE_ID = 'test:room';

/**
 * Builds a valid EntityInit with sensible defaults (in scene `test:room`, with a transform).
 * Override anything; pass `components: { transform: undefined }` to drop the default transform.
 */
export function entity(
  id: string,
  overrides: Partial<Omit<EntityInit, 'id'>> & { at?: WorldPoint } = {},
): EntityInit {
  const { at, components, ...rest } = overrides;
  const location: Location = rest.location ?? { kind: 'scene', sceneId: TEST_SCENE_ID };
  const base: Record<string, unknown> = location.kind === 'scene' ? { transform: { x: at?.x ?? 100, y: at?.y ?? 960 } } : {};
  return {
    id,
    tags: [],
    ...rest,
    location,
    components: Object.fromEntries(Object.entries({ ...base, ...components }).filter(([, v]) => v !== undefined)),
  };
}
