/**
 * Content validator for the CLI and CI (HU-GAME-069, CONTENT_PACK_SCHEMA §6).
 * Reuses the runtime validator from src/engine/content; only file access lives here.
 *
 * Usage: npm run content:validate [-- --release] [-- --json] [-- --dir <contentDir>]
 * Exit codes: 0 = no errors (warnings allowed), 1 = content errors, 2 = the tool itself failed.
 */
import fs from 'fs';
import path from 'path';

import type { ContentIssue } from '../src/engine/content/raw-pack';
import { validatePacks } from '../src/engine/content/validate-pack';
import { readImageHeader } from './lib/image-header';
import { listPackDirs, readPackDir } from './lib/pack-fs';

const USAGE = 'Usage: validate-content [--release] [--json] [--dir <contentDir>]';

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function runValidator(argv: string[], defaultDir = path.resolve(__dirname, '..', 'content')): CliResult {
  let release = false;
  let json = false;
  let dir = defaultDir;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--release') release = true;
    else if (a === '--json') json = true;
    else if (a === '--dir' && argv[i + 1]) dir = path.resolve(argv[++i]);
    else return { code: 2, stdout: '', stderr: `Unknown option "${a}"\n${USAGE}\n` };
  }
  try {
    const dirs = listPackDirs(dir);
    const byId = new Map<string, string>();
    const raws = dirs.map((d) => {
      const raw = readPackDir(d);
      const id = (raw.manifest.data as { id?: string })?.id;
      if (typeof id === 'string') byId.set(id, d);
      return raw;
    });
    const result = validatePacks(raws, {
      level: 'full',
      release,
      readImage: (packId, file) => {
        const d = byId.get(packId);
        return d ? readImageHeader(path.join(d, file)) : undefined;
      },
      fileExists: (packId, file) => {
        const d = byId.get(packId);
        return !!d && fs.existsSync(path.join(d, file));
      },
    });
    const errors = result.issues.filter((i) => i.severity === 'error');
    const stdout = json ? JSON.stringify(result.issues, null, 2) + '\n' : formatText(result.issues, result.warningCount);
    return { code: errors.length ? 1 : 0, stdout, stderr: '' };
  } catch (e) {
    return { code: 2, stdout: '', stderr: `validate-content failed: ${(e as Error).message}\n` };
  }
}

function formatText(issues: ContentIssue[], warnings: number): string {
  const lines: string[] = [];
  const sorted = [...issues].sort((a, b) => a.pack.localeCompare(b.pack) || a.file.localeCompare(b.file) || a.path.localeCompare(b.path));
  let group = '';
  for (const i of sorted) {
    const g = `${i.pack} · ${i.file}`;
    if (g !== group) {
      lines.push(g);
      group = g;
    }
    lines.push(`  ${i.severity === 'error' ? 'ERROR' : 'warn '} ${i.path || '/'} ${i.code}: ${i.message}`);
  }
  const errors = issues.length - warnings;
  lines.push(`${errors} errores, ${warnings} advertencias`);
  return lines.join('\n') + '\n';
}

if (require.main === module) {
  const r = runValidator(process.argv.slice(2));
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  process.exit(r.code);
}
