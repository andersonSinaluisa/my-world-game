import type { ComponentMap, Components } from '../components/registry';
import type { Location } from './location';
import type { EntityId, PrefabId } from './types';

/** ECS §2: an entity is data only. It never has methods. */
export interface Entity {
  readonly id: EntityId;
  readonly prefabId?: PrefabId;
  readonly tags: readonly string[];
  readonly location: Location;
  readonly components: Readonly<Components>;
}

/** Replace-semantics patch: each key replaces the whole component; `null` removes it. */
export type ComponentPatch = { [K in keyof ComponentMap]?: ComponentMap[K] | null };

export interface EntityInit {
  id: EntityId;
  prefabId?: PrefabId;
  tags?: string[];
  location: Location;
  components: Record<string, unknown>;
}
