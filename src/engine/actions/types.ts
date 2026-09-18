import type { z } from 'zod';

import type { Entity } from '../core/entity';
import type { LocationService } from '../core/location-service';
import type { Logger } from '../core/runtime';
import type { EntityId, WorldPoint } from '../core/types';
import type { World } from '../core/world';
import type { ActiveSceneInfo } from '../scene/scene-types';
import type { VisualEffects } from '../systems/visual-effects';

/** What actions and conditions may touch: the World and services, never I/O (INTERACTION_SCHEMA §5). */
export interface ActionEnv {
  world: World;
  locations: LocationService;
  effects: VisualEffects;
  logger: Logger;
  scene: ActiveSceneInfo;
}

/** Context of one interaction: who is `$source`, who is `$target`, where the finger was. */
export interface InteractionContext {
  env: ActionEnv;
  trigger: 'drop' | 'tap' | 'longPress';
  sourceId?: EntityId;
  targetId?: EntityId;
  zone?: string;
  point: WorldPoint;
  ruleId?: string;
}

export type RoleRef = '$source' | '$target';

export type Check = { ok: true } | { ok: false; reason: string };
export const PASS: Check = { ok: true };
export const fail = (reason: string): Check => ({ ok: false, reason });

/** Closed set of actions: each one validates without side effects, then executes (INTERACTION_SCHEMA §6). */
export interface ActionHandler<P = Record<string, unknown>> {
  type: string;
  params: z.ZodType<P>;
  validate(ctx: InteractionContext, params: P): Check;
  execute(ctx: InteractionContext, params: P): void;
}

export interface ConditionHandler<P = Record<string, unknown>> {
  type: string;
  params: z.ZodType<P>;
  evaluate(ctx: InteractionContext, params: P): Check;
}

export function resolveRole(ctx: InteractionContext, role: RoleRef): Entity | undefined {
  const id = role === '$source' ? ctx.sourceId : ctx.targetId;
  return id ? ctx.env.world.get(id) : undefined;
}
