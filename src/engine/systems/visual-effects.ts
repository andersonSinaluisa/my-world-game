import type { AnimationTrigger, TweenPresetId } from '../components/base';
import type { Entity } from '../core/entity';
import type { EntityId } from '../core/types';
import type { World } from '../core/world';

/**
 * Presentation-only effects (HU-GAME-009, ANIMATION_GUIDELINES).
 * The engine decides *which* preset; the render adapter animates it on the UI thread.
 * Never changes logical state and never marks entities dirty.
 */
export function presetFor(entity: Entity, trigger: AnimationTrigger): TweenPresetId | undefined {
  return entity.components.animations?.[trigger];
}

export class VisualEffects {
  constructor(private readonly world: World) {}

  /** Emits `visualEffect` if the entity declares a preset for the trigger. Returns the preset used. */
  trigger(entityId: EntityId, trigger: AnimationTrigger): TweenPresetId | undefined {
    const entity = this.world.get(entityId);
    if (!entity) return undefined;
    const preset = presetFor(entity, trigger);
    if (preset) this.world.emit({ type: 'visualEffect', entityId, preset });
    return preset;
  }

  /** Rejections always shake the target, with or without `animations` (AC-REJECT-01). */
  rejected(targetId: EntityId): void {
    if (!this.world.has(targetId)) return;
    this.world.emit({ type: 'visualEffect', entityId: targetId, preset: 'shake' });
  }
}
