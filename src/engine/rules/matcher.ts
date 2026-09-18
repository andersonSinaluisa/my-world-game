import type { Entity } from '../core/entity';
import type { Matcher, TargetMatcher } from '../content/schemas';

/** INTERACTION_SCHEMA §2 matchers. Pure; capability-based, never by category (OBJECT_SCHEMA §3). */
export function matches(entity: Entity, m: Matcher | undefined): boolean {
  if (!m) return true;
  const comps = entity.components as Record<string, unknown>;
  if (m.has && !m.has.every((c) => comps[c] !== undefined)) return false;
  if (m.tags && !m.tags.every((t) => entity.tags.includes(t))) return false;
  if (m.anyTags && !m.anyTags.some((t) => entity.tags.includes(t))) return false;
  if (m.notTags && m.notTags.some((t) => entity.tags.includes(t))) return false;
  if (m.state !== undefined && entity.components.states?.current !== m.state) return false;
  if (m.prefabId !== undefined && entity.prefabId !== m.prefabId) return false;
  return true;
}

export function matchesTarget(entity: Entity, m: TargetMatcher, zone: string | undefined): boolean {
  if (m.ui) return false; // UI targets never match entities
  if (!matches(entity, m)) return false;
  if (m.zone !== undefined) {
    const zones = Array.isArray(m.zone) ? m.zone : [m.zone];
    if (!zone || !zones.includes(zone)) return false;
  }
  return true;
}

/** Number of constraints: used as the specificity tie-break (INTERACTION_SYSTEM §3 step 4). */
export function specificity(m: Matcher | TargetMatcher | undefined): number {
  if (!m) return 0;
  const t = m as TargetMatcher;
  return (
    (m.has?.length ?? 0) +
    (m.tags?.length ?? 0) +
    (m.anyTags?.length ? 1 : 0) +
    (m.notTags?.length ?? 0) +
    (m.state !== undefined ? 1 : 0) +
    (m.prefabId !== undefined ? 1 : 0) +
    (t.zone !== undefined ? 1 : 0) +
    (t.ui !== undefined ? 1 : 0)
  );
}
