import { BUDGETS, grade } from './budgets';

describe('performance budgets (HU-GAME-071)', () => {
  it('FPS degrades downwards', () => {
    expect(grade('uiFps', 60)).toBe('ok');
    expect(grade('uiFps', 55)).toBe('ok');
    expect(grade('uiFps', 50)).toBe('warning');
    expect(grade('uiFps', 30)).toBe('critical');
    expect(grade('jsFps', 24)).toBe('critical');
  });

  it('costs degrade upwards, the budget itself is still ok', () => {
    expect(grade('renderedEntities', 180)).toBe('ok');
    expect(grade('renderedEntities', 181)).toBe('warning');
    expect(grade('renderedEntities', 251)).toBe('critical');
    expect(grade('textureMb', 300)).toBe('critical');
    expect(grade('flushMs', 12)).toBe('ok');
    expect(grade('transitionMs', 2000)).toBe('warning');
  });

  it('every budget has warning before critical', () => {
    for (const b of Object.values(BUDGETS)) {
      if (b.higherIsBetter) expect(b.warning).toBeGreaterThan(b.critical);
      else expect(b.warning).toBeLessThan(b.critical);
    }
  });
});
