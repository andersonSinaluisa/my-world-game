import { ACTIONS } from '../actions';
import { fail, PASS, type ActionEnv, type Check, type InteractionContext } from '../actions/types';
import type { RegisteredRule } from '../content/registry';
import type { ActionSpec } from '../content/schemas';
import type { Entity } from '../core/entity';
import type { EntityId, WorldPoint } from '../core/types';
import { placeItem } from '../systems/surface-system';
import { CONDITIONS } from './conditions';
import { hitTest, type HitCandidate } from './hit-test';
import { matches, matchesTarget, specificity } from './matcher';
import type { RuleIndex, Trigger } from './rule-index';

export interface ResolveInput {
  trigger: Trigger;
  sourceId?: EntityId;
  point: WorldPoint;
  /** Drop target of UI (the backpack), front-most when the point is over it (INTERACTION_SYSTEM §3). */
  uiTarget?: 'inventory' | 'trash';
  minHitWorld?: number;
}

/** Result of a drop preview (INTERACTION_SYSTEM §6, HU-GAME-033). */
export interface PreviewOutcome {
  targetId?: EntityId;
  zone?: string;
  ruleId?: string;
  /** true: the rule would run; false: a rule matches but a condition/action would fail. */
  ok: boolean;
  reason?: string;
  /** false when the rule sets feedback.highlight: false. */
  highlight: boolean;
  rejectHint?: string;
}

export type ResolveOutcome =
  | { kind: 'performed'; ruleId: string; targetId?: EntityId; startDrag?: EntityId }
  | { kind: 'rejected'; ruleId: string; reason: string; targetId?: EntityId }
  | { kind: 'none'; targetId?: EntityId };

interface Candidate {
  rule: RegisteredRule;
  target?: HitCandidate & { entity: Entity };
  rank: number; // front-most candidate = 0
}

/** Entities the source carries (held/worn) are never its own targets (HU-GAME-031 R3.1). */
function carriedSet(env: ActionEnv, sourceId: EntityId | undefined): Set<EntityId> {
  const out = new Set<EntityId>();
  if (!sourceId) return out;
  out.add(sourceId);
  for (const id of env.world.index.heldBy(sourceId)) out.add(id);
  for (const id of Object.values(env.world.index.wornBy(sourceId))) if (id) out.add(id);
  return out;
}

function disabledFor(rule: RegisteredRule, prefabDisabled: (e: Entity | undefined) => string[], ...entities: (Entity | undefined)[]) {
  return entities.some((e) => prefabDisabled(e).includes(rule.qualifiedId));
}

/**
 * InteractionResolver + ActionExecutor (INTERACTION_SYSTEM §2-§3, INTERACTION_SCHEMA §6).
 * Deterministic: priority → front-most candidate → specificity → id.
 */
export class InteractionResolver {
  constructor(
    private readonly env: () => ActionEnv | undefined,
    private readonly index: RuleIndex,
    private readonly prefabDisabledRules: (e: Entity | undefined) => string[],
    private readonly heldTransform?: (e: Entity) => Entity['components']['transform'] | undefined,
  ) {}

  candidates(input: ResolveInput): Candidate[] {
    const env = this.env();
    if (!env) return [];
    const source = input.sourceId ? env.world.get(input.sourceId) : undefined;
    const hits = hitTest(env.world, input.point, {
      sceneId: env.scene.id,
      minHitWorld: input.minHitWorld,
      exclude: carriedSet(env, input.sourceId),
      // Input transparency (INPUT_SYSTEM §5.3) applies to taps; any entity with a hitbox can receive a drop.
      hasDirectRules: input.trigger === 'drop' ? () => true : (e) => this.index.hasDirectRules(e),
      heldTransform: this.heldTransform,
    });
    const out: Candidate[] = [];
    const rules = this.index.rules(input.trigger);
    if (input.uiTarget) {
      // The HUD button covers the world below it: only its rules are candidates (HU-GAME-037 R3).
      for (const rule of rules) {
        if (rule.target.ui === input.uiTarget && (!source || matches(source, rule.source))) {
          if (!disabledFor(rule, this.prefabDisabledRules, source)) out.push({ rule, rank: -1 });
        }
      }
      return out.sort((a, b) => (b.rule.priority ?? 0) - (a.rule.priority ?? 0) || (a.rule.qualifiedId < b.rule.qualifiedId ? -1 : 1));
    }
    hits.forEach((hit, rank) => {
      const entity = env.world.get(hit.id)!;
      for (const rule of rules) {
        if (rule.ownerPrefab) {
          const owner = input.trigger === 'drop' ? source : entity;
          if (owner?.prefabId !== rule.ownerPrefab) continue;
        }
        if (input.trigger === 'drop' && (!source || !matches(source, rule.source))) continue;
        if (!matchesTarget(entity, rule.target, hit.zone)) continue;
        if (disabledFor(rule, this.prefabDisabledRules, source, entity)) continue;
        out.push({ rule, target: { ...hit, entity }, rank });
      }
    });
    return out.sort(
      (a, b) =>
        (b.rule.priority ?? 0) - (a.rule.priority ?? 0) ||
        a.rank - b.rank ||
        specificity(b.rule.source) + specificity(b.rule.target) - (specificity(a.rule.source) + specificity(a.rule.target)) ||
        (a.rule.qualifiedId < b.rule.qualifiedId ? -1 : a.rule.qualifiedId > b.rule.qualifiedId ? 1 : 0),
    );
  }

  /**
   * What a drop here would do, without executing anything (R2): same candidates and order as `resolve`,
   * conditions evaluated and actions only validated. Never changes the World.
   */
  preview(input: ResolveInput): PreviewOutcome {
    const env = this.env();
    if (!env) return { ok: false, highlight: false };
    let firstFailure: PreviewOutcome | undefined;
    for (const c of this.candidates(input)) {
      const ctx: InteractionContext = {
        env,
        trigger: input.trigger,
        sourceId: input.sourceId,
        targetId: c.target?.id,
        zone: c.target?.zone,
        point: input.point,
        ruleId: c.rule.qualifiedId,
        output: {},
      };
      const base = { targetId: c.target?.id, zone: c.target?.zone, ruleId: c.rule.qualifiedId };
      const cond = this.checkConditions(ctx, c.rule);
      const check = cond.ok ? this.validateOnly(ctx, c.rule.actions) : cond;
      if (check.ok) return { ...base, ok: true, highlight: c.rule.feedback?.highlight !== false };
      const failure: PreviewOutcome = { ...base, ok: false, reason: check.reason, highlight: false, rejectHint: c.rule.feedback?.rejectHint };
      // Like `resolve`: a failing condition lets the next candidate try; a failing action ends the search.
      if (!cond.ok) {
        firstFailure ??= failure;
        continue;
      }
      return failure;
    }
    return firstFailure ?? { ok: false, highlight: false };
  }

  private validateOnly(ctx: InteractionContext, specs: ActionSpec[]): Check {
    for (const spec of specs) {
      const handler = ACTIONS[spec.type];
      if (!handler) return fail(`unknownAction:${spec.type}`);
      const { type: _type, ...rest } = spec;
      void _type;
      const params = handler.params.safeParse(rest);
      if (!params.success) return fail(`invalidParams:${spec.type}`);
      const v = handler.validate(ctx, params.data as never);
      if (!v.ok) return v;
    }
    return PASS;
  }

  resolve(input: ResolveInput): ResolveOutcome {
    const env = this.env();
    if (!env) return { kind: 'none' };
    const ordered = this.candidates(input);
    let firstFailure: { c: Candidate; reason: string } | undefined;
    for (const c of ordered) {
      const ctx: InteractionContext = {
        env,
        trigger: input.trigger,
        sourceId: input.sourceId,
        targetId: c.target?.id,
        zone: c.target?.zone,
        point: input.point,
        ruleId: c.rule.qualifiedId,
        output: {},
      };
      const cond = this.checkConditions(ctx, c.rule);
      if (!cond.ok) {
        firstFailure ??= { c, reason: cond.reason };
        continue;
      }
      const result = this.execute(ctx, c.rule.actions);
      if (result.ok) {
        env.world.emit({
          type: 'interactionPerformed',
          ruleId: c.rule.qualifiedId,
          sourceId: input.sourceId,
          targetId: c.target?.id,
          uiTarget: c.target ? undefined : c.rule.target.ui,
          actions: c.rule.actions.map((a) => a.type),
        });
        return { kind: 'performed', ruleId: c.rule.qualifiedId, targetId: c.target?.id, startDrag: ctx.output.startDrag };
      }
      // An action that does not validate cancels the whole rule (INTERACTION_SCHEMA §6).
      return this.reject(env, input, c, result.reason);
    }
    if (firstFailure) return this.reject(env, input, firstFailure.c, firstFailure.reason);
    // No rule matched at all.
    if (input.trigger === 'drop' && input.sourceId) this.place(env, input.sourceId, input.point);
    if (input.trigger === 'tap') {
      const front = hitTest(env.world, input.point, {
        sceneId: env.scene.id,
        minHitWorld: input.minHitWorld,
        hasDirectRules: (e) => this.index.hasDirectRules(e),
        heldTransform: this.heldTransform,
      })[0];
      if (front) env.effects.trigger(front.id, 'tap');
      return { kind: 'none', targetId: front?.id };
    }
    return { kind: 'none' };
  }

  private checkConditions(ctx: InteractionContext, rule: RegisteredRule): Check {
    for (const spec of rule.conditions ?? []) {
      const handler = CONDITIONS[spec.type];
      if (!handler) return fail(`unknownCondition:${spec.type}`);
      const params = handler.params.safeParse(spec);
      if (!params.success) return fail(`invalidCondition:${spec.type}`);
      const r = handler.evaluate(ctx, params.data as never);
      if (!r.ok) return r;
    }
    return PASS;
  }

  /** Validate all actions, then execute them in one transaction; any failure rolls back. */
  private execute(ctx: InteractionContext, specs: ActionSpec[]): Check {
    const prepared: { handler: (typeof ACTIONS)[string]; params: never }[] = [];
    for (const spec of specs) {
      const handler = ACTIONS[spec.type];
      if (!handler) return fail(`unknownAction:${spec.type}`);
      const { type: _type, ...rest } = spec;
      void _type;
      const params = handler.params.safeParse(rest);
      if (!params.success) return fail(`invalidParams:${spec.type}`);
      prepared.push({ handler, params: params.data as never });
    }
    for (const p of prepared) {
      const v = p.handler.validate(ctx, p.params);
      if (!v.ok) return v;
    }
    try {
      ctx.env.world.transaction(() => {
        for (const p of prepared) {
          const v = p.handler.validate(ctx, p.params);
          if (!v.ok) throw new ActionFailed(v.reason);
          p.handler.execute(ctx, p.params);
        }
      });
      return PASS;
    } catch (e) {
      if (e instanceof ActionFailed) return fail(e.reason);
      ctx.env.logger.error('Action threw; transaction rolled back', { error: String(e), ruleId: ctx.ruleId });
      return fail('actionError');
    }
  }

  private reject(env: ActionEnv, input: ResolveInput, c: Candidate, reason: string): ResolveOutcome {
    env.world.transaction(() => {
      env.world.emit({
        type: 'interactionRejected',
        ruleId: c.rule.qualifiedId,
        reason,
        sourceId: input.sourceId,
        targetId: c.target?.id,
        uiTarget: c.target ? undefined : c.rule.target.ui,
      });
      if (c.target) env.effects.rejected(c.target.id);
      // Fallback of the failing rule (HU-GAME-031 R3.6). 'returnToOrigin' arrives with HU-GAME-064/066.
      if (input.trigger === 'drop' && input.sourceId) this.place(env, input.sourceId, input.point);
    });
    return { kind: 'rejected', ruleId: c.rule.qualifiedId, reason, targetId: c.target?.id };
  }

  private place(env: ActionEnv, id: EntityId, point: WorldPoint) {
    const e = env.world.get(id);
    if (e?.location.kind === 'scene') placeItem(env.world, env.scene, id, point, env.logger);
  }
}

class ActionFailed extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}
