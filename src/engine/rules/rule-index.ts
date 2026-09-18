import type { Entity } from '../core/entity';
import type { RegisteredRule } from '../content/registry';
import { matches } from './matcher';

export type Trigger = 'drop' | 'tap' | 'longPress';

/**
 * Rules indexed by trigger (INTERACTION_SYSTEM §2). Local prefab rules (extraRules) only apply when
 * their owner prefab is the source (drop) or the target (tap/longPress).
 */
export class RuleIndex {
  private byTrigger = new Map<Trigger, RegisteredRule[]>();

  constructor(rules: RegisteredRule[]) {
    for (const r of rules) {
      const list = this.byTrigger.get(r.trigger) ?? [];
      list.push(r);
      this.byTrigger.set(r.trigger, list);
    }
  }

  rules(trigger: Trigger): RegisteredRule[] {
    return this.byTrigger.get(trigger) ?? [];
  }

  /** Does any tap/longPress rule target this entity? Used to decide input transparency (HU-GAME-026 R5). */
  hasDirectRules(entity: Entity): boolean {
    for (const trigger of ['tap', 'longPress'] as const) {
      for (const r of this.rules(trigger)) {
        if (r.ownerPrefab && r.ownerPrefab !== entity.prefabId) continue;
        if (matches(entity, r.target)) return true;
      }
    }
    return false;
  }
}
