import { z } from 'zod';

/**
 * Content schemas (CONTENT_PACK_SCHEMA, OBJECT_SCHEMA, SCENE_SCHEMA, INTERACTION_SCHEMA).
 * Components inside prefabs/scenes are validated separately with the component registry, so here
 * they are kept as open records and checked in `validate-pack.ts` with precise paths.
 */

const idPart = /^[a-z0-9_]+$/;
const semver = /^\d+\.\d+\.\d+$/;
const finite = z.number().finite();

export const SUPPORTED_FORMAT_VERSIONS = [1] as const;

// ---------- manifest (CONTENT_PACK_SCHEMA §2) ----------

export const PackManifestSchema = z.strictObject({
  id: z.string().regex(idPart),
  name: z.string().min(1),
  version: z.string().regex(semver),
  formatVersion: z.number().int().positive(),
  minEngineVersion: z.string().regex(semver).optional(),
  dependencies: z.record(z.string().regex(idPart), z.string().min(1)).optional(),
  provides: z.strictObject({
    scenes: z.array(z.string().regex(idPart)).optional(),
    locations: z
      .array(
        z.strictObject({
          id: z.string().regex(idPart),
          name: z.string().min(1),
          icon: z.string().min(1),
          entrySceneId: z.string().min(1),
          entrySpawnId: z.string().min(1),
        }),
      )
      .optional(),
    characterParts: z.boolean().optional(),
  }),
  idAliases: z.record(z.string(), z.string()).optional(),
  removedIds: z.array(z.string()).optional(),
  entitlement: z
    .union([z.strictObject({ type: z.literal('free') }), z.strictObject({ type: z.literal('iap'), productId: z.string() })])
    .optional(),
  newGame: z
    .strictObject({
      sceneId: z.string().min(1),
      spawnId: z.string().min(1),
      coins: z.number().int().min(0),
      dailyGiftCoins: z.number().int().min(0),
      unlocks: z.array(z.string()),
      inventoryCapacity: z.number().int().min(0),
    })
    .optional(),
  distribution: z.enum(['bundled', 'downloadable']),
  checksum: z.string().optional(),
});
export type PackManifest = z.infer<typeof PackManifestSchema>;

// ---------- assets.json (CONTENT_PACK_SCHEMA §3) ----------

export const AssetImageSchema = z.strictObject({
  file: z.string().min(1),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  placeholder: z.boolean().optional(),
  license: z.string().optional(),
  source: z.string().optional(),
});
export const AssetAudioSchema = z.strictObject({
  file: z.string().min(1),
  kind: z.enum(['sfx', 'music', 'ambience']),
  loop: z.boolean().optional(),
  volume: z.number().min(0).max(1).optional(),
  placeholder: z.boolean().optional(),
  license: z.string().optional(),
  source: z.string().optional(),
});
export const AssetManifestSchema = z.strictObject({
  images: z.record(z.string(), AssetImageSchema),
  audio: z.record(z.string(), AssetAudioSchema),
});
export type AssetManifest = z.infer<typeof AssetManifestSchema>;
export type AssetImage = z.infer<typeof AssetImageSchema>;
export type AssetAudio = z.infer<typeof AssetAudioSchema>;

// ---------- interaction rules (INTERACTION_SCHEMA §2) ----------

export const MatcherSchema = z.strictObject({
  has: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  anyTags: z.array(z.string()).optional(),
  notTags: z.array(z.string()).optional(),
  state: z.string().optional(),
  prefabId: z.string().optional(),
});
export const TargetMatcherSchema = MatcherSchema.extend({
  zone: z.union([z.string(), z.array(z.string())]).optional(),
  ui: z.enum(['inventory', 'trash']).optional(),
});
export const ActionSpecSchema = z.looseObject({ type: z.string().min(1) });
export const ConditionSpecSchema = z.looseObject({ type: z.string().min(1) });

export const InteractionRuleSchema = z.strictObject({
  id: z.string().regex(idPart),
  trigger: z.enum(['drop', 'tap', 'longPress']),
  source: MatcherSchema.optional(),
  target: TargetMatcherSchema,
  conditions: z.array(ConditionSpecSchema).optional(),
  actions: z.array(ActionSpecSchema).min(1),
  priority: z.number().finite().optional(),
  fallback: z.enum(['place', 'returnToOrigin']).optional(),
  feedback: z.strictObject({ highlight: z.boolean().optional(), rejectHint: z.string().optional() }).optional(),
});
export type InteractionRule = z.infer<typeof InteractionRuleSchema>;
export type Matcher = z.infer<typeof MatcherSchema>;
export type TargetMatcher = z.infer<typeof TargetMatcherSchema>;
export type ActionSpec = z.infer<typeof ActionSpecSchema>;
export type ConditionSpec = z.infer<typeof ConditionSpecSchema>;

// ---------- prefab (OBJECT_SCHEMA §2) ----------

export const PREFAB_CATEGORIES = [
  'food',
  'drink',
  'clothing',
  'furniture',
  'appliance',
  'toy',
  'decor',
  'tool',
  'plant',
  'container',
  'door',
  'misc',
] as const;

export const PrefabSchema = z.strictObject({
  id: z.string(),
  category: z.enum(PREFAB_CATEGORIES),
  tags: z.array(z.string()).optional(),
  components: z.record(z.string(), z.unknown()),
  interactions: z
    .strictObject({
      disabledRules: z.array(z.string()).optional(),
      extraRules: z.array(InteractionRuleSchema).optional(),
    })
    .optional(),
  metadata: z.strictObject({
    name: z.string().min(1),
    description: z.string().optional(),
    price: z.number().min(0).optional(),
    rarity: z.enum(['common', 'rare']).optional(),
    author: z.string().optional(),
    placeholder: z.boolean().optional(),
    license: z.string().optional(),
  }),
});
export type PrefabDefinition = z.infer<typeof PrefabSchema>;

// ---------- scene (SCENE_SCHEMA §2) ----------

const TransformDataSchema = z.record(z.string(), z.unknown());

export const SceneEntitySchema = z.union([
  z.strictObject({
    localId: z.string().regex(idPart),
    prefabId: z.string().min(1),
    transform: TransformDataSchema,
    overrides: z.record(z.string(), z.unknown()).optional(),
    tags: z.array(z.string()).optional(),
  }),
  z.strictObject({
    localId: z.string().regex(idPart),
    inline: z.strictObject({ components: z.record(z.string(), z.unknown()), tags: z.array(z.string()).optional() }),
    transform: TransformDataSchema,
  }),
  z.strictObject({
    localId: z.string().regex(idPart),
    prefabId: z.string().min(1),
    inContainer: z.strictObject({ localId: z.string().regex(idPart), slot: z.number().int().min(0) }),
    overrides: z.record(z.string(), z.unknown()).optional(),
    tags: z.array(z.string()).optional(),
  }),
]);
export type SceneEntityDefinition = z.infer<typeof SceneEntitySchema>;

const AudioRef = z.strictObject({ music: z.string().optional(), ambience: z.string().optional() });

export const SceneSchema = z.strictObject({
  id: z.string().regex(idPart),
  name: z.string().min(1),
  location: z.string().regex(idPart),
  size: z.strictObject({ width: z.number().positive(), height: z.number() }),
  background: z.strictObject({
    layers: z.array(
      z.strictObject({
        id: z.string().min(1),
        chunks: z.array(z.strictObject({ asset: z.string().min(1), x: finite, width: z.number().positive() })),
        parallax: z.number().min(0).optional(),
        y: finite.optional(),
      }),
    ),
  }),
  floor: z.array(z.strictObject({ y: finite, x1: finite.optional(), x2: finite.optional() })).min(1),
  bounds: z.strictObject({ minX: finite, maxX: finite }).optional(),
  zones: z
    .array(
      z.strictObject({
        id: z.string().regex(idPart),
        name: z.string().min(1),
        x1: finite,
        x2: finite,
        audio: AudioRef.optional(),
        snapCameraX: finite.optional(),
        /** Map button icon (HU-GAME-051 RN-5). */
        icon: z.string().min(1).optional(),
      }),
    )
    .optional(),
  spawnPoints: z.array(
    z.strictObject({ id: z.string().regex(idPart), x: finite, y: finite, facing: z.enum(['left', 'right']).optional() }),
  ),
  entities: z.array(SceneEntitySchema),
  audio: AudioRef.optional(),
  camera: z.strictObject({ startX: finite.optional(), startSpawnId: z.string().optional() }).optional(),
  /** Palette color of the fade into this scene (HU-GAME-050 RN-2). */
  transitionColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  metadata: z.strictObject({ author: z.string().optional(), placeholder: z.boolean().optional() }).optional(),
});
export type SceneDefinition = z.infer<typeof SceneSchema>;

// ---------- locales ----------

export const LocaleSchema = z.record(z.string(), z.string());
export type LocaleTable = z.infer<typeof LocaleSchema>;
export const LOCALES = ['es', 'en'] as const;
export type LocaleId = (typeof LOCALES)[number];
