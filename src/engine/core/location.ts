import { z } from 'zod';

import type { EntityId, SceneId } from './types';

/** ENTITY_SCHEMA §4. v1 slots; head/face/outer/full are DESIGNED FOR LATER. */
export const WEAR_SLOTS = ['top', 'bottom', 'shoes'] as const;
export type WearSlot = (typeof WEAR_SLOTS)[number];
export type Hand = 'left' | 'right';

/** The single source of truth for where an entity is (ECS §4). */
export type Location =
  | { kind: 'scene'; sceneId: SceneId }
  | { kind: 'container'; containerId: EntityId; slot: number }
  | { kind: 'inventory'; slot: number }
  | { kind: 'held'; holderId: EntityId; hand: Hand }
  | { kind: 'worn'; characterId: EntityId; slot: WearSlot }
  | { kind: 'limbo' };

export type LocationKind = Location['kind'];

const slotIndex = z.number().int().min(0);

export const LocationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('scene'), sceneId: z.string().min(1) }),
  z.strictObject({ kind: z.literal('container'), containerId: z.string().min(1), slot: slotIndex }),
  z.strictObject({ kind: z.literal('inventory'), slot: slotIndex }),
  z.strictObject({ kind: z.literal('held'), holderId: z.string().min(1), hand: z.enum(['left', 'right']) }),
  z.strictObject({ kind: z.literal('worn'), characterId: z.string().min(1), slot: z.enum(WEAR_SLOTS) }),
  z.strictObject({ kind: z.literal('limbo') }),
]);

export function sameLocation(a: Location, b: Location): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
