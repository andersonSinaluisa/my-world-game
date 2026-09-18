import fs from 'fs';
import path from 'path';

/**
 * HU-GAME-070 RN-5: every UI key used by the app exists in es and en, and both locales have the same keys.
 * The keys are found statically (`t('ui.…')` literals) so a new label cannot ship untranslated.
 */

const ROOT = path.resolve(__dirname, '..', '..', '..');
const LOCALES = path.join(ROOT, 'content', 'core', 'locales');
const load = (lang: string) => JSON.parse(fs.readFileSync(path.join(LOCALES, `${lang}.json`), 'utf8')) as Record<string, string>;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(d.name) && !/\.test\.tsx?$/.test(d.name) ? [p] : [];
  });
}

function usedUiKeys(): Set<string> {
  const keys = new Set<string>();
  for (const dir of ['app', 'game', 'ui']) {
    for (const file of sourceFiles(path.join(ROOT, 'src', dir))) {
      for (const m of fs.readFileSync(file, 'utf8').matchAll(/\bt\(\s*['"`](ui\.[a-zA-Z0-9_.]+)['"`]/g)) keys.add(m[1]);
    }
  }
  return keys;
}

describe('i18n completeness (HU-GAME-070 RN-5)', () => {
  const es = load('es');
  const en = load('en');

  it('finds the UI keys in the source', () => {
    expect(usedUiKeys().size).toBeGreaterThan(10);
  });

  it.each(['es', 'en'])('every ui.* key used by the app exists in %s', (lang) => {
    const table = lang === 'es' ? es : en;
    const missing = [...usedUiKeys()].filter((k) => !table[k]);
    expect(missing).toEqual([]);
  });

  it('es and en define the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });
});
