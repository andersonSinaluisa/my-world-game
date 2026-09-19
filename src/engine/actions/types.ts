import type { z } from 'zod';

import type { CharacterSystem } from '../characters/character-system';
import type { Entity, EntityInit } from '../core/entity';
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
  characters: CharacterSystem;
  /** Backpack size from player.inventory.capacity (HU-GAME-037 R2). */
  inventoryCapacity: () => number;
  /**
   * New runtime instance (rt_ id) of a prefab, without location; undefined if unknown. Unqualified ids
   * resolve in the pack of `owner` (content refs are relative to their pack, CONTENT_PACK_SCHEMA §4).
   */
  instantiate: (prefabId: string, owner?: Entity) => EntityInit | undefined;
  /** Coins of the player (HU-GAME-065). `add` refuses to go below 0 and caps at 999; returns false if refused. */
  wallet: { coins(): number; add(delta: number): boolean };
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
  /** Results an action hands back to the command (unwear → startDrag, HU-GAME-040 R4). */
  output: { startDrag?: EntityId; travel?: TravelRequest };
}

/** Scene change asked by an action (teleport) or by the map; played by the engine (HU-GAME-049/050). */
export interface TravelRequest {
  sceneId: string;
  spawnId: string;
  travelers: EntityId[];
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
