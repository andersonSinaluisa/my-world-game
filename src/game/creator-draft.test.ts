import { CharacterPartsSchema } from '@/engine/characters/catalog';
import { TEST_PARTS } from '@/test/fixtures/test-characters';

import { appearancePatch, changedSlots, draftFromCharacter, newDraft, setGarment, setPart } from './creator-draft';

const catalog = CharacterPartsSchema.parse({
  ...TEST_PARTS,
  starterClothes: TEST_PARTS.starterClothes.map((c) => `test:${c}`),
  defaults: { ...TEST_PARTS.defaults, outfit: { top: 'test:shirt_star', bottom: 'test:pants_blue', shoes: 'test:shoes_red' } },
});

describe('creator draft (HU-GAME-018..022)', () => {
  it('starts from the catalog defaults', () => {
    const d = newDraft(catalog);
    expect(d.appearance).toEqual({ bodyType: 'child', skinTone: 'skin_01', eyes: 'eyes_round', mouth: 'mouth_smile', hairStyle: 'hair_buns', hairColor: 'hair_black' });
    expect(d.outfit.top).toBe('test:shirt_star');
  });

  it('an unknown default falls back to the first option', () => {
    const d = newDraft({ ...catalog, defaults: { ...catalog.defaults, eyes: 'eyes_ghost' } });
    expect(d.appearance.eyes).toBe('eyes_round');
  });

  it('changing the body keeps face, hair and clothes', () => {
    const d = setPart(setPart(newDraft(catalog), 'eyes', 'eyes_dot'), 'bodyType', 'adult');
    expect(d.appearance).toMatchObject({ bodyType: 'adult', eyes: 'eyes_dot', mouth: 'mouth_smile', hairStyle: 'hair_buns' });
    expect(d.outfit).toEqual(newDraft(catalog).outfit);
  });

  it('one garment per slot; same value keeps the same object', () => {
    const d = newDraft(catalog);
    const d2 = setGarment(d, 'top', 'test:shirt_plain');
    expect(d2.outfit.top).toBe('test:shirt_plain');
    expect(setGarment(d2, 'top', 'test:shirt_plain')).toBe(d2);
    expect(setPart(d2, 'eyes', d2.appearance.eyes)).toBe(d2);
  });

  it('edit mode: only changed fields and changed slots', () => {
    const original = { id: 'rt_1', createdAt: '', appearance: newDraft(catalog).appearance, outfit: newDraft(catalog).outfit };
    const draft = setGarment(setPart(draftFromCharacter(original), 'hairColor', 'hair_berry'), 'top', 'test:shirt_plain');
    expect(appearancePatch(original.appearance, draft)).toEqual({ hairColor: 'hair_berry' });
    expect(changedSlots(original.outfit, draft)).toEqual([{ slot: 'top', prefabId: 'test:shirt_plain' }]);
  });
});
