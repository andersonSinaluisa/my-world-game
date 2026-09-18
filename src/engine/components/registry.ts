import type { z } from 'zod';

import {
  AnimationsSchema,
  DraggableSchema,
  HitboxSchema,
  OpenableSchema,
  SoundsSchema,
  SpriteSchema,
  StatesSchema,
  SurfaceSchema,
  SwitchableSchema,
  TransformSchema,
  type Animations,
  type Draggable,
  type Hitbox,
  type Openable,
  type Sounds,
  type Sprite,
  type States,
  type Surface,
  type Switchable,
  type Transform,
} from './base';

/**
 * Component catalog (ECS §3). Adding a component = schema here + row in ECS.md + ENTITY_SCHEMA section.
 */
export interface ComponentMap {
  transform: Transform;
  sprite: Sprite;
  hitbox: Hitbox;
  draggable: Draggable;
  surface: Surface;
  states: States;
  openable: Openable;
  switchable: Switchable;
  animations: Animations;
  sounds: Sounds;
}

export type ComponentName = keyof ComponentMap;
export type Components = Partial<ComponentMap>;

export const COMPONENT_SCHEMAS: { [K in ComponentName]: z.ZodType<ComponentMap[K]> } = {
  transform: TransformSchema,
  sprite: SpriteSchema,
  hitbox: HitboxSchema,
  draggable: DraggableSchema,
  surface: SurfaceSchema,
  states: StatesSchema,
  openable: OpenableSchema,
  switchable: SwitchableSchema,
  animations: AnimationsSchema,
  sounds: SoundsSchema,
};

export function isComponentName(name: string): name is ComponentName {
  return Object.prototype.hasOwnProperty.call(COMPONENT_SCHEMAS, name);
}

export class ComponentValidationError extends Error {
  constructor(
    readonly entityId: string,
    readonly issues: string[],
  ) {
    super(`Invalid components for entity "${entityId}": ${issues.join('; ')}`);
    this.name = 'ComponentValidationError';
  }
}

/** Validates a component bag; returns parsed components or throws ComponentValidationError. */
export function validateComponents(entityId: string, components: Record<string, unknown>): Components {
  const issues: string[] = [];
  const parsed: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(components)) {
    if (value === undefined) continue;
    if (!isComponentName(name)) {
      issues.push(`unknown component "${name}"`);
      continue;
    }
    const result = COMPONENT_SCHEMAS[name].safeParse(value);
    if (result.success) {
      parsed[name] = result.data;
    } else {
      for (const issue of result.error.issues) {
        issues.push(`${name}${issue.path.length ? '.' + issue.path.join('.') : ''}: ${issue.message}`);
      }
    }
  }
  // Cross-component dependencies (OBJECT_SCHEMA §6).
  const states = parsed.states as States | undefined;
  const openable = parsed.openable as Openable | undefined;
  const switchable = parsed.switchable as Switchable | undefined;
  if (openable) {
    if (!states) issues.push('openable requires states');
    else if (!states.values.includes(openable.openState) || !states.values.includes(openable.closedState)) {
      issues.push('openable states must be listed in states.values');
    }
  }
  if (switchable) {
    if (!states) issues.push('switchable requires states');
    else if (!states.values.includes(switchable.onState) || !states.values.includes(switchable.offState)) {
      issues.push('switchable states must be listed in states.values');
    }
  }
  if (issues.length) throw new ComponentValidationError(entityId, issues);
  return parsed as Components;
}
