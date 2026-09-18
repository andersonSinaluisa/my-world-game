/** Minimal semver helpers for pack dependencies (CONTENT_PACK_SCHEMA §2, §5). No dependency needed. */

export type Version = [number, number, number];

export function parseVersion(v: string): Version | undefined {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : undefined;
}

export function compareVersions(a: Version, b: Version): number {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** Supports `1.2.3`, `^1.2.3`, `~1.2.3`, `>=1.2.3`. Returns undefined when the range is malformed. */
export function satisfies(version: string, range: string): boolean | undefined {
  const v = parseVersion(version);
  const r = range.trim();
  const op = r.startsWith('>=') ? '>=' : r[0] === '^' || r[0] === '~' ? r[0] : '=';
  const base = parseVersion(op === '=' ? r : r.slice(op.length));
  if (!v || !base) return undefined;
  const cmp = compareVersions(v, base);
  switch (op) {
    case '=':
      return cmp === 0;
    case '>=':
      return cmp >= 0;
    case '^':
      return cmp >= 0 && v[0] === base[0];
    case '~':
      return cmp >= 0 && v[0] === base[0] && v[1] === base[1];
  }
  return undefined;
}
