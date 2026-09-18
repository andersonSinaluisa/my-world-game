import fs from 'fs';
import os from 'os';
import path from 'path';

import { generate } from './generate-asset-map';
import { readImageHeader } from './lib/image-header';
import { runValidator } from './validate-content';

const CONTENT = path.resolve(__dirname, '..', 'content');

function copyContent(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'myworld-content-'));
  fs.cpSync(path.join(CONTENT, 'core'), path.join(dir, 'core'), { recursive: true });
  return dir;
}

const editJson = (file: string, edit: (data: Record<string, unknown>) => void) => {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  edit(data);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

describe('content:validate (HU-GAME-069)', () => {
  it('validates the real core pack with 0 errors', () => {
    const r = runValidator([], CONTENT);
    expect(r.stderr).toBe('');
    expect(r.stdout).toMatch(/^0 errores, \d+ advertencias$/m);
    expect(r.code).toBe(0);
  });

  it('fails in release because the core pack still uses placeholders', () => {
    const r = runValidator(['--release', '--json'], CONTENT);
    expect(r.code).toBe(1);
    const issues = JSON.parse(r.stdout) as { code: string }[];
    expect(issues.some((i) => i.code === 'placeholderInRelease')).toBe(true);
  });

  it('reports every error at once with exit code 1', () => {
    const dir = copyContent();
    try {
      editJson(path.join(dir, 'core', 'assets.json'), (a) => {
        (a.images as Record<string, { w: number }>).obj_toy_ball.w += 1;
      });
      fs.rmSync(path.join(dir, 'core', 'assets', 'images', 'obj_food_apple_red.webp'));
      const r = runValidator(['--json', '--dir', dir]);
      expect(r.code).toBe(1);
      const codes = (JSON.parse(r.stdout) as { code: string; file: string }[]).map((i) => i.code);
      expect(codes).toEqual(expect.arrayContaining(['imageSizeMismatch', 'missingFile']));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exits 2 on invalid JSON and on unknown options', () => {
    const dir = copyContent();
    try {
      fs.writeFileSync(path.join(dir, 'core', 'locales', 'es.json'), '{ nope');
      expect(runValidator(['--dir', dir]).code).toBe(2);
      expect(runValidator(['--frobnicate']).code).toBe(2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('content:assets generator (HU-GAME-068 R6)', () => {
  it('is deterministic and the committed files are up to date', () => {
    const a = generate(CONTENT);
    const b = generate(CONTENT);
    expect(a.errors).toEqual([]);
    expect(a.files).toEqual(b.files);
    for (const f of a.files) expect(fs.readFileSync(f.file, 'utf8').replace(/\r\n/g, '\n')).toBe(f.content);
  });

  it('reports assets whose file is missing', () => {
    const dir = copyContent();
    try {
      fs.rmSync(path.join(dir, 'core', 'assets', 'images', 'obj_toy_ball.webp'));
      expect(generate(dir).errors).toEqual([expect.stringContaining('obj_toy_ball')]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('readImageHeader', () => {
  it('reads WebP dimensions', () => {
    const info = readImageHeader(path.join(CONTENT, 'core', 'assets', 'images', 'obj_toy_ball.webp'));
    expect(info?.format).toBe('webp');
    expect(info?.w).toBeGreaterThan(0);
  });

  it('returns undefined for a missing file', () => {
    expect(readImageHeader(path.join(CONTENT, 'nope.webp'))).toBeUndefined();
  });
});
