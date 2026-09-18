import type { z } from 'zod';

import {
  AnimationsSchema,
  AppearanceSchema,
  CharacterSchema,
  ExpressionSchema,
  HolderSchema,
  PoseSchema,
  PurchasableSchema,
  WearableSchema,
  ContainerSchema,
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
  type Appearance,
  type Character,
  type Expression,
  type Holder,
  type Pose,
  type Purchasable,
  type Wearable,
  type Container,
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
  container: Container;
  animations: Animations;
  sounds: Sounds;
  wearable: Wearable;
  character: Character;
  appearance: Appearance;
  holder: Holder;
  pose: Pose;
  expression: Expression;
  purchasable: Purchasable;
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
  container: ContainerSchema,
  animations: AnimationsSchema,
  sounds: SoundsSchema,
  wearable: WearableSchema,
  character: CharacterSchema,
  appearance: AppearanceSchema,
  holder: HolderSchema,
  pose: PoseSchema,
  expression: ExpressionSchema,
  purchasable: PurchasableSchema,
};

export function isComponentName(name: string): name is ComponentName {
  return Object.prototype.hasOwnProperty.call(COMPONENT_SCHEMAS, name);
}

export type ComponentIssueCode =
  | 'unknownComponent'
  | 'unknownField'
  | 'invalidValue'
  | 'missingDependency'
  | 'invalidStateRef'
  | 'slotsCapacityMismatch';

/** Structured issue; `path` is relative to the component bag (JSON pointer segments). */
export interface ComponentIssue {
  code: ComponentIssueCode;
  path: (string | number)[];
  message: string;
}

export class ComponentValidationError extends Error {
  constructor(
    readonly entityId: string,
    readonly issues: ComponentIssue[],
  ) {
    super(
      `Invalid components for entity "${entityId}": ${issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
    this.name = 'ComponentValidationError';
  }
}

/** Per-component schema checks (strict). Returns parsed components and issues. */
export function checkComponentShapes(components: Record<string, unknown>): {
  parsed: Components;
  issues: ComponentIssue[];
} {
  const issues: ComponentIssue[] = [];
  const parsed: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(components)) {
    if (value === undefined || value === null) continue;
    if (!isComponentName(name)) {
      issues.push({ code: 'unknownComponent', path: [name], message: `unknown component "${name}"` });
      continue;
    }
    const result = COMPONENT_SCHEMAS[name].safeParse(value);
    if (result.success) {
      parsed[name] = result.data;
      continue;
    }
    for (const issue of result.error.issues) {
      const path = [name, ...issue.path.map((p) => (typeof p === 'symbol' ? String(p) : p))];
      if (issue.code === 'unrecognized_keys') {
        for (const key of issue.keys) {
          issues.push({ code: 'unknownField', path: [...path, key], message: `unknown field "${key}"` });
        }
      } else {
        issues.push({ code: 'invalidValue', path, message: issue.message });
      }
    }
  }
  return { parsed: parsed as Components, issues };
}

/** Cross-component dependencies (OBJECT_SCHEMA §6). Operates on already-shaped components. */
export function checkComponentDependencies(c: Components): ComponentIssue[] {
  const issues: ComponentIssue[] = [];
  const states = c.states;
  const stateRef = (path: (string | number)[], state: string) => {
    if (states && !states.values.includes(state)) {
      issues.push({ code: 'invalidStateRef', path, message: `state "${state}" is not in states.values` });
    }
  };
  if (c.openable) {
    if (!states) issues.push({ code: 'missingDependency', path: ['openable'], message: 'openable requires states' });
    stateRef(['openable', 'openState'], c.openable.openState);
    stateRef(['openable', 'closedState'], c.openable.closedState);
  }
  if (c.switchable) {
    if (!states) issues.push({ code: 'missingDependency', path: ['switchable'], message: 'switchable requires states' });
    stateRef(['switchable', 'onState'], c.switchable.onState);
    stateRef(['switchable', 'offState'], c.switchable.offState);
  }
  if (c.container?.slots && c.container.slots.length !== c.container.capacity) {
    issues.push({
      code: 'slotsCapacityMismatch',
      path: ['container', 'slots'],
      message: `container has ${c.container.slots.length} slots but capacity ${c.container.capacity}`,
    });
  }
  if (c.sprite?.byState) {
    for (const state of Object.keys(c.sprite.byState)) {
      if (!states?.values.includes(state)) {
        issues.push({
          code: 'invalidStateRef',
          path: ['sprite', 'byState'],
          message: `sprite.byState references unknown state "${state}"`,
        });
      }
    }
  }
  return issues;
}

/** Shapes + dependencies; throws ComponentValidationError. Used by the World. */
export function validateComponents(entityId: string, components: Record<string, unknown>): Components {
  const { parsed, issues } = checkComponentShapes(components);
  issues.push(...checkComponentDependencies(parsed));
  if (issues.length) throw new ComponentValidationError(entityId, issues);
  return parsed;
}
