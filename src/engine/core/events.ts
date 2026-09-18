import type { TweenPresetId } from '../components/base';
import type { ComponentName } from '../components/registry';
import type { Location } from './location';
import type { EntityId, SceneId } from './types';

/** Domain events (GAME_ENGINE §5). Plain serializable data, emitted after each transaction. */
export type GameEvent =
  | { type: 'entityCreated'; id: EntityId }
  | { type: 'entityChanged'; id: EntityId; components: ComponentName[] }
  /** `unload: true` = the entity left memory because its scene unloaded; it still exists in the save. */
  | { type: 'entityRemoved'; id: EntityId; unload?: boolean }
  | { type: 'entityMoved'; id: EntityId; from: Location; to: Location }
  | { type: 'visualEffect'; entityId: EntityId; preset: TweenPresetId }
  | { type: 'playerChanged'; keys: string[] }
  | { type: 'interactionPerformed'; ruleId: string; sourceId?: EntityId; targetId?: EntityId; actions: string[] }
  | { type: 'interactionRejected'; ruleId?: string; reason: string; sourceId?: EntityId; targetId?: EntityId }
  | { type: 'sceneWillChange'; from?: SceneId; to: SceneId }
  | { type: 'sceneLoaded'; from?: SceneId; to: SceneId; cameraX?: number };

/** Events that never change game state (presentation / notifications only). */
export const PRESENTATION_EVENTS: ReadonlySet<GameEvent['type']> = new Set([
  'visualEffect',
  'interactionPerformed',
  'interactionRejected',
  'sceneWillChange',
]);

export type GameEventType = GameEvent['type'];

export type EventBatchListener = (batch: readonly GameEvent[]) => void;

/**
 * Events are delivered in batches: one batch per World transaction, in emission order.
 * Consumers (render, save, audio) can therefore react once per transaction.
 */
export class EventBus {
  private listeners = new Set<EventBatchListener>();

  subscribe(listener: EventBatchListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(batch: readonly GameEvent[]): void {
    if (batch.length === 0) return;
    for (const listener of [...this.listeners]) listener(batch);
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

export function entityIdOf(event: GameEvent): EntityId | undefined {
  switch (event.type) {
    case 'entityCreated':
    case 'entityChanged':
    case 'entityRemoved':
    case 'entityMoved':
      return event.id;
    case 'visualEffect':
      return event.entityId;
    default:
      return undefined;
  }
}
