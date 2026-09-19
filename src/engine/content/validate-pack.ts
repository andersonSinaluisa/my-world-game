import type { z } from 'zod';

import { ACTION_TYPES } from '../actions';
import { catalogAssetRefs, CharacterPartsSchema, type CharacterPartsCatalog } from '../characters/catalog';
import {
  checkComponentDependencies,
  checkComponentShapes,
  isComponentName,
  type ComponentIssue,
} from '../components/registry';
import { CONDITION_TYPES } from '../rules/conditions';
import { pointer, type ContentIssue, type IssueSeverity, type RawPack } from './raw-pack';
import {
  AssetManifestSchema,
  InteractionRuleSchema,
  LocaleSchema,
  LOCALES,
  PackManifestSchema,
  PrefabSchema,
  SceneSchema,
  SUPPORTED_FORMAT_VERSIONS,
  type AssetManifest,
  type InteractionRule,
  type LocaleTable,
  type PackManifest,
  type PrefabDefinition,
  type SceneDefinition,
} from './schemas';
import { satisfies } from './semver';

/**
 * Pack validation (CONTENT_PACK_SCHEMA §6, HU-GAME-024/069). Pure: file-system checks are injected
 * through `readImage`, so the same code runs in the app (ContentRegistry) and in the CLI validator.
 * Reports every issue at once; a broken manifest skips the rest of that pack only.
 */

export const MAX_TEXTURE_SIZE = 2048;
export const WORLD_HEIGHT = 1080;
const ID_PART = /^[a-z0-9_]+$/;

export interface ImageInfo {
  format: string; // 'webp' | 'png' | …
  w: number;
  h: number;
}

export interface ValidateOptions {
  /** 'full' = schemas + cross references (dev/CI); 'schema' = manifest and schemas only (release runtime). */
  level?: 'full' | 'schema';
  /** Release policy: placeholders become errors. */
  release?: boolean;
  /** Reads an image header from a pack-relative path; undefined when the file does not exist. */
  readImage?: (packId: string, file: string) => ImageInfo | undefined;
  /** Checks that an audio file exists. */
  fileExists?: (packId: string, file: string) => boolean;
}

export interface ParsedPack {
  manifest: PackManifest;
  assets: AssetManifest;
  prefabs: { file: string; def: PrefabDefinition }[];
  scenes: { file: string; def: SceneDefinition }[];
  rules: { file: string; rules: InteractionRule[] }[];
  characters?: { file: string; catalog: CharacterPartsCatalog };
  locales: Partial<Record<(typeof LOCALES)[number], LocaleTable>>;
}

export interface ValidationResult {
  issues: ContentIssue[];
  /** Packs whose manifest parsed and whose dependencies are satisfiable, in dependency order. */
  packs: ParsedPack[];
  errorCount: number;
  warningCount: number;
}

class Reporter {
  issues: ContentIssue[] = [];
  constructor(private pack: string) {}
  add(file: string, path: (string | number)[], code: string, message: string, severity: IssueSeverity = 'error') {
    this.issues.push({ pack: this.pack, file, path: pointer(path), code, message, severity });
  }
  zod(file: string, base: (string | number)[], error: z.ZodError, code = 'invalidField') {
    for (const issue of error.issues) {
      const path = [...base, ...issue.path.map((p) => (typeof p === 'symbol' ? String(p) : p))];
      if (issue.code === 'unrecognized_keys') {
        for (const key of issue.keys) this.add(file, [...path, key], 'unknownField', `unknown field "${key}"`);
      } else {
        this.add(file, path, code, issue.message);
      }
    }
  }
  components(file: string, base: (string | number)[], issues: ComponentIssue[]) {
    for (const i of issues) this.add(file, [...base, ...i.path], i.code, i.message);
  }
}

const baseName = (file: string) => file.split('/').pop()!.replace(/\.json$/, '');

/** `id` → `pack:id`; `ns:id` stays. */
export function qualify(ref: string, packId: string): string {
  return ref.includes(':') ? ref : `${packId}:${ref}`;
}

function namespaceOf(ref: string): string | undefined {
  return ref.includes(':') ? ref.split(':')[0] : undefined;
}

export function validatePacks(raw: RawPack[], options: ValidateOptions = {}): ValidationResult {
  const level = options.level ?? 'full';
  const issues: ContentIssue[] = [];
  const parsed = new Map<string, ParsedPack>();

  // 1. manifests
  for (const pack of raw) {
    const file = pack.manifest.file;
    const fallbackId =
      typeof (pack.manifest.data as { id?: unknown })?.id === 'string' ? (pack.manifest.data as { id: string }).id : file;
    const rep = new Reporter(fallbackId);
    const m = PackManifestSchema.safeParse(pack.manifest.data);
    if (!m.success) {
      rep.zod(file, [], m.error, 'invalidManifest');
      issues.push(...rep.issues);
      continue;
    }
    if (!SUPPORTED_FORMAT_VERSIONS.includes(m.data.formatVersion as 1)) {
      rep.add(file, ['formatVersion'], 'unsupportedFormat', `formatVersion ${m.data.formatVersion} is not supported`);
      issues.push(...rep.issues);
      continue;
    }
    if (parsed.has(m.data.id)) {
      rep.add(file, ['id'], 'duplicatePackId', `pack "${m.data.id}" is declared twice`);
      issues.push(...rep.issues);
      continue;
    }
    const p = parsePackFiles(pack, m.data, rep);
    parsed.set(m.data.id, p);
    issues.push(...rep.issues);
  }

  // 2. dependencies (existence, semver, cycles)
  const disabled = new Set<string>();
  for (const p of parsed.values()) {
    const rep = new Reporter(p.manifest.id);
    for (const [dep, range] of Object.entries(p.manifest.dependencies ?? {})) {
      const target = parsed.get(dep);
      if (!target) {
        rep.add('manifest.json', ['dependencies', dep], 'missingDependency', `dependency "${dep}" is not available`);
        disabled.add(p.manifest.id);
        continue;
      }
      const ok = satisfies(target.manifest.version, range);
      if (!ok) {
        rep.add(
          'manifest.json',
          ['dependencies', dep],
          'dependencyVersion',
          `"${dep}" ${target.manifest.version} does not satisfy "${range}"`,
        );
        disabled.add(p.manifest.id);
      }
    }
    issues.push(...rep.issues);
  }
  const order = topologicalOrder([...parsed.values()], issues, disabled);

  // 3-5. cross references and uniqueness (full level only)
  if (level === 'full') {
    const assetOwner = new Map<string, string>();
    for (const p of order) {
      const rep = new Reporter(p.manifest.id);
      for (const key of Object.keys(p.assets.images)) {
        const owner = assetOwner.get(key);
        if (owner) rep.add('assets.json', ['images', key], 'duplicateAssetKey', `asset key "${key}" also defined in "${owner}"`);
        else assetOwner.set(key, p.manifest.id);
      }
      for (const key of Object.keys(p.assets.audio)) {
        const owner = assetOwner.get(key);
        if (owner) rep.add('assets.json', ['audio', key], 'duplicateAssetKey', `asset key "${key}" also defined in "${owner}"`);
        else assetOwner.set(key, p.manifest.id);
      }
      issues.push(...rep.issues);
    }
    const byId = new Map(order.map((p) => [p.manifest.id, p]));
    for (const p of order) issues.push(...crossReferences(p, byId, options));
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  return { issues, packs: order, errorCount, warningCount: issues.length - errorCount };
}

function topologicalOrder(packs: ParsedPack[], issues: ContentIssue[], disabled: Set<string>): ParsedPack[] {
  const byId = new Map(packs.map((p) => [p.manifest.id, p]));
  const state = new Map<string, 'visiting' | 'done'>();
  const result: ParsedPack[] = [];
  const reportedCycles = new Set<string>();
  const visit = (id: string, stack: string[]) => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'visiting') {
      const cycle = stack.slice(stack.indexOf(id));
      const key = [...cycle].sort().join(',');
      if (!reportedCycles.has(key)) {
        reportedCycles.add(key);
        for (const member of cycle) {
          issues.push({
            pack: member,
            file: 'manifest.json',
            path: '/dependencies',
            code: 'dependencyCycle',
            message: `dependency cycle: ${[...cycle, id].join(' → ')}`,
            severity: 'error',
          });
          disabled.add(member);
        }
      }
      return;
    }
    state.set(id, 'visiting');
    for (const dep of Object.keys(byId.get(id)?.manifest.dependencies ?? {})) if (byId.has(dep)) visit(dep, [...stack, id]);
    state.set(id, 'done');
    result.push(byId.get(id)!);
  };
  for (const p of packs) visit(p.manifest.id, []);
  // A pack depending on a disabled pack is disabled too.
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of result) {
      if (disabled.has(p.manifest.id)) continue;
      if (Object.keys(p.manifest.dependencies ?? {}).some((d) => disabled.has(d))) {
        disabled.add(p.manifest.id);
        changed = true;
      }
    }
  }
  return result.filter((p) => !disabled.has(p.manifest.id));
}

function parsePackFiles(pack: RawPack, manifest: PackManifest, rep: Reporter): ParsedPack {
  const out: ParsedPack = {
    manifest,
    assets: { images: {}, audio: {} },
    prefabs: [],
    scenes: [],
    rules: [],
    locales: {},
  };
  if (pack.assets) {
    const a = AssetManifestSchema.safeParse(pack.assets.data);
    if (a.success) out.assets = a.data;
    else rep.zod(pack.assets.file, [], a.error);
  }
  for (const loc of LOCALES) {
    const f = pack.locales[loc];
    if (!f) continue;
    const l = LocaleSchema.safeParse(f.data);
    if (l.success) out.locales[loc] = l.data;
    else rep.zod(f.file, [], l.error);
  }
  const prefabIds = new Map<string, string>();
  for (const f of pack.prefabs) {
    const r = PrefabSchema.safeParse(f.data);
    if (!r.success) {
      rep.zod(f.file, [], r.error);
      continue;
    }
    const def = r.data;
    if (!ID_PART.test(def.id)) rep.add(f.file, ['id'], 'invalidId', `invalid prefab id "${def.id}"`);
    else if (def.id !== baseName(f.file)) rep.add(f.file, ['id'], 'idFileMismatch', `id "${def.id}" does not match file name`);
    const dup = prefabIds.get(def.id);
    if (dup) rep.add(f.file, ['id'], 'duplicatePrefabId', `prefab "${def.id}" also defined in ${dup}`);
    prefabIds.set(def.id, f.file);
    const shapes = checkComponentShapes(def.components);
    rep.components(f.file, ['components'], shapes.issues);
    rep.components(f.file, ['components'], checkComponentDependencies(shapes.parsed));
    def.interactions?.extraRules?.forEach((rule, i) => validateRule(rule, f.file, ['interactions', 'extraRules', i], rep, true));
    out.prefabs.push({ file: f.file, def });
  }
  for (const f of pack.scenes) {
    const r = SceneSchema.safeParse(f.data);
    if (!r.success) {
      rep.zod(f.file, [], r.error);
      continue;
    }
    validateSceneStructure(r.data, f.file, rep);
    out.scenes.push({ file: f.file, def: r.data });
  }
  if (pack.characters) {
    const c = CharacterPartsSchema.safeParse(pack.characters.data);
    if (c.success) out.characters = { file: pack.characters.file, catalog: c.data };
    else rep.zod(pack.characters.file, [], c.error);
  }
  const ruleIds = new Set<string>();
  for (const f of pack.rules) {
    if (!Array.isArray(f.data)) {
      rep.add(f.file, [], 'invalidField', 'a rules file must contain an array');
      continue;
    }
    const rules: InteractionRule[] = [];
    f.data.forEach((item, i) => {
      const r = InteractionRuleSchema.safeParse(item);
      if (!r.success) {
        rep.zod(f.file, [i], r.error);
        return;
      }
      if (ruleIds.has(r.data.id)) rep.add(f.file, [i, 'id'], 'duplicateRuleId', `rule id "${r.data.id}" is duplicated`);
      ruleIds.add(r.data.id);
      validateRule(r.data, f.file, [i], rep, false);
      rules.push(r.data);
    });
    out.rules.push({ file: f.file, rules });
  }
  return out;
}

function validateRule(rule: InteractionRule, file: string, at: (string | number)[], rep: Reporter, local: boolean) {
  rule.actions.forEach((a, j) => {
    if (!ACTION_TYPES.includes(a.type)) rep.add(file, [...at, 'actions', j, 'type'], 'unknownAction', `unknown action "${a.type}"`);
  });
  rule.conditions?.forEach((c, j) => {
    if (!CONDITION_TYPES.includes(c.type)) rep.add(file, [...at, 'conditions', j, 'type'], 'unknownCondition', `unknown condition "${c.type}"`);
  });
  if (rule.trigger !== 'drop' && rule.source) rep.add(file, [...at, 'source'], 'tapWithSource', `a "${rule.trigger}" rule cannot have a source`);
  if (!local && (rule.source?.prefabId || rule.target.prefabId)) {
    rep.add(file, [...at, rule.source?.prefabId ? 'source' : 'target', 'prefabId'], 'prefabIdInGlobal', 'prefabId is only allowed in prefab extraRules');
  }
  for (const side of ['source', 'target'] as const) {
    rule[side]?.has?.forEach((c, j) => {
      if (!isComponentName(c)) rep.add(file, [...at, side, 'has', j], 'unknownComponent', `unknown component "${c}"`);
    });
  }
}

function validateSceneStructure(scene: SceneDefinition, file: string, rep: Reporter) {
  const width = scene.size.width;
  if (scene.size.height !== WORLD_HEIGHT) rep.add(file, ['size', 'height'], 'invalidSceneHeight', `height must be ${WORLD_HEIGHT}`);
  if (scene.id !== baseName(file)) rep.add(file, ['id'], 'idFileMismatch', `id "${scene.id}" does not match file name`);
  if (!scene.spawnPoints.some((s) => s.id === 'default')) rep.add(file, ['spawnPoints'], 'missingDefaultSpawn', 'a "default" spawn point is required');
  // Floor must cover 0..width without gaps (SCENE_SCHEMA §3.5b).
  const segs = scene.floor.map((s) => ({ x1: s.x1 ?? 0, x2: s.x2 ?? width })).sort((a, b) => a.x1 - b.x1);
  let covered = 0;
  for (const s of segs) {
    if (s.x1 > covered) {
      rep.add(file, ['floor'], 'floorGap', `floor gap between ${covered}..${s.x1}`);
      break;
    }
    covered = Math.max(covered, s.x2);
  }
  if (covered < width && !rep.issues.some((i) => i.code === 'floorGap')) rep.add(file, ['floor'], 'floorGap', `floor gap between ${covered}..${width}`);
  const inBounds = (x: number, y: number) => x >= 0 && x <= width && y >= 0 && y <= WORLD_HEIGHT;
  scene.spawnPoints.forEach((s, i) => {
    if (!inBounds(s.x, s.y)) rep.add(file, ['spawnPoints', i], 'coordinateOutOfBounds', `spawn "${s.id}" is outside the scene`);
  });
  const localIds = new Set<string>();
  scene.entities.forEach((e, i) => {
    if (localIds.has(e.localId)) rep.add(file, ['entities', i, 'localId'], 'duplicateLocalId', `localId "${e.localId}" is duplicated`);
    localIds.add(e.localId);
    if ('transform' in e) {
      const t = e.transform as { x?: unknown; y?: unknown };
      if (typeof t.x !== 'number' || t.x < 0 || t.x > width)
        rep.add(file, ['entities', i, 'transform', 'x'], 'coordinateOutOfBounds', `x must be within 0..${width}`);
      if (typeof t.y !== 'number' || t.y < 0 || t.y > WORLD_HEIGHT)
        rep.add(file, ['entities', i, 'transform', 'y'], 'coordinateOutOfBounds', `y must be within 0..${WORLD_HEIGHT}`);
    }
    if ('inline' in e) {
      const shapes = checkComponentShapes({ ...e.inline.components, transform: e.transform });
      rep.components(file, ['entities', i, 'inline', 'components'], shapes.issues);
      rep.components(file, ['entities', i, 'inline', 'components'], checkComponentDependencies(shapes.parsed));
    }
  });
  const zones = [...(scene.zones ?? [])].map((z, i) => ({ ...z, i })).sort((a, b) => a.x1 - b.x1);
  const zoneIds = new Set<string>();
  zones.forEach((z, k) => {
    if (zoneIds.has(z.id)) rep.add(file, ['zones', z.i, 'id'], 'duplicateZoneId', `zone "${z.id}" is duplicated`);
    zoneIds.add(z.id);
    if (z.x1 < 0 || z.x2 > width || z.x1 >= z.x2) rep.add(file, ['zones', z.i], 'invalidZone', 'zone must lie within the scene with x1 < x2');
    if (k > 0 && z.x1 < zones[k - 1].x2) rep.add(file, ['zones', z.i], 'zoneOverlap', `zone "${z.id}" overlaps "${zones[k - 1].id}"`);
  });
}

function crossReferences(p: ParsedPack, byId: Map<string, ParsedPack>, options: ValidateOptions): ContentIssue[] {
  const packId = p.manifest.id;
  const rep = new Reporter(packId);
  const visible = [packId, ...Object.keys(p.manifest.dependencies ?? {})];
  const visiblePacks = visible.map((id) => byId.get(id)).filter((x): x is ParsedPack => !!x);
  const hasImage = (key: string) => visiblePacks.some((vp) => key in vp.assets.images);
  const hasAudio = (key: string) => visiblePacks.some((vp) => key in vp.assets.audio);
  const prefabIndex = new Map<string, PrefabDefinition>();
  for (const vp of visiblePacks) for (const pf of vp.prefabs) prefabIndex.set(`${vp.manifest.id}:${pf.def.id}`, pf.def);
  const aliases = Object.fromEntries(visiblePacks.flatMap((vp) => Object.entries(vp.manifest.idAliases ?? {})));
  const resolvePrefab = (ref: string) => prefabIndex.get(aliases[qualify(ref, packId)] ?? qualify(ref, packId));
  const refAllowed = (ref: string) => {
    const ns = namespaceOf(ref);
    return !ns || visible.includes(ns);
  };
  const i18n = (file: string, path: (string | number)[], key: string) => {
    for (const loc of LOCALES) {
      const found = visiblePacks.some((vp) => vp.locales[loc]?.[key] !== undefined);
      if (!found) rep.add(file, path, 'missingI18n', `i18n key "${key}" is missing in ${loc}.json`);
    }
  };
  const checkAsset = (file: string, path: (string | number)[], key: string) => {
    if (!hasImage(key)) rep.add(file, path, 'unknownAsset', `asset "${key}" is not in the asset manifest`);
  };
  const checkPrefabRef = (file: string, path: (string | number)[], ref: string) => {
    if (!refAllowed(ref)) rep.add(file, path, 'undeclaredPackRef', `"${ref}" belongs to a pack not declared in dependencies`);
    else if (!resolvePrefab(ref)) rep.add(file, path, 'unknownPrefab', `prefab "${ref}" does not exist`);
  };

  const checkSceneTarget = (file: string, path: (string | number)[], sceneRef: string, spawnId: string) => {
    const target = visiblePacks.flatMap((vp) => vp.scenes.map((sc) => ({ id: `${vp.manifest.id}:${sc.def.id}`, def: sc.def }))).find((sc) => sc.id === qualify(sceneRef, packId));
    if (!target) rep.add(file, path, 'unknownScene', `scene "${sceneRef}" does not exist`);
    else if (!target.def.spawnPoints.some((sp) => sp.id === spawnId)) rep.add(file, path, 'unknownSpawn', `spawn "${spawnId}" does not exist in ${sceneRef}`);
  };

  i18n('manifest.json', ['name'], p.manifest.name);

  for (const { file, def } of p.prefabs) {
    const c = def.components as Record<string, Record<string, unknown> | undefined>;
    const sprite = c.sprite as { asset?: string; byState?: Record<string, string> } | undefined;
    if (sprite?.asset) checkAsset(file, ['components', 'sprite', 'asset'], sprite.asset);
    for (const [state, key] of Object.entries(sprite?.byState ?? {})) checkAsset(file, ['components', 'sprite', 'byState', state], key);
    const cover = (c.bed as { coverAsset?: string } | undefined)?.coverAsset;
    if (cover) checkAsset(file, ['components', 'bed', 'coverAsset'], cover);
    for (const kind of ['edible', 'drinkable'] as const) {
      const by = (c[kind] as { spriteByBitesLeft?: Record<string, string>; spriteBySipsLeft?: Record<string, string> } | undefined);
      for (const [n, key] of Object.entries(by?.spriteByBitesLeft ?? by?.spriteBySipsLeft ?? {})) checkAsset(file, ['components', kind, n], key);
    }
    for (const [role, key] of Object.entries((c.sounds as Record<string, string>) ?? {})) {
      if (!hasAudio(key)) rep.add(file, ['components', 'sounds', role], 'unknownAudio', `audio "${key}" is not in the asset manifest`);
    }
    for (const comp of ['edible', 'drinkable'] as const) {
      const onFinish = (c[comp]?.onFinish as { prefabId?: string } | undefined)?.prefabId;
      if (onFinish) checkPrefabRef(file, ['components', comp, 'onFinish'], onFinish);
    }
    const spawner = (c.spawner as { prefabId?: string } | undefined)?.prefabId;
    if (spawner) checkPrefabRef(file, ['components', 'spawner', 'prefabId'], spawner);
    i18n(file, ['metadata', 'name'], def.metadata.name);
    if (def.metadata.placeholder) {
      rep.add(file, ['metadata', 'placeholder'], options.release ? 'placeholderInRelease' : 'placeholderAsset', 'placeholder content', options.release ? 'error' : 'warning');
    }
  }

  const sceneIds = new Set(p.scenes.map((s) => s.def.id));
  for (const { file, def } of p.scenes) {
    i18n(file, ['name'], def.name);
    def.zones?.forEach((z, i) => i18n(file, ['zones', i, 'name'], z.name));
    def.background.layers.forEach((layer, li) =>
      layer.chunks.forEach((chunk, ci) => {
        checkAsset(file, ['background', 'layers', li, 'chunks', ci, 'asset'], chunk.asset);
        if (chunk.width > MAX_TEXTURE_SIZE)
          rep.add(file, ['background', 'layers', li, 'chunks', ci, 'width'], 'textureTooLarge', `chunk wider than ${MAX_TEXTURE_SIZE}`);
      }),
    );
    const containers = new Map<string, number>();
    def.entities.forEach((e) => {
      const prefab = 'prefabId' in e ? resolvePrefab(e.prefabId) : undefined;
      const merged = { ...(prefab?.components ?? {}), ...('overrides' in e ? e.overrides ?? {} : {}) } as Record<string, unknown>;
      const container = (merged.container ?? ('inline' in e ? e.inline.components.container : undefined)) as { capacity?: number } | undefined;
      if (container?.capacity) containers.set(e.localId, container.capacity);
      // Portals lead to an existing scene and spawn (SCENE_SCHEMA §6, HU-GAME-049).
      const portal = (merged.portal ?? ('inline' in e ? e.inline.components.portal : undefined)) as { targetSceneId?: string; targetSpawnId?: string } | undefined;
      if (portal?.targetSceneId) checkSceneTarget(file, ['entities', def.entities.indexOf(e), 'portal'], portal.targetSceneId, portal.targetSpawnId ?? 'default');
    });
    const usedSlots = new Set<string>();
    def.entities.forEach((e, i) => {
      if ('prefabId' in e) {
        checkPrefabRef(file, ['entities', i, 'prefabId'], e.prefabId);
        const prefab = resolvePrefab(e.prefabId);
        if (prefab && 'overrides' in e && e.overrides) {
          // Validate the merged result (HU-GAME-011 R3): e.g. `states: null` breaking openable.
          const merged = mergeComponents(prefab.components, e.overrides);
          const shapes = checkComponentShapes(merged);
          rep.components(file, ['entities', i, 'overrides'], shapes.issues);
          rep.components(file, ['entities', i, 'overrides'], checkComponentDependencies(shapes.parsed));
        }
      }
      if ('inContainer' in e) {
        const cap = containers.get(e.inContainer.localId);
        const slotKey = `${e.inContainer.localId}:${e.inContainer.slot}`;
        if (cap === undefined) rep.add(file, ['entities', i, 'inContainer', 'localId'], 'invalidContainer', `"${e.inContainer.localId}" is not a container in this scene`);
        else if (e.inContainer.slot >= cap) rep.add(file, ['entities', i, 'inContainer', 'slot'], 'invalidContainerSlot', `slot ${e.inContainer.slot} ≥ capacity ${cap}`);
        else if (usedSlots.has(slotKey)) rep.add(file, ['entities', i, 'inContainer', 'slot'], 'invalidContainerSlot', `slot ${e.inContainer.slot} already used`);
        usedSlots.add(slotKey);
      }
    });
  }
  if (p.characters) checkCharacterCatalog(p.characters, { rep, packId, checkAsset, checkPrefabRef, resolvePrefab, i18n });
  for (const { file, def } of p.prefabs) {
    const wearable = (def.components as Record<string, unknown>).wearable as WearableData | undefined;
    for (const [layer, k] of wearableAssets(wearable)) checkAsset(file, ['components', 'wearable', ...layer], k);
  }

  for (const [i, s] of (p.manifest.provides.scenes ?? []).entries()) {
    if (!sceneIds.has(s)) rep.add('manifest.json', ['provides', 'scenes', i], 'unknownScene', `scene "${s}" has no file`);
  }
  for (const [i, l] of (p.manifest.provides.locations ?? []).entries()) {
    checkSceneTarget('manifest.json', ['provides', 'locations', i], l.entrySceneId, l.entrySpawnId);
    checkAsset('manifest.json', ['provides', 'locations', i, 'icon'], l.icon);
    i18n('manifest.json', ['provides', 'locations', i, 'name'], l.name);
  }
  const ng = p.manifest.newGame;
  if (ng) {
    const scene = [...byId.values()].flatMap((vp) => vp.scenes.map((s) => ({ id: `${vp.manifest.id}:${s.def.id}`, def: s.def }))).find((s) => s.id === qualify(ng.sceneId, packId));
    if (!scene) rep.add('manifest.json', ['newGame', 'sceneId'], 'unknownScene', `scene "${ng.sceneId}" does not exist`);
    else if (!scene.def.spawnPoints.some((sp) => sp.id === ng.spawnId)) rep.add('manifest.json', ['newGame', 'spawnId'], 'unknownSpawn', `spawn "${ng.spawnId}" does not exist`);
  }

  // Files and images (step 6) and release policy (step 7).
  for (const [key, img] of Object.entries(p.assets.images)) {
    const path = ['images', key];
    if (img.placeholder) {
      rep.add('assets.json', path, options.release ? 'placeholderInRelease' : 'placeholderAsset', `placeholder asset "${key}"`, options.release ? 'error' : 'warning');
    }
    if (img.w > MAX_TEXTURE_SIZE || img.h > MAX_TEXTURE_SIZE) rep.add('assets.json', path, 'textureTooLarge', `texture larger than ${MAX_TEXTURE_SIZE}px`);
    if (!options.readImage) continue;
    const info = options.readImage(packId, img.file);
    if (!info) {
      rep.add('assets.json', [...path, 'file'], 'missingFile', `file "${img.file}" does not exist`);
      continue;
    }
    if (info.format !== 'webp') rep.add('assets.json', [...path, 'file'], 'invalidImageFormat', `"${img.file}" is ${info.format}, expected webp`);
    if (info.w !== img.w) rep.add('assets.json', [...path, 'w'], 'imageSizeMismatch', `file is ${info.w}px wide, manifest says ${img.w}`);
    if (info.h !== img.h) rep.add('assets.json', [...path, 'h'], 'imageSizeMismatch', `file is ${info.h}px high, manifest says ${img.h}`);
    if (info.w > MAX_TEXTURE_SIZE || info.h > MAX_TEXTURE_SIZE) rep.add('assets.json', path, 'textureTooLarge', `texture larger than ${MAX_TEXTURE_SIZE}px`);
  }
  for (const [key, a] of Object.entries(p.assets.audio)) {
    if (a.placeholder) {
      rep.add('assets.json', ['audio', key], options.release ? 'placeholderInRelease' : 'placeholderAsset', `placeholder audio "${key}"`, options.release ? 'error' : 'warning');
    }
    if (options.fileExists && !options.fileExists(packId, a.file)) rep.add('assets.json', ['audio', key, 'file'], 'missingFile', `file "${a.file}" does not exist`);
  }
  return rep.issues;
}

/** ENTITY_SCHEMA §3: per component and per field; arrays replace; `null` removes the component. */
export function mergeComponents(
  base: Record<string, unknown>,
  ...layers: (Record<string, unknown> | undefined)[]
): Record<string, unknown> {
  const out: Record<string, unknown> = structuredCloneJson(base);
  for (const layer of layers) {
    if (!layer) continue;
    for (const [name, value] of Object.entries(layer)) {
      if (value === null) delete out[name];
      else out[name] = deepMerge(out[name], value);
    }
  }
  return out;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepMerge(base: unknown, over: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(over)) return structuredCloneJson(over);
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isPlainObject(v) && isPlainObject(base[k]) ? deepMerge(base[k], v) : structuredCloneJson(v);
  return out;
}

function structuredCloneJson<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

// ---------- character parts catalog (CHARACTER_SCHEMA §1, CHARACTER_SYSTEM §7) ----------

interface WearableData {
  slot: string;
  layers?: Record<string, string>;
  bodyVariants?: Record<string, Record<string, string>>;
}

function wearableAssets(w: WearableData | undefined): [(string | number)[], string][] {
  if (!w) return [];
  const out: [(string | number)[], string][] = Object.entries(w.layers ?? {}).map(([l, k]) => [['layers', l], k]);
  for (const [bt, layers] of Object.entries(w.bodyVariants ?? {})) {
    for (const [l, k] of Object.entries(layers)) out.push([['bodyVariants', bt, l], k]);
  }
  return out;
}

interface CatalogCheckEnv {
  rep: Reporter;
  packId: string;
  checkAsset: (file: string, path: (string | number)[], key: string) => void;
  checkPrefabRef: (file: string, path: (string | number)[], ref: string) => void;
  resolvePrefab: (ref: string) => PrefabDefinition | undefined;
  i18n: (file: string, path: (string | number)[], key: string) => void;
}

function checkCharacterCatalog({ file, catalog: c }: { file: string; catalog: CharacterPartsCatalog }, env: CatalogCheckEnv) {
  const { rep } = env;
  for (const ref of catalogAssetRefs(c)) env.checkAsset(file, ref.path, ref.key);
  const lists = { bodyTypes: c.bodyTypes, skinTones: c.skinTones, eyes: c.eyes, mouths: c.mouths, hairStyles: c.hairStyles, hairColors: c.hairColors };
  for (const [list, items] of Object.entries(lists)) {
    const seen = new Set<string>();
    items.forEach((item: { id: string; name?: string }, i: number) => {
      if (seen.has(item.id)) rep.add(file, [list, i, 'id'], 'duplicatePartId', `"${item.id}" is duplicated in ${list}`);
      seen.add(item.id);
      if (item.name) env.i18n(file, [list, i, 'name'], item.name);
    });
  }
  const defaults: [keyof typeof lists, string][] = [
    ['bodyTypes', c.defaults.bodyType],
    ['skinTones', c.defaults.skinTone],
    ['eyes', c.defaults.eyes],
    ['mouths', c.defaults.mouth],
    ['hairStyles', c.defaults.hairStyle],
    ['hairColors', c.defaults.hairColor],
  ];
  const defaultField = { bodyTypes: 'bodyType', skinTones: 'skinTone', eyes: 'eyes', mouths: 'mouth', hairStyles: 'hairStyle', hairColors: 'hairColor' };
  for (const [list, id] of defaults) {
    if (!lists[list].some((item) => item.id === id)) rep.add(file, ['defaults', defaultField[list]], 'unknownPart', `"${id}" is not in ${list}`);
  }
  const bodyIds = c.bodyTypes.map((b) => b.id);
  c.hairStyles.forEach((h, i) => {
    for (const bt of Object.keys(h.byBodyType ?? {})) {
      if (!bodyIds.includes(bt)) rep.add(file, ['hairStyles', i, 'byBodyType', bt], 'unknownPart', `body type "${bt}" does not exist`);
    }
  });
  // Every starter wearable must draw on every body type (error); the outfit defaults must be starter-compatible.
  const checkWearable = (path: (string | number)[], ref: string, slot: string | undefined, severity: IssueSeverity) => {
    env.checkPrefabRef(file, path, ref);
    const prefab = env.resolvePrefab(ref);
    if (!prefab) return;
    const w = (prefab.components as Record<string, unknown>).wearable as WearableData | undefined;
    if (!w) {
      rep.add(file, path, 'notWearable', `"${ref}" has no wearable component`);
      return;
    }
    if (slot && w.slot !== slot) rep.add(file, path, 'invalidWearable', `"${ref}" is worn in "${w.slot}", not "${slot}"`);
    for (const bt of bodyIds) {
      const layers = w.bodyVariants?.[bt] ?? w.layers ?? {};
      if (!Object.keys(layers).length) {
        rep.add(file, path, 'missingBodyVariant', `"${ref}" has no sprites for body type "${bt}"`, severity);
      }
    }
  };
  c.starterClothes.forEach((ref, i) => checkWearable(['starterClothes', i], ref, undefined, 'error'));
  for (const [slot, ref] of Object.entries(c.defaults.outfit)) checkWearable(['defaults', 'outfit', slot], ref!, slot, 'error');
  c.bodyTypes.forEach((b, i) => env.i18n(file, ['bodyTypes', i, 'name'], b.name));
}
