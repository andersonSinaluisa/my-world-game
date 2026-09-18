import { z } from 'zod';

/**
 * Base component schemas (ENTITY_SCHEMA §5). All objects are strict: unknown fields are errors.
 * Components registered later (container, edible, seat…) are added by the HU that first uses them.
 */

const finite = z.number().finite();

export const RENDER_LAYERS = [
  'background',
  'wallDecor',
  'furnitureBack',
  'furniture',
  'props',
  'characters',
  'foreground',
] as const;
export type RenderLayer = (typeof RENDER_LAYERS)[number];

export const TWEEN_PRESETS = ['bounce', 'wiggle', 'squash', 'pulse', 'shake', 'spin'] as const;
export type TweenPresetId = (typeof TWEEN_PRESETS)[number];

export const ANIMATION_TRIGGERS = ['idle', 'tap', 'pickup', 'drop', 'use', 'open', 'close'] as const;
export type AnimationTrigger = (typeof ANIMATION_TRIGGERS)[number];

export const SOUND_ROLES = ['pickup', 'drop', 'use', 'open', 'close', 'eat', 'drink', 'toggle', 'spawn'] as const;

// §5.1
export const TransformSchema = z.strictObject({
  x: finite,
  y: finite,
  flipX: z.boolean().optional(),
  scale: z.number().min(0.25).max(4).optional(),
  rotation: finite.optional(),
  parentId: z.string().min(1).optional(),
});

// §5.2
export const SpriteSchema = z.strictObject({
  asset: z.string().min(1),
  layer: z.enum(RENDER_LAYERS),
  z: finite.optional(),
  pivot: z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
  size: z.strictObject({ w: z.number().positive(), h: z.number().positive() }).optional(),
  byState: z.record(z.string(), z.string().min(1)).optional(),
  tint: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// §5.3
export const ShapeSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('rect'), x: finite, y: finite, w: z.number().positive(), h: z.number().positive() }),
  z.strictObject({ type: z.literal('circle'), x: finite, y: finite, r: z.number().positive() }),
  z.strictObject({ type: z.literal('polygon'), points: z.array(z.tuple([finite, finite])).min(3) }),
]);

export const HitboxSchema = z.strictObject({
  shape: ShapeSchema,
  padding: z.number().min(0).optional(),
  zones: z.record(z.string(), ShapeSchema).optional(),
});

// §5.4
export const DraggableSchema = z.strictObject({
  mode: z.enum(['free', 'floorOnly']).optional(),
  liftOffset: z.number().min(0).optional(),
  enabled: z.boolean().optional(),
});

// §5.5
export const SurfaceSchema = z.strictObject({
  segments: z.array(z.strictObject({ x1: finite, x2: finite, y: finite })).min(1),
  carriesItems: z.boolean().optional(),
});

// §5.6
export const StatesSchema = z
  .strictObject({
    current: z.string().min(1),
    values: z.array(z.string().min(1)).min(1),
  })
  .refine((s) => s.values.includes(s.current), { message: 'states.current must be one of states.values' });

// §5.7 / §5.7b
export const OpenableSchema = z.strictObject({ openState: z.string().min(1), closedState: z.string().min(1) });
export const SwitchableSchema = z.strictObject({ onState: z.string().min(1), offState: z.string().min(1) });

// §5.8 (registered in HU-GAME-024 because the core pack's toy box uses it; behaviour arrives with EPIC-009)
export const ContainerSchema = z.strictObject({
  capacity: z.number().int().min(1).max(64),
  accepts: z.array(z.string().min(1)).optional(),
  rejects: z.array(z.string().min(1)).optional(),
  requiresOpen: z.boolean().optional(),
  slots: z.array(z.strictObject({ x: finite, y: finite })).optional(),
  showContentsWhenOpen: z.boolean().optional(),
});

// §5.7c
export const AnimationsSchema = z.partialRecord(z.enum(ANIMATION_TRIGGERS), z.enum(TWEEN_PRESETS));

// §5.16
export const SoundsSchema = z.partialRecord(z.enum(SOUND_ROLES), z.string().min(1));

export type Transform = z.infer<typeof TransformSchema>;
export type Sprite = z.infer<typeof SpriteSchema>;
export type Shape = z.infer<typeof ShapeSchema>;
export type Hitbox = z.infer<typeof HitboxSchema>;
export type Draggable = z.infer<typeof DraggableSchema>;
export type Surface = z.infer<typeof SurfaceSchema>;
export type States = z.infer<typeof StatesSchema>;
export type Openable = z.infer<typeof OpenableSchema>;
export type Switchable = z.infer<typeof SwitchableSchema>;
export type Container = z.infer<typeof ContainerSchema>;
export type Animations = z.infer<typeof AnimationsSchema>;
export type Sounds = z.infer<typeof SoundsSchema>;
