import type { Location } from './location';
import type { Logger } from './runtime';
import type { EntityId } from './types';
import { InvariantError, type World } from './world';

export type MoveResult = { ok: true } | { ok: false; reason: 'entityNotFound' | 'targetNotFound' | 'occupied' | 'selfReference' };

/**
 * The only way to change an entity's location (ECS §4, ARCHITECTURE §6.3).
 * Validates the transition, then delegates to World.setLocation, which keeps indexes and emits `entityMoved`.
 */
export class LocationService {
  constructor(
    private readonly world: World,
    private readonly logger: Logger,
    private readonly dev: boolean,
  ) {}

  move(id: EntityId, to: Location): MoveResult {
    if (!this.world.has(id)) return this.fail('entityNotFound', `Entity "${id}" not found`);
    const targetId = referencedEntity(to);
    if (targetId !== undefined) {
      if (targetId === id) return this.fail('selfReference', `Entity "${id}" cannot be located inside itself`);
      if (!this.world.has(targetId)) return this.fail('targetNotFound', `Target entity "${targetId}" not found`);
    }
    const occupant = this.world.index.occupantOf(to);
    if (occupant !== undefined && occupant !== id) {
      return this.fail('occupied', `Location ${JSON.stringify(to)} is already occupied by "${occupant}"`);
    }
    const moved = this.world.setLocation(id, to);
    return moved ? { ok: true } : { ok: false, reason: 'occupied' };
  }

  private fail(reason: Exclude<MoveResult, { ok: true }>['reason'], message: string): MoveResult {
    if (this.dev) throw new InvariantError(message);
    this.logger.warn(`[invariant] ${message}`);
    return { ok: false, reason };
  }
}

function referencedEntity(location: Location): EntityId | undefined {
  switch (location.kind) {
    case 'container':
      return location.containerId;
    case 'held':
      return location.holderId;
    case 'worn':
      return location.characterId;
    default:
      return undefined;
  }
}
