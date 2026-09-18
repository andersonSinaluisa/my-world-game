import type { Clock, Random } from './runtime';
import type { EntityId } from './types';

// Crockford base32 (ULID spec). Own implementation to avoid a dependency (ENTITY_SCHEMA §2).
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function ulid(clock: Clock, random: Random): string {
  let time = clock.now();
  let timePart = '';
  for (let i = 0; i < 10; i++) {
    timePart = ENCODING[time % 32] + timePart;
    time = Math.floor(time / 32);
  }
  let randomPart = '';
  for (let i = 0; i < 16; i++) {
    randomPart += ENCODING[Math.floor(random.next() * 32)];
  }
  return timePart + randomPart;
}

/** Runtime entity id: `rt_<ulid>` (ENTITY_SCHEMA §2). */
export function runtimeEntityId(clock: Clock, random: Random): EntityId {
  return `rt_${ulid(clock, random)}`;
}
