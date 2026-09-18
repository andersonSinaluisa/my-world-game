import type { CharacterPartsCatalog } from '../characters/catalog';
import type { Logger } from '../core/runtime';
import type { PrefabId, SceneId } from '../core/types';
import type { ContentIssue, RawPack } from './raw-pack';
import type { AssetAudio, AssetImage, InteractionRule, LocaleId, PackManifest, PrefabDefinition, SceneDefinition } from './schemas';
import { qualify, validatePacks, type ParsedPack } from './validate-pack';

export class ContentLoadError extends Error {
  constructor(readonly issues: ContentIssue[]) {
    super(
      `Content failed to load:\n${issues
        .filter((i) => i.severity === 'error')
        .map((i) => `  [${i.pack}] ${i.file}${i.path} ${i.code}: ${i.message}`)
        .join('\n')}`,
    );
    this.name = 'ContentLoadError';
  }
}

export interface RegisteredRule extends InteractionRule {
  /** Namespaced id: `pack:id`. */
  qualifiedId: string;
  pack: string;
  /** Prefab owning a local rule (extraRules): its source/target implicitly match this prefab. */
  ownerPrefab?: PrefabId;
}

export interface LoadOptions {
  dev: boolean;
  logger: Logger;
  /** Core pack id; it cannot be disabled (CONTENT_PACK_SCHEMA §5). */
  corePack?: string;
}

/**
 * Registered, validated content (CONTENT_SYSTEM §2). The engine receives it by injection and never
 * imports files from `content/` (HU-GAME-068 R11). Dev validates everything; release only manifests and
 * schemas because the CI already checked cross references.
 */
export class ContentRegistry {
  private manifests: PackManifest[] = [];
  private prefabMap = new Map<string, PrefabDefinition & { qualifiedId: PrefabId; pack: string }>();
  private sceneMap = new Map<string, SceneDefinition & { qualifiedId: SceneId; pack: string }>();
  private ruleList: RegisteredRule[] = [];
  private images = new Map<string, AssetImage & { pack: string }>();
  private sounds = new Map<string, AssetAudio & { pack: string }>();
  private locales: Record<LocaleId, Map<string, string>> = { es: new Map(), en: new Map() };
  private aliases = new Map<string, string>();
  private removed = new Set<string>();
  private catalog: CharacterPartsCatalog | undefined;
  readonly issues: ContentIssue[];
  readonly loadMs: number;

  private constructor(
    parsed: ParsedPack[],
    issues: ContentIssue[],
    loadMs: number,
    private readonly logger: Logger,
    private readonly dev: boolean,
  ) {
    this.issues = issues;
    this.loadMs = loadMs;
    for (const p of parsed) this.register(p);
  }

  static load(raw: RawPack[], options: LoadOptions, now: () => number = () => Date.now()): ContentRegistry {
    const start = now();
    const core = options.corePack ?? 'core';
    const result = validatePacks(raw, { level: options.dev ? 'full' : 'schema' });
    const errorPacks = new Set(result.issues.filter((i) => i.severity === 'error').map((i) => i.pack));
    for (const issue of result.issues) {
      options.logger[issue.severity === 'error' ? 'error' : 'warn'](
        `[content] ${issue.pack} ${issue.file}${issue.path} ${issue.code}: ${issue.message}`,
      );
    }
    if (errorPacks.has(core) && options.dev) throw new ContentLoadError(result.issues.filter((i) => i.pack === core));
    // Non-core packs with errors are disabled; the rest keeps working.
    const usable = result.packs.filter((p) => p.manifest.id === core || !errorPacks.has(p.manifest.id));
    return new ContentRegistry(usable, result.issues, now() - start, options.logger, options.dev);
  }

  private register(p: ParsedPack): void {
    const id = p.manifest.id;
    this.manifests.push(p.manifest);
    for (const [from, to] of Object.entries(p.manifest.idAliases ?? {})) this.aliases.set(from, to);
    for (const r of p.manifest.removedIds ?? []) this.removed.add(r);
    for (const { def } of p.prefabs) {
      const qualifiedId = `${id}:${def.id}`;
      this.prefabMap.set(qualifiedId, { ...def, qualifiedId, pack: id });
      for (const rule of def.interactions?.extraRules ?? []) {
        this.ruleList.push({ ...rule, qualifiedId: `${qualifiedId}#${rule.id}`, pack: id, ownerPrefab: qualifiedId });
      }
    }
    for (const { def } of p.scenes) this.sceneMap.set(`${id}:${def.id}`, { ...def, qualifiedId: `${id}:${def.id}`, pack: id });
    for (const { rules } of p.rules) for (const r of rules) this.ruleList.push({ ...r, qualifiedId: `${id}:${r.id}`, pack: id });
    for (const [key, img] of Object.entries(p.assets.images)) this.images.set(key, { ...img, pack: id });
    for (const [key, a] of Object.entries(p.assets.audio)) this.sounds.set(key, { ...a, pack: id });
    for (const loc of ['es', 'en'] as const) {
      for (const [k, v] of Object.entries(p.locales[loc] ?? {})) this.locales[loc].set(k, v);
    }
    if (p.characters) this.registerCatalog(p.characters.catalog, id);
  }

  /** The first pack provides the catalog; later packs append options (their defaults are ignored). */
  private registerCatalog(c: CharacterPartsCatalog, packId: string): void {
    const q = (ref: string) => qualify(ref, packId);
    const outfit = Object.fromEntries(Object.entries(c.defaults.outfit).map(([slot, ref]) => [slot, q(ref!)]));
    const incoming: CharacterPartsCatalog = { ...c, starterClothes: c.starterClothes.map(q), defaults: { ...c.defaults, outfit } };
    if (!this.catalog) {
      this.catalog = incoming;
      return;
    }
    const base = this.catalog;
    this.catalog = {
      ...base,
      bodyTypes: [...base.bodyTypes, ...incoming.bodyTypes],
      skinTones: [...base.skinTones, ...incoming.skinTones],
      eyes: [...base.eyes, ...incoming.eyes],
      mouths: [...base.mouths, ...incoming.mouths],
      hairStyles: [...base.hairStyles, ...incoming.hairStyles],
      hairColors: [...base.hairColors, ...incoming.hairColors],
      starterClothes: [...base.starterClothes, ...incoming.starterClothes],
      colorTags: [...(base.colorTags ?? []), ...(incoming.colorTags ?? [])],
    };
  }

  /** Character parts catalog (CHARACTER_SCHEMA §1); undefined when no pack provides one. */
  characterCatalog(): CharacterPartsCatalog | undefined {
    return this.catalog;
  }

  packs(): PackManifest[] {
    return [...this.manifests];
  }

  manifest(packId: string): PackManifest | undefined {
    return this.manifests.find((m) => m.id === packId);
  }

  resolveAlias(id: string): string {
    let current = id;
    for (let i = 0; i < 10 && this.aliases.has(current); i++) current = this.aliases.get(current)!;
    return current;
  }

  isRemoved(id: string): boolean {
    return this.removed.has(id);
  }

  hasPrefab(id: string, contextPack?: string): boolean {
    return this.prefabMap.has(this.resolveAlias(contextPack ? qualify(id, contextPack) : id));
  }

  /** Throws in dev when missing (HU-GAME-024 R10); returns undefined in production. */
  prefab(id: string, contextPack?: string): (PrefabDefinition & { qualifiedId: PrefabId; pack: string }) | undefined {
    const key = this.resolveAlias(contextPack ? qualify(id, contextPack) : id);
    const found = this.prefabMap.get(key);
    if (!found && this.dev) throw new Error(`Unknown prefab "${id}"`);
    return found;
  }

  scene(id: string): (SceneDefinition & { qualifiedId: SceneId; pack: string }) | undefined {
    return this.sceneMap.get(id);
  }

  rules(): RegisteredRule[] {
    return this.ruleList;
  }

  asset(key: string): (AssetImage & { pack: string }) | undefined {
    return this.images.get(key);
  }

  /** Audio asset (AUDIO_SYSTEM §2): kind, loop, base volume. */
  audio(key: string): (AssetAudio & { pack: string }) | undefined {
    return this.sounds.get(key);
  }

  audioKeys(): string[] {
    return [...this.sounds.keys()];
  }

  assetSize(key: string): { w: number; h: number } | undefined {
    const a = this.images.get(key);
    return a ? { w: a.w, h: a.h } : undefined;
  }

  /** Missing key: falls back to the other locale, then to the key itself (HU-GAME-068 R10). */
  t(key: string, locale: LocaleId): string {
    const direct = this.locales[locale].get(key);
    if (direct !== undefined) return direct;
    const other = this.locales[locale === 'es' ? 'en' : 'es'].get(key);
    this.logger.warn(`[i18n] missing "${key}" in ${locale}`);
    return other ?? key;
  }

  newGame(): PackManifest['newGame'] {
    return this.manifests.find((m) => m.newGame)?.newGame;
  }
}
