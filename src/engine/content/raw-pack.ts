import type { LocaleId } from './schemas';

/** A file as read from disk or bundled with Metro: path relative to the pack + parsed JSON. */
export interface RawFile<T = unknown> {
  file: string;
  data: T;
}

/** Unvalidated pack content. Built by `content/index.ts` (bundled) or by the CLI validator (fs). */
export interface RawPack {
  manifest: RawFile;
  assets?: RawFile;
  prefabs: RawFile[];
  scenes: RawFile[];
  rules: RawFile[];
  locales: Partial<Record<LocaleId, RawFile>>;
}

export type IssueSeverity = 'error' | 'warning';

/** CONTENT_PACK_SCHEMA §6: `{ pack, file, path (JSON pointer), code, message }`. */
export interface ContentIssue {
  pack: string;
  file: string;
  path: string;
  code: string;
  message: string;
  severity: IssueSeverity;
}

export function pointer(segments: (string | number)[]): string {
  return segments.length ? '/' + segments.map((s) => String(s).replace(/~/g, '~0').replace(/\//g, '~1')).join('/') : '';
}
