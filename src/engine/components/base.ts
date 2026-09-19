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

// §5.9
const FinishSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('remove') }),
  z.strictObject({ type: z.literal('replace'), prefabId: z.string().min(1) }),
]);
export const EdibleSchema = z.strictObject({
  bites: z.number().int().min(1),
  bitesLeft: z.number().int().min(0).optional(),
  spriteByBitesLeft: z.record(z.string(), z.string().min(1)).optional(),
  onFinish: FinishSchema.optional(),
});
export const DrinkableSchema = z.strictObject({
  sips: z.number().int().min(1),
  sipsLeft: z.number().int().min(0).optional(),
  spriteBySipsLeft: z.record(z.string(), z.string().min(1)).optional(),
  onFinish: FinishSchema.optional(),
});

// §5.11
const anchor = z.strictObject({ x: finite, y: finite });
export const SeatSchema = z.strictObject({
  anchor,
  pose: z.literal('sit').optional(),
  capacity: z.literal(1).optional(),
  facing: z.enum(['left', 'right', 'front']).optional(),
});
export const BedSchema = z.strictObject({
  anchor,
  pose: z.literal('sleep').optional(),
  capacity: z.literal(1).optional(),
  /** Blanket drawn in front of the sleeping character (CHARACTER_SYSTEM §8, HU-GAME-046 R3). */
  coverAsset: z.string().min(1).optional(),
});
export type Seat = z.infer<typeof SeatSchema>;
export type Bed = z.infer<typeof BedSchema>;

// §5.13 / §5.13b
export const SpawnerSchema = z.strictObject({
  prefabId: z.string().min(1),
  maxAlive: z.number().int().min(1).optional(),
  trigger: z.literal('tap').optional(),
  spawnOffset: z.strictObject({ x: finite, y: finite }).optional(),
});
export const SpawnedFromSchema = z.strictObject({ spawnerId: z.string().min(1) });

export type Edible = z.infer<typeof EdibleSchema>;
export type Drinkable = z.infer<typeof DrinkableSchema>;
export type Spawner = z.infer<typeof SpawnerSchema>;
export type SpawnedFrom = z.infer<typeof SpawnedFromSchema>;

// §5.14 (Fase 2; isPurchased needs it for the backpack rule)
/** Door to another scene (ENTITY_SCHEMA §5.12, HU-GAME-049). */
export const PortalSchema = z.strictObject({
  targetSceneId: z.string().min(1),
  targetSpawnId: z.string().min(1),
  accepts: z.array(z.string().min(1)).optional(),
});
export type Portal = z.infer<typeof PortalSchema>;

export const PurchasableSchema = z.strictObject({
  price: z.number().int().min(0),
  purchased: z.boolean().optional(),
  restock: z.boolean().optional(),
  origin: z
    .union([z.strictObject({ x: finite, y: finite }), z.strictObject({ containerId: z.string().min(1), slot: z.number().int().min(0) })])
    .optional(),
});
export type Purchasable = z.infer<typeof PurchasableSchema>;

// ---------- characters (CHARACTER_SCHEMA §2-§3, HU-GAME-013..017) ----------

/** Fixed draw order of a character, back to front (CHARACTER_SCHEMA §3). */
export const CHARACTER_LAYERS = [
  'shadow',
  'hairBack',
  'legs',
  'bottomClothes',
  'shoes',
  'torso',
  'torsoClothes',
  'armL',
  'armClothesL',
  'heldL',
  'armR',
  'armClothesR',
  'heldR',
  'head',
  'eyes',
  'mouth',
  'hairFront',
  'accessories',
] as const;
export type CharacterLayer = (typeof CHARACTER_LAYERS)[number];

export const POSES = ['idle', 'dangle', 'sit', 'sleep', 'eat', 'drink'] as const;
export type PoseId = (typeof POSES)[number];
/** Persistent poses are saved; temporary ones are normalized to returnTo/idle (HU-GAME-014 R2). */
export const PERSISTENT_POSES: readonly PoseId[] = ['idle', 'sit', 'sleep'];

export const EXPRESSIONS = ['neutral', 'happy', 'surprised', 'sleepy', 'yum', 'curious'] as const;
export type ExpressionId = (typeof EXPRESSIONS)[number];

const layerAssets = z.partialRecord(z.enum(CHARACTER_LAYERS), z.string().min(1));

// §5.10
export const WearableSchema = z.strictObject({
  slot: z.enum(['top', 'bottom', 'shoes']),
  layers: layerAssets,
  bodyVariants: z.record(z.string().min(1), layerAssets).optional(),
});

export const CharacterSchema = z.strictObject({
  isNpc: z.boolean(),
  nickname: z.string().max(12).optional(),
  createdAt: z.string().min(1),
  colorTag: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

/** Part ids are checked against the catalog by the commands that write them (HU-GAME-022). */
export const AppearanceSchema = z.strictObject({
  bodyType: z.string().min(1),
  skinTone: z.string().min(1),
  eyes: z.string().min(1),
  mouth: z.string().min(1),
  hairStyle: z.string().min(1),
  hairColor: z.string().min(1),
});

export const HolderSchema = z.strictObject({ hands: z.array(z.enum(['left', 'right'])).min(1) });

export const PoseSchema = z.strictObject({
  current: z.enum(POSES),
  seatId: z.string().min(1).optional(),
  returnTo: z.enum(POSES).optional(),
});

/** Not persisted (CHARACTER_SCHEMA §2). */
export const ExpressionSchema = z.strictObject({
  current: z.enum(EXPRESSIONS),
  untilMs: z.number().finite().optional(),
});

export type Wearable = z.infer<typeof WearableSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type Appearance = z.infer<typeof AppearanceSchema>;
export type Holder = z.infer<typeof HolderSchema>;
export type Pose = z.infer<typeof PoseSchema>;
export type Expression = z.infer<typeof ExpressionSchema>;
