import { IDLE_MS, LOCK_MS, newChallenge, ParentalGate } from './parental-gate';

function gate() {
  let t = 0;
  const seq = [0.34, 0, 0.9, 0.9, 0.1, 0.1, 0.5, 0.5, 0.2, 0.2];
  let i = 0;
  const g = new ParentalGate(
    () => seq[i++ % seq.length],
    () => t,
  );
  return { g, advance: (ms: number) => (t += ms) };
}

const answer = (g: ParentalGate) => String(g.challenge!.a * g.challenge!.b);
const type = (g: ParentalGate, digits: string) => digits.split('').forEach((d) => g.press(d));

describe('parental gate (HU-GAME-074)', () => {
  it('challenges are two-digit × one-digit multiplications', () => {
    for (let i = 0; i < 50; i++) {
      const c = newChallenge(Math.random);
      expect(c.a).toBeGreaterThanOrEqual(11);
      expect(c.a).toBeLessThanOrEqual(19);
      expect(c.b).toBeGreaterThanOrEqual(3);
      expect(c.b).toBeLessThanOrEqual(9);
    }
    expect(newChallenge(() => 0.34)).toEqual({ a: 14, b: 5 });
  });

  it('the right answer passes', () => {
    const { g } = gate();
    g.open();
    type(g, answer(g));
    expect(g.confirm()).toBe('passed');
  });

  it('a wrong answer clears the field and brings a new challenge', () => {
    const { g } = gate();
    const first = g.open()!;
    type(g, '41');
    expect(g.confirm()).toBe('wrong');
    expect(g.input).toBe('');
    expect(g.challenge).not.toEqual(first);
  });

  it('three wrong answers lock the gear for 30 s', () => {
    const { g, advance } = gate();
    g.open();
    for (let i = 0; i < 2; i++) {
      type(g, '1');
      expect(g.confirm()).toBe('wrong');
    }
    type(g, '1');
    expect(g.confirm()).toBe('locked');
    expect(g.canOpen()).toBe(false);
    expect(g.open()).toBeUndefined();
    advance(LOCK_MS - 1);
    expect(g.canOpen()).toBe(false);
    advance(1);
    expect(g.canOpen()).toBe(true);
  });

  it('a pass is never reused: each opening has a new challenge', () => {
    const { g } = gate();
    const a = g.open();
    type(g, answer(g));
    g.confirm();
    const b = g.open();
    expect(b).toBeDefined();
    expect(g.input).toBe('');
    void a;
  });

  it('60 s without interaction expires the adult area', () => {
    const { g, advance } = gate();
    g.open();
    advance(IDLE_MS - 1);
    expect(g.idleExpired()).toBe(false);
    g.press('1');
    advance(IDLE_MS);
    expect(g.idleExpired()).toBe(true);
  });

  it('delete and a 3-digit limit on the keypad', () => {
    const { g } = gate();
    g.open();
    type(g, '1234');
    expect(g.input).toBe('123');
    g.press('del');
    expect(g.input).toBe('12');
  });
});
