import type { CharacterPartsCatalog } from '@/engine/characters/catalog';
import type { CharacterSummary, Outfit } from '@/engine/characters/character-commands';
import type { Appearance } from '@/engine/components/base';
import { WEAR_SLOTS, type WearSlot } from '@/engine/core/location';
import type { PrefabId } from '@/engine/core/types';

/**
 * Creator draft (HU-GAME-018 R4): UI state of the creator screen until it is confirmed. Pure functions,
 * so the rules (defaults, keeping choices across body changes, edit diffs) are unit-tested without React.
 */
export interface CreatorDraft {
  appearance: Appearance;
  outfit: Outfit;
}

type PartField = keyof Appearance;

const LIST: Record<PartField, keyof CharacterPartsCatalog> = {
  bodyType: 'bodyTypes',
  skinTone: 'skinTones',
  eyes: 'eyes',
  mouth: 'mouths',
  hairStyle: 'hairStyles',
  hairColor: 'hairColors',
};

const idsOf = (catalog: CharacterPartsCatalog, field: PartField) => (catalog[LIST[field]] as { id: string }[]).map((o) => o.id);

/** New character: catalog defaults; an unknown default falls back to the first option (HU-GAME-018 edge case). */
export function newDraft(catalog: CharacterPartsCatalog): CreatorDraft {
  const d = catalog.defaults;
  const pick = (field: PartField, value: string) => (idsOf(catalog, field).includes(value) ? value : idsOf(catalog, field)[0]);
  return {
    appearance: {
      bodyType: pick('bodyType', d.bodyType),
      skinTone: pick('skinTone', d.skinTone),
      eyes: pick('eyes', d.eyes),
      mouth: pick('mouth', d.mouth),
      hairStyle: pick('hairStyle', d.hairStyle),
      hairColor: pick('hairColor', d.hairColor),
    },
    outfit: { ...d.outfit },
  };
}

/** Edit mode: starts from the character's current look (HU-GAME-022 R5). */
export function draftFromCharacter(c: CharacterSummary): CreatorDraft {
  return { appearance: { ...c.appearance }, outfit: { ...c.outfit } };
}

/** Changing one part keeps every other choice, including clothes on a body change (R5 of 019-021). */
export function setPart(draft: CreatorDraft, field: PartField, value: string): CreatorDraft {
  if (draft.appearance[field] === value) return draft;
  return { ...draft, appearance: { ...draft.appearance, [field]: value } };
}

/** One garment per slot (HU-GAME-021 R2). */
export function setGarment(draft: CreatorDraft, slot: WearSlot, prefabId: PrefabId): CreatorDraft {
  if (draft.outfit[slot] === prefabId) return draft;
  return { ...draft, outfit: { ...draft.outfit, [slot]: prefabId } };
}

/** Only the changed fields go into updateAppearance (HU-GAME-022 R6). */
export function appearancePatch(original: Appearance, draft: CreatorDraft): Partial<Appearance> {
  const patch: Partial<Appearance> = {};
  for (const field of Object.keys(LIST) as PartField[]) {
    if (draft.appearance[field] !== original[field]) patch[field] = draft.appearance[field];
  }
  return patch;
}

/** One setOutfitSlot per changed slot (HU-GAME-021 R9). */
export function changedSlots(original: Outfit, draft: CreatorDraft): { slot: WearSlot; prefabId: PrefabId | null }[] {
  return WEAR_SLOTS.filter((slot) => (original[slot] ?? null) !== (draft.outfit[slot] ?? null)).map((slot) => ({
    slot,
    prefabId: draft.outfit[slot] ?? null,
  }));
}
