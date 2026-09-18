import { PERSISTENT_POSES, type Appearance, type Expression, type ExpressionId, type Pose, type PoseId } from '../components/base';
import type { EntityInit } from '../core/entity';
import type { EventBus } from '../core/events';
import type { Location } from '../core/location';
import type { Clock, Logger, Scheduler } from '../core/runtime';
import type { EntityId } from '../core/types';
import type { World } from '../core/world';
import type { BodyTypeDef, CharacterPartsCatalog } from './catalog';
import { characterHitbox, characterSprite } from './hitbox';

/** HU-GAME-014 R3: eat and drink last about 900 ms. */
export const TEMPORARY_POSE_MS = 900;
/** HU-GAME-015 R3: tap → happy for 1.5 s. */
export const TAP_EXPRESSION_MS = 1500;
/** HU-GAME-022 R2 / CHARACTER_SCHEMA §6. */
export const MAX_CHARACTERS = 12;

const TEMPORARY: readonly PoseId[] = ['dangle', 'eat', 'drink'];

/** Valid transitions (CHARACTER_SYSTEM §8, HU-GAME-014 R5). Temporary poses may always go to dangle (R4). */
const TRANSITIONS: Record<PoseId, readonly PoseId[]> = {
  idle: ['dangle', 'eat', 'drink'],
  dangle: ['idle', 'sit', 'sleep'],
  sit: ['dangle', 'eat', 'drink'],
  sleep: ['dangle'],
  eat: ['idle', 'sit', 'dangle'],
  drink: ['idle', 'sit', 'dangle'],
};

/** Expressions bound to a pose last while the pose lasts (HU-GAME-015 R4, R7). */
const POSE_EXPRESSION: Partial<Record<PoseId, ExpressionId>> = { dangle: 'surprised', eat: 'yum', drink: 'yum', sleep: 'sleepy' };

export const isTemporaryPose = (pose: PoseId) => TEMPORARY.includes(pose);

/** Pose as saved: temporary poses become returnTo or idle (HU-GAME-014 R2, SAVE_SCHEMA §2). */
export function persistedPose(pose: Pose): Pose {
  if (PERSISTENT_POSES.includes(pose.current)) {
    return pose.seatId ? { current: pose.current, seatId: pose.seatId } : { current: pose.current };
  }
  const back = pose.returnTo && PERSISTENT_POSES.includes(pose.returnTo) ? pose.returnTo : 'idle';
  return back !== 'idle' && pose.seatId ? { current: back, seatId: pose.seatId } : { current: back };
}

export interface DragOrigin {
  pose?: Pose;
}

export interface NewCharacter {
  id: EntityId;
  appearance: Appearance;
  location: Location;
  x: number;
  y: number;
  createdAt: string;
  colorTag?: string;
}

/**
 * CharacterSystem (ECS §5): poses, expressions and the components derived from the catalog.
 * Timers use the injected scheduler (one per character, never a per-frame tick; CHARACTER_SYSTEM §9).
 */
export class CharacterSystem {
  private poseTimers = new Map<EntityId, unknown>();
  private expressionTimers = new Map<EntityId, unknown>();

  constructor(
    private readonly world: World,
    bus: EventBus,
    private readonly clock: Clock,
    private readonly scheduler: Scheduler,
    private readonly logger: Logger,
    private readonly catalog: () => CharacterPartsCatalog | undefined,
  ) {
    bus.subscribe((batch) => {
      for (const e of batch) if (e.type === 'entityRemoved' && !e.unload) this.cancelTimers(e.id);
    });
  }

  body(bodyType: string): BodyTypeDef | undefined {
    const c = this.catalog();
    return c?.bodyTypes.find((b) => b.id === bodyType) ?? c?.bodyTypes[0];
  }

  /** Components that are never saved: sprite + hitbox from the body, neutral expression (hydration). */
  derived(appearance: Appearance): Record<string, unknown> {
    const body = this.body(appearance.bodyType);
    const out: Record<string, unknown> = { expression: { current: 'neutral' } satisfies Expression };
    if (body) {
      out.sprite = characterSprite(body);
      out.hitbox = characterHitbox(body);
    }
    return out;
  }

  /** Completes a saved or newly built character with its derived components; temporary poses normalized. */
  hydrate(init: EntityInit): EntityInit {
    const c = init.components as { appearance?: Appearance; pose?: Pose; draggable?: object; holder?: object };
    if (!c.appearance) return init;
    return {
      ...init,
      tags: [...new Set([...(init.tags ?? []), 'character'])],
      components: {
        draggable: {},
        holder: { hands: ['left', 'right'] },
        ...init.components,
        pose: persistedPose(c.pose ?? { current: 'idle' }),
        ...this.derived(c.appearance),
      },
    };
  }

  /** EntityInit of a new player character (HU-GAME-022 R1). Clothes are created by the caller. */
  newCharacter(n: NewCharacter): EntityInit {
    return this.hydrate({
      id: n.id,
      tags: ['character'],
      location: n.location,
      components: {
        transform: { x: n.x, y: n.y },
        character: { isNpc: false, createdAt: n.createdAt, ...(n.colorTag ? { colorTag: n.colorTag } : {}) },
        appearance: n.appearance,
        holder: { hands: ['left', 'right'] },
        pose: { current: 'idle' },
        draggable: {},
      },
    });
  }

  /** Refreshes derived components after an appearance change (bodyType changes hitbox and sprite). */
  applyAppearance(id: EntityId, appearance: Appearance): void {
    const derived = this.derived(appearance);
    delete derived.expression;
    this.world.update(id, { appearance, ...derived });
  }

  // ---------- poses (HU-GAME-014) ----------

  canTransition(from: PoseId, to: PoseId): boolean {
    return from === to || TRANSITIONS[from].includes(to);
  }

  /**
   * Changes the pose if the transition is valid (R5); invalid ones are ignored with a warning.
   * Expressions bound to the old pose end; the new pose may bring its own.
   */
  setPose(id: EntityId, to: PoseId, opts: { seatId?: EntityId; returnTo?: PoseId; force?: boolean } = {}): boolean {
    const e = this.world.get(id);
    const current = e?.components.pose;
    if (!e || !current) return false;
    if (!opts.force && !this.canTransition(current.current, to)) {
      this.logger.warn(`Invalid pose transition ${current.current} → ${to} for ${id}`);
      return false;
    }
    const next: Pose = { current: to };
    const seatId = opts.seatId ?? (to === 'sit' || to === 'sleep' || isTemporaryPose(to) ? current.seatId : undefined);
    if (seatId && to !== 'idle' && to !== 'dangle') next.seatId = seatId;
    if (opts.returnTo) next.returnTo = opts.returnTo;
    if (to !== 'eat' && to !== 'drink') this.clearTimer(this.poseTimers, id);
    this.world.transaction(() => {
      this.world.update(id, { pose: next });
      this.syncPoseExpression(id, current.current, to);
    });
    return true;
  }

  /** eat / drink for ~900 ms, then back to returnTo (R3). A second one restarts the timer, keeps returnTo. */
  playTemporaryPose(id: EntityId, pose: 'eat' | 'drink', durationMs = TEMPORARY_POSE_MS): boolean {
    const current = this.world.get(id)?.components.pose;
    if (!current) return false;
    const returnTo = isTemporaryPose(current.current) ? (current.returnTo ?? 'idle') : current.current;
    if (!this.setPose(id, pose, { returnTo, force: current.current === 'eat' || current.current === 'drink' })) return false;
    this.clearTimer(this.poseTimers, id);
    this.poseTimers.set(
      id,
      this.scheduler.setTimeout(() => {
        this.poseTimers.delete(id);
        const now = this.world.get(id)?.components.pose;
        if (now?.current === pose) this.setPose(id, now.returnTo ?? 'idle', { seatId: now.seatId });
      }, durationMs),
    );
    return true;
  }

  // ---------- expressions (HU-GAME-015) ----------

  /** Sets the expression; with a duration it goes back to neutral afterwards (R2). Restarts the timer. */
  setExpression(id: EntityId, expression: ExpressionId, durationMs?: number): boolean {
    const e = this.world.get(id);
    if (!e?.components.character) return false;
    this.clearTimer(this.expressionTimers, id);
    const value: Expression = durationMs ? { current: expression, untilMs: this.clock.now() + durationMs } : { current: expression };
    this.world.update(id, { expression: value });
    if (durationMs) {
      this.expressionTimers.set(
        id,
        this.scheduler.setTimeout(() => {
          this.expressionTimers.delete(id);
          const now = this.world.get(id);
          if (!now) return;
          const bound = POSE_EXPRESSION[now.components.pose?.current ?? 'idle'];
          this.world.update(id, { expression: { current: bound ?? 'neutral' } });
        }, durationMs),
      );
    }
    return true;
  }

  private syncPoseExpression(id: EntityId, from: PoseId, to: PoseId): void {
    const e = this.world.get(id);
    const expr = e?.components.expression?.current;
    const bound = POSE_EXPRESSION[to];
    if (bound) {
      this.clearTimer(this.expressionTimers, id);
      if (expr !== bound) this.world.update(id, { expression: { current: bound } });
    } else if (expr && expr === POSE_EXPRESSION[from]) {
      this.world.update(id, { expression: { current: 'neutral' } });
    }
  }

  // ---------- drag (HU-GAME-017) ----------

  /** dragStart: standUp implícito, cancels a temporary pose, dangle + surprised (R2). */
  onDragStart(id: EntityId): DragOrigin {
    const pose = this.world.get(id)?.components.pose;
    if (!pose) return {};
    this.clearTimer(this.poseTimers, id);
    this.setPose(id, 'dangle', { force: true });
    return { pose: persistedPose(pose) };
  }

  /** dragEnd: a drop without a posing rule leaves the character standing (R6). */
  onDragEnd(id: EntityId): void {
    if (this.world.get(id)?.components.pose?.current === 'dangle') this.setPose(id, 'idle');
  }

  /** dragCancel: back to the original pose and seat (R8). */
  onDragCancel(id: EntityId, origin: DragOrigin): void {
    if (!origin.pose) return;
    this.setPose(id, origin.pose.current, { seatId: origin.pose.seatId, force: true });
  }

  // ---------- helpers ----------

  count(): number {
    return this.world.query({ has: ['character'] }).filter((e) => !e.components.character?.isNpc).length;
  }

  private clearTimer(map: Map<EntityId, unknown>, id: EntityId): void {
    const t = map.get(id);
    if (t !== undefined) this.scheduler.clearTimeout(t);
    map.delete(id);
  }

  cancelTimers(id: EntityId): void {
    this.clearTimer(this.poseTimers, id);
    this.clearTimer(this.expressionTimers, id);
  }
}
