import {
  checkComponentDependencies,
  checkComponentShapes,
  ComponentValidationError,
  validateComponents,
  type ComponentName,
} from '../components/registry';
import type { ComponentPatch, Entity, EntityInit } from './entity';
import { EventBus, type GameEvent } from './events';
import { LocationSchema, type Hand, type Location, type LocationKind, type WearSlot } from './location';
import type { Logger } from './runtime';
import type { EntityId, SceneId } from './types';

export class InvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvariantError';
  }
}

export interface WorldOptions {
  bus: EventBus;
  logger: Logger;
  /** Dev mode: invariant violations throw. Prod: they are rejected safely and logged (GAME_ENGINE §8). */
  dev: boolean;
}

export interface WorldQuery {
  has?: ComponentName[];
  tags?: string[];
  sceneId?: SceneId;
  locationKind?: LocationKind;
}

/** Key of the exclusive "slot" a location occupies, if any (one entity per slot/hand). */
function occupancyKey(location: Location): string | undefined {
  switch (location.kind) {
    case 'container':
      return `c:${location.containerId}:${location.slot}`;
    case 'inventory':
      return `i:${location.slot}`;
    case 'held':
      return `h:${location.holderId}:${location.hand}`;
    case 'worn':
      return `w:${location.characterId}:${location.slot}`;
    default:
      return undefined;
  }
}

/**
 * In-memory store of loaded entities (GAME_ENGINE §3).
 * - Returned entities are readonly; updates copy only touched components (structural sharing).
 * - Events are buffered and published as one batch when the outermost transaction ends.
 * - A transaction that throws is rolled back and publishes nothing.
 * - Location changes go through `setLocation`, reserved for LocationService (ECS §4).
 */
export class World {
  private entities = new Map<EntityId, Entity>();
  private occupancy = new Map<string, EntityId>();
  private depth = 0;
  private pending: GameEvent[] = [];
  private snapshot: Map<EntityId, Entity> | null = null;
  /** Derived, non-persisted: which furniture supports an item (RENDERING §4, HU-GAME-028). */
  private support = new Map<EntityId, EntityId>();
  private supportSnapshot: Map<EntityId, EntityId> | null = null;

  constructor(private readonly options: WorldOptions) {}

  // ---------- reads ----------

  get(id: EntityId): Entity | undefined {
    return this.entities.get(id);
  }

  has(id: EntityId): boolean {
    return this.entities.has(id);
  }

  get size(): number {
    return this.entities.size;
  }

  all(): Entity[] {
    return [...this.entities.values()];
  }

  query(filter: WorldQuery = {}): Entity[] {
    const result: Entity[] = [];
    for (const e of this.entities.values()) {
      if (filter.locationKind && e.location.kind !== filter.locationKind) continue;
      if (filter.sceneId && !(e.location.kind === 'scene' && e.location.sceneId === filter.sceneId)) continue;
      if (filter.has && !filter.has.every((c) => e.components[c] !== undefined)) continue;
      if (filter.tags && !filter.tags.every((t) => e.tags.includes(t))) continue;
      result.push(e);
    }
    return result;
  }

  /** Derived indexes: rebuilt from locations, never persisted (ECS §4). */
  readonly index = {
    occupantOf: (location: Location): EntityId | undefined => {
      const key = occupancyKey(location);
      return key ? this.occupancy.get(key) : undefined;
    },
    heldBy: (holderId: EntityId): EntityId[] =>
      (['left', 'right'] as Hand[])
        .map((hand) => this.occupancy.get(`h:${holderId}:${hand}`))
        .filter((id): id is EntityId => id !== undefined),
    wornBy: (characterId: EntityId): Partial<Record<WearSlot, EntityId>> => {
      const result: Partial<Record<WearSlot, EntityId>> = {};
      for (const e of this.entities.values()) {
        if (e.location.kind === 'worn' && e.location.characterId === characterId) result[e.location.slot] = e.id;
      }
      return result;
    },
    inContainer: (containerId: EntityId): (EntityId | null)[] => {
      const slots: (EntityId | null)[] = [];
      for (const e of this.entities.values()) {
        if (e.location.kind === 'container' && e.location.containerId === containerId) slots[e.location.slot] = e.id;
      }
      return Array.from(slots, (id) => id ?? null);
    },
    inventory: (): (EntityId | null)[] => {
      const slots: (EntityId | null)[] = [];
      for (const e of this.entities.values()) {
        if (e.location.kind === 'inventory') slots[e.location.slot] = e.id;
      }
      return Array.from(slots, (id) => id ?? null);
    },
    supportOf: (id: EntityId): EntityId | undefined => this.support.get(id),
    /** Occupant of a seat/bed. Derived from the `pose.seatId` of characters (pose arrives with HU-GAME-014/045). */
    seatOccupant: (seatId: EntityId): EntityId | undefined => {
      for (const e of this.entities.values()) {
        const pose = (e.components as Record<string, unknown>).pose as { seatId?: string } | undefined;
        if (pose?.seatId === seatId) return e.id;
      }
      return undefined;
    },
  };

  // ---------- writes ----------

  transaction<T>(fn: () => T): T {
    if (this.depth === 0) {
      this.snapshot = new Map(this.entities);
      this.supportSnapshot = new Map(this.support);
      this.pending = [];
    }
    this.depth++;
    try {
      const result = fn();
      this.depth--;
      if (this.depth === 0) this.commit();
      return result;
    } catch (error) {
      this.depth--;
      if (this.depth === 0) this.rollback();
      throw error;
    }
  }

  create(init: EntityInit): Entity | undefined {
    return this.transaction(() => {
      if (this.entities.has(init.id)) return this.violation(`Entity "${init.id}" already exists`);
      const location = this.parseLocation(init.id, init.location);
      const components = validateComponents(init.id, init.components);
      const key = occupancyKey(location);
      if (key && this.occupancy.has(key)) {
        return this.violation(`Location ${describe(location)} is already occupied by "${this.occupancy.get(key)}"`);
      }
      const entity = this.freeze({
        id: init.id,
        prefabId: init.prefabId,
        tags: [...(init.tags ?? [])],
        location,
        components,
      });
      this.entities.set(entity.id, entity);
      if (key) this.occupancy.set(key, entity.id);
      this.pending.push({ type: 'entityCreated', id: entity.id });
      return entity;
    });
  }

  update(id: EntityId, patch: ComponentPatch): Entity | undefined {
    return this.transaction(() => {
      const current = this.entities.get(id);
      if (!current) return this.violation(`Cannot update missing entity "${id}"`);
      const next: Record<string, unknown> = { ...current.components };
      const touched: ComponentName[] = [];
      for (const [name, value] of Object.entries(patch)) {
        touched.push(name as ComponentName);
        if (value === null) delete next[name];
        else next[name] = value;
      }
      if (touched.length === 0) return current;
      // Shape-check only touched components (untouched ones keep their reference),
      // then cross-component dependencies on the full bag (e.g. openable ↔ states).
      const { parsed, issues } = checkComponentShapes(
        Object.fromEntries(touched.filter((n) => next[n] !== undefined).map((n) => [n, next[n]])),
      );
      Object.assign(next, parsed);
      issues.push(...checkComponentDependencies(next));
      if (issues.length) throw new ComponentValidationError(id, issues);
      const entity = this.freeze({ ...current, components: next });
      this.entities.set(id, entity);
      this.pending.push({ type: 'entityChanged', id, components: touched });
      return entity;
    });
  }

  /** `unload`: removal caused by a scene unload, not gameplay (the save keeps the entity). */
  remove(id: EntityId, options: { unload?: boolean } = {}): boolean {
    return this.transaction(() => {
      const current = this.entities.get(id);
      if (!current) {
        this.violation(`Cannot remove missing entity "${id}"`);
        return false;
      }
      const key = occupancyKey(current.location);
      if (key) this.occupancy.delete(key);
      this.entities.delete(id);
      this.support.delete(id);
      for (const [item, supporter] of this.support) if (supporter === id) this.support.delete(item);
      this.pending.push(options.unload ? { type: 'entityRemoved', id, unload: true } : { type: 'entityRemoved', id });
      return true;
    });
  }

  /** Sets or clears the derived support relation (SurfaceSystem only). Not an event: it is recomputed on load. */
  setSupport(id: EntityId, supporterId: EntityId | undefined): void {
    if (supporterId === undefined) this.support.delete(id);
    else this.support.set(id, supporterId);
  }

  /** Emits a non-entity-state event inside the current transaction (e.g. visualEffect). */
  emit(event: GameEvent): void {
    this.transaction(() => {
      this.pending.push(event);
    });
  }

  /**
   * Internal: change an entity's location. Only LocationService may call this (ECS §4).
   * Returns false when the target slot is occupied (after reporting the violation).
   */
  setLocation(id: EntityId, to: Location): boolean {
    return this.transaction(() => {
      const current = this.entities.get(id);
      if (!current) {
        this.violation(`Cannot move missing entity "${id}"`);
        return false;
      }
      const location = this.parseLocation(id, to);
      const newKey = occupancyKey(location);
      const occupant = newKey ? this.occupancy.get(newKey) : undefined;
      if (occupant !== undefined && occupant !== id) {
        this.violation(`Location ${describe(location)} is already occupied by "${occupant}"`);
        return false;
      }
      const oldKey = occupancyKey(current.location);
      if (oldKey) this.occupancy.delete(oldKey);
      if (newKey) this.occupancy.set(newKey, id);
      this.entities.set(id, this.freeze({ ...current, location }));
      this.pending.push({ type: 'entityMoved', id, from: current.location, to: location });
      return true;
    });
  }

  // ---------- internals ----------

  private parseLocation(id: EntityId, location: Location): Location {
    const result = LocationSchema.safeParse(location);
    if (!result.success) throw new InvariantError(`Invalid location for "${id}": ${result.error.issues[0]?.message}`);
    return result.data as Location;
  }

  private violation(message: string): undefined {
    if (this.options.dev) throw new InvariantError(message);
    this.options.logger.warn(`[invariant] ${message}`);
    return undefined;
  }

  private freeze(entity: Entity): Entity {
    if (!this.options.dev) return entity;
    for (const component of Object.values(entity.components)) {
      if (component && typeof component === 'object') Object.freeze(component);
    }
    Object.freeze(entity.tags);
    Object.freeze(entity.components);
    return Object.freeze(entity);
  }

  private commit(): void {
    const batch = this.pending;
    this.pending = [];
    this.snapshot = null;
    this.supportSnapshot = null;
    this.options.bus.publish(batch);
  }

  private rollback(): void {
    if (this.snapshot) this.entities = this.snapshot;
    if (this.supportSnapshot) this.support = this.supportSnapshot;
    this.snapshot = null;
    this.supportSnapshot = null;
    this.pending = [];
    this.occupancy.clear();
    for (const e of this.entities.values()) {
      const key = occupancyKey(e.location);
      if (key) this.occupancy.set(key, e.id);
    }
  }
}

function describe(location: Location): string {
  return JSON.stringify(location);
}
