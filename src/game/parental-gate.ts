/**
 * Parental gate logic (HU-GAME-074, UI_UX_GUIDELINES §4). Pure and deterministic with injected random and
 * clock, so the rules are unit-tested; the modal is only a view of this state. It knows nothing about the
 * game: it receives a destination and answers "passed" or "cancelled" (RN-6).
 */

/** RN-1 step 1: hold the gear for 3 s. */
export const HOLD_MS = 3000;
/** RN-3: three wrong answers → the gear sleeps for 30 s. */
export const MAX_WRONG = 3;
export const LOCK_MS = 30_000;
/** RN-4: 60 s without interaction closes the adult area. */
export const IDLE_MS = 60_000;

export interface Challenge {
  a: number;
  b: number;
}

export type GateDestination = 'settings' | 'externalLink' | 'purchase';

/** RN-1 step 2: a ∈ 11..19, b ∈ 3..9 (answer 33..171). */
export function newChallenge(random: () => number): Challenge {
  return { a: 11 + Math.floor(random() * 9), b: 3 + Math.floor(random() * 7) };
}

export type GateEvent = 'passed' | 'wrong' | 'locked';

export class ParentalGate {
  private wrong = 0;
  private lockedUntil = 0;
  private lastActivity = 0;
  private current: Challenge | undefined;
  private entry = '';

  constructor(
    private readonly random: () => number,
    private readonly now: () => number,
  ) {}

  /** The gear can start a hold (not locked). */
  canOpen(): boolean {
    return this.now() >= this.lockedUntil;
  }

  get lockedForMs(): number {
    return Math.max(0, this.lockedUntil - this.now());
  }

  /** After a 3 s hold: a fresh challenge every time (RN-5: a pass is never reused). */
  open(): Challenge | undefined {
    if (!this.canOpen()) return undefined;
    this.current = newChallenge(this.random);
    this.entry = '';
    this.lastActivity = this.now();
    return this.current;
  }

  get challenge(): Challenge | undefined {
    return this.current;
  }

  get input(): string {
    return this.entry;
  }

  /** Numeric keypad: digits, delete. Max 3 digits (answers are ≤ 171). */
  press(key: string): void {
    this.touch();
    if (key === 'del') this.entry = this.entry.slice(0, -1);
    else if (/^\d$/.test(key) && this.entry.length < 3) this.entry += key;
  }

  /** Confirm: right → passed; wrong → new challenge (or lock after 3 in a row). */
  confirm(): GateEvent {
    this.touch();
    const c = this.current;
    if (c && Number(this.entry) === c.a * c.b) {
      this.wrong = 0;
      this.current = undefined;
      this.entry = '';
      return 'passed';
    }
    this.wrong++;
    this.entry = '';
    if (this.wrong >= MAX_WRONG) {
      this.wrong = 0;
      this.current = undefined;
      this.lockedUntil = this.now() + LOCK_MS;
      return 'locked';
    }
    this.current = newChallenge(this.random);
    return 'wrong';
  }

  cancel(): void {
    this.current = undefined;
    this.entry = '';
  }

  touch(): void {
    this.lastActivity = this.now();
  }

  /** RN-4: true when the adult area should close for inactivity. */
  idleExpired(): boolean {
    return this.now() - this.lastActivity >= IDLE_MS;
  }
}
