import { AppearanceSchema, type Appearance } from '../components/base';
import type { ContentRegistry } from '../content/registry';
import type { Entity, EntityInit } from '../core/entity';
import { WEAR_SLOTS, type WearSlot } from '../core/location';
import type { LocationService } from '../core/location-service';
import type { Clock, Logger } from '../core/runtime';
import type { EntityId, PrefabId, SceneId } from '../core/types';
import type { World } from '../core/world';
import type { ActiveSceneInfo } from '../scene/scene-types';
import { placeItem } from '../systems/surface-system';
import type { CharacterPartsCatalog } from './catalog';
import { MAX_CHARACTERS, TAP_EXPRESSION_MS, type CharacterSystem } from './character-system';
import { computeCharacterLayers, type CharacterLayerData } from './layers';

/** SCENE_SYSTEM §2 / HU-GAME-023 R2: characters appear 120 units apart from the spawn. */
export const SPAWN_SPACING = 120;

export type Outfit = Partial<Record<WearSlot, PrefabId>>;

export interface CharacterDraft {
  appearance: Appearance;
  outfit: Outfit;
}

export interface CharacterSummary {
  id: EntityId;
  appearance: Appearance;
  colorTag?: string;
  sceneId?: SceneId;
  createdAt: string;
  /** Prefab worn in each slot. */
  outfit: Outfit;
}

/** A starter garment offered by the creator (HU-GAME-021 R1, R7). */
export interface ClothingOption {
  prefabId: PrefabId;
  slot: WearSlot;
  /** Loose sprite of the garment, used as its icon. */
  icon: string;
  name: string;
}

export type CharacterCommandFailure = 'noContent' | 'maxCharacters' | 'invalidPart' | 'invalidCommand' | 'entityNotFound' | 'notCharacter' | 'noActiveScene';

export interface CharacterCommandEnv {
  world: World;
  locations: LocationService;
  characters: CharacterSystem;
  content?: ContentRegistry;
  clock: Clock;
  logger: Logger;
  newId: () => EntityId;
  scene: () => ActiveSceneInfo | undefined;
}

type Result = { ok: true; entityId?: EntityId } | { ok: false; reason: CharacterCommandFailure };

const PART_LISTS: Record<keyof Appearance, keyof CharacterPartsCatalog> = {
  bodyType: 'bodyTypes',
  skinTone: 'skinTones',
  eyes: 'eyes',
  mouth: 'mouths',
  hairStyle: 'hairStyles',
  hairColor: 'hairColors',
};

/** Every value exists in the catalog (HU-GAME-022: patch with unknown parts → invalidPart). */
export function validAppearance(catalog: CharacterPartsCatalog, a: Partial<Appearance>): boolean {
  return (Object.entries(a) as [keyof Appearance, string][]).every(([field, value]) => {
    const list = catalog[PART_LISTS[field]] as { id: string }[] | undefined;
    return !!list?.some((item) => item.id === value);
  });
}

/**
 * Commands of the creator (GAME_ENGINE §4, HU-GAME-021..023): createCharacter, updateAppearance,
 * setOutfitSlot. Each one runs in a single World transaction.
 */
export class CharacterCommands {
  constructor(private readonly env: CharacterCommandEnv) {}

  private catalog(): CharacterPartsCatalog | undefined {
    return this.env.content?.characterCatalog();
  }

  private wearablePrefab(prefabId: PrefabId, slot: WearSlot) {
    const content = this.env.content;
    const p = content?.hasPrefab(prefabId) ? content.prefab(prefabId) : undefined;
    const wearable = (p?.components as { wearable?: { slot: string } } | undefined)?.wearable;
    return p && wearable?.slot === slot ? p : undefined;
  }

  private validOutfit(outfit: Outfit): boolean {
    return (Object.entries(outfit) as [WearSlot, PrefabId | undefined][]).every(
      ([slot, id]) => WEAR_SLOTS.includes(slot) && (!id || !!this.wearablePrefab(id, slot)),
    );
  }

  /** A new instance of a garment, worn by a character (the creator never shares instances). */
  private garment(characterId: EntityId, slot: WearSlot, prefabId: PrefabId): EntityInit {
    const p = this.wearablePrefab(prefabId, slot)!;
    return {
      id: this.env.newId(),
      prefabId: p.qualifiedId,
      tags: [...(p.tags ?? [])],
      location: { kind: 'worn', characterId, slot },
      components: JSON.parse(JSON.stringify(p.components)),
    };
  }

  /** HU-GAME-023 R2: default spawn, moved 120 units right while another character is closer than 120. */
  private spawnX(scene: ActiveSceneInfo, sceneId: SceneId): { x: number; y: number } {
    const spawn = scene.spawnPoints?.find((s) => s.id === 'default') ?? { x: scene.size.width / 2, y: 960 };
    const taken = this.env.world
      .query({ sceneId, has: ['character'] })
      .map((e) => e.components.transform?.x ?? 0);
    const free = (x: number) => taken.every((t) => Math.abs(t - x) >= SPAWN_SPACING);
    const width = scene.size.width;
    for (let x = spawn.x; x <= width; x += SPAWN_SPACING) if (free(x)) return { x, y: spawn.y };
    for (let x = spawn.x - SPAWN_SPACING; x >= 0; x -= SPAWN_SPACING) if (free(x)) return { x, y: spawn.y };
    return { x: spawn.x, y: spawn.y };
  }

  private colorTag(catalog: CharacterPartsCatalog): string | undefined {
    const used = new Set(this.env.world.query({ has: ['character'] }).map((e) => e.components.character?.colorTag));
    return catalog.colorTags?.find((c) => !used.has(c)) ?? catalog.colorTags?.[0];
  }

  createCharacter(appearance: Appearance, outfit: Outfit): Result {
    const catalog = this.catalog();
    const scene = this.env.scene();
    if (!catalog) return { ok: false, reason: 'noContent' };
    if (!scene) return { ok: false, reason: 'noActiveScene' };
    if (this.env.characters.count() >= MAX_CHARACTERS) return { ok: false, reason: 'maxCharacters' };
    if (!AppearanceSchema.safeParse(appearance).success || !validAppearance(catalog, appearance) || !this.validOutfit(outfit)) {
      return { ok: false, reason: 'invalidPart' };
    }
    const id = this.env.newId();
    const at = this.spawnX(scene, scene.id);
    this.env.world.transaction(() => {
      this.env.world.create(
        this.env.characters.newCharacter({
          id,
          appearance,
          location: { kind: 'scene', sceneId: scene.id },
          x: at.x,
          y: at.y,
          createdAt: new Date(this.env.clock.now()).toISOString(),
          colorTag: this.colorTag(catalog),
        }),
      );
      for (const [slot, prefabId] of Object.entries(outfit) as [WearSlot, PrefabId | undefined][]) {
        if (prefabId) this.env.world.create(this.garment(id, slot, prefabId));
      }
      // Rest on the floor under the spawn (edge case: spawn above a gap), then say hello (R3).
      placeItem(this.env.world, scene, id, at, this.env.logger);
      this.env.world.emit({ type: 'visualEffect', entityId: id, preset: 'bounce' });
    });
    this.env.characters.setExpression(id, 'happy', TAP_EXPRESSION_MS);
    return { ok: true, entityId: id };
  }

  updateAppearance(characterId: EntityId, patch: Partial<Appearance>): Result {
    const catalog = this.catalog();
    const e = this.env.world.get(characterId);
    if (!catalog) return { ok: false, reason: 'noContent' };
    if (!e) return { ok: false, reason: 'entityNotFound' };
    if (!e.components.appearance) return { ok: false, reason: 'notCharacter' };
    const keys = Object.keys(patch);
    if (!keys.length || keys.some((k) => !(k in PART_LISTS))) return { ok: false, reason: 'invalidCommand' };
    if (!validAppearance(catalog, patch)) return { ok: false, reason: 'invalidPart' };
    // Location, pose and held items never change; worn clothes are kept for any body type (R6-R7).
    this.env.characters.applyAppearance(characterId, { ...e.components.appearance, ...patch });
    return { ok: true, entityId: characterId };
  }

  /**
   * Edit mode (HU-GAME-021 R9): a new instance of the prefab is worn; the previous garment goes to a
   * wardrobe of the character's scene with space, else to its feet. `null` only takes the slot off.
   */
  setOutfitSlot(characterId: EntityId, slot: WearSlot, prefabId: PrefabId | null): Result {
    const e = this.env.world.get(characterId);
    if (!e) return { ok: false, reason: 'entityNotFound' };
    if (!e.components.character) return { ok: false, reason: 'notCharacter' };
    if (!WEAR_SLOTS.includes(slot)) return { ok: false, reason: 'invalidCommand' };
    if (prefabId && !this.wearablePrefab(prefabId, slot)) return { ok: false, reason: 'invalidPart' };
    const previousId = this.env.world.index.wornBy(characterId)[slot];
    const previous = previousId ? this.env.world.get(previousId) : undefined;
    if (previous && prefabId && previous.prefabId === this.wearablePrefab(prefabId, slot)!.qualifiedId) return { ok: true };
    this.env.world.transaction(() => {
      if (previous) this.putAway(e, previous);
      if (prefabId) this.env.world.create(this.garment(characterId, slot, prefabId));
    });
    return { ok: true, entityId: characterId };
  }

  private putAway(character: Entity, item: Entity): void {
    const sceneId = character.location.kind === 'scene' ? character.location.sceneId : undefined;
    const wardrobe = sceneId ? this.findWardrobe(sceneId, item) : undefined;
    if (wardrobe) {
      this.env.locations.move(item.id, { kind: 'container', containerId: wardrobe.id, slot: wardrobe.slot });
      return;
    }
    const t = character.components.transform ?? { x: 0, y: 960 };
    const at = { x: t.x + 60, y: t.y };
    this.env.locations.move(item.id, { kind: 'scene', sceneId: sceneId ?? this.env.scene()?.id ?? '' });
    this.env.world.update(item.id, { transform: { x: at.x, y: at.y } });
    const scene = this.env.scene();
    if (scene && scene.id === sceneId) placeItem(this.env.world, scene, item.id, at, this.env.logger);
  }

  /** A container of the scene that accepts clothing and has a free slot (the wardrobe, HU-GAME-041). */
  private findWardrobe(sceneId: SceneId, item: Entity): { id: EntityId; slot: number } | undefined {
    for (const c of this.env.world.query({ sceneId, has: ['container'] })) {
      const container = c.components.container!;
      if (!container.accepts?.some((t) => item.tags.includes(t))) continue;
      if (container.rejects?.some((t) => item.tags.includes(t))) continue;
      const occupied = this.env.world.index.inContainer(c.id);
      for (let slot = 0; slot < container.capacity; slot++) if (!occupied[slot]) return { id: c.id, slot };
    }
    return undefined;
  }

  // ---------- selectors ----------

  characters(): CharacterSummary[] {
    return this.env.world
      .query({ has: ['character'] })
      .filter((e) => !e.components.character!.isNpc)
      .sort((a, b) => a.components.character!.createdAt.localeCompare(b.components.character!.createdAt) || a.id.localeCompare(b.id))
      .map((e) => {
        const outfit: Outfit = {};
        for (const [slot, itemId] of Object.entries(this.env.world.index.wornBy(e.id)) as [WearSlot, EntityId][]) {
          const pid = this.env.world.get(itemId)?.prefabId;
          if (pid) outfit[slot] = pid;
        }
        return {
          id: e.id,
          appearance: e.components.appearance!,
          colorTag: e.components.character!.colorTag,
          sceneId: e.location.kind === 'scene' ? e.location.sceneId : undefined,
          createdAt: e.components.character!.createdAt,
          outfit,
        };
      });
  }

  /** starterClothes of the catalog with their slot and icon, in catalog order. */
  clothingOptions(): ClothingOption[] {
    const catalog = this.catalog();
    const content = this.env.content;
    if (!catalog || !content) return [];
    const out: ClothingOption[] = [];
    for (const id of catalog.starterClothes) {
      const p = content.hasPrefab(id) ? content.prefab(id) : undefined;
      const c = p?.components as { wearable?: { slot: WearSlot }; sprite?: { asset: string } } | undefined;
      if (p && c?.wearable && c.sprite) out.push({ prefabId: p.qualifiedId, slot: c.wearable.slot, icon: c.sprite.asset, name: p.metadata.name });
    }
    return out;
  }

  /** Layers of an unsaved draft, with the same resolution as the game (HU-GAME-018 R5). */
  previewLayers(draft: CharacterDraft): CharacterLayerData[] {
    const catalog = this.catalog();
    const content = this.env.content;
    if (!catalog || !content) return [];
    const worn: Partial<Record<WearSlot, NonNullable<Entity['components']['wearable']>>> = {};
    for (const [slot, prefabId] of Object.entries(draft.outfit) as [WearSlot, PrefabId | undefined][]) {
      const w = prefabId ? (this.wearablePrefab(prefabId, slot)?.components as { wearable?: Entity['components']['wearable'] })?.wearable : undefined;
      if (w) worn[slot] = w;
    }
    return computeCharacterLayers(
      { appearance: draft.appearance, pose: 'idle', expression: 'neutral', worn, held: {} },
      { catalog, hasAsset: (k) => !!content.asset(k) },
    );
  }
}
