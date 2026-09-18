import fs from 'fs';
import path from 'path';

import type { RawFile, RawPack } from '../../src/engine/content/raw-pack';

/** Paths in reports always use "/" so local and CI output match (HU-GAME-069). */
const rel = (root: string, file: string) => path.relative(root, file).split(path.sep).join('/');

export class JsonParseError extends Error {}

function readJson(root: string, file: string): RawFile {
  const text = fs.readFileSync(file, 'utf8');
  try {
    return { file: rel(root, file), data: JSON.parse(text) };
  } catch (e) {
    throw new JsonParseError(`${file}: invalid JSON (${(e as Error).message})`);
  }
}

function walk(dir: string, filter: (f: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, filter));
    else if (filter(entry.name)) out.push(full);
  }
  return out;
}

/** A pack directory is any folder under `content/` with a manifest.json. */
export function listPackDirs(contentDir: string): string[] {
  return fs
    .readdirSync(contentDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(contentDir, d.name, 'manifest.json')))
    .map((d) => path.join(contentDir, d.name))
    .sort();
}

export function readPackDir(dir: string): RawPack {
  const locales: RawPack['locales'] = {};
  for (const loc of ['es', 'en'] as const) {
    const f = path.join(dir, 'locales', `${loc}.json`);
    if (fs.existsSync(f)) locales[loc] = readJson(dir, f);
  }
  const assets = path.join(dir, 'assets.json');
  const characters = path.join(dir, 'characters', 'parts.json');
  return {
    manifest: readJson(dir, path.join(dir, 'manifest.json')),
    assets: fs.existsSync(assets) ? readJson(dir, assets) : undefined,
    prefabs: walk(path.join(dir, 'prefabs'), (f) => f.endsWith('.json')).map((f) => readJson(dir, f)),
    scenes: walk(path.join(dir, 'scenes'), (f) => f.endsWith('.json')).map((f) => readJson(dir, f)),
    rules: walk(path.join(dir, 'interactions'), (f) => f.endsWith('.rules.json')).map((f) => readJson(dir, f)),
    characters: fs.existsSync(characters) ? readJson(dir, characters) : undefined,
    locales,
  };
}
