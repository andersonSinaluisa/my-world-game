import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;

describe('project setup (HU-GAME-001)', () => {
  it('app.json follows ADR-001', () => {
    expect(appJson.orientation).toBe('landscape');
    expect(appJson.ios.requireFullScreen).toBe(true);
    expect(appJson.userInterfaceStyle).toBe('light');
    expect(appJson.android.predictiveBackGestureEnabled).toBe(false);
  });

  it('has every folder of ARCHITECTURE §3', () => {
    const folders = [
      'src/app',
      'src/ui',
      'src/game',
      'src/test',
      'src/engine/core',
      'src/engine/components',
      'src/engine/systems',
      'src/engine/actions',
      'src/engine/rules',
      'src/engine/scene',
      'src/engine/content',
      'src/engine/persistence',
      'src/engine/adapters/render',
      'src/engine/adapters/input',
      'src/engine/adapters/audio',
      'src/engine/adapters/sqlite',
      'content/core/assets/images',
      'content/core/assets/audio',
      'scripts',
    ];
    for (const folder of folders) expect(fs.existsSync(path.join(root, folder))).toBe(true);
  });

  it('contains no template demo code', () => {
    const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
    expect(pkg).not.toMatch(/reset-project/);
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(tsx?|js)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) files.push(full);
      }
    };
    walk(path.join(root, 'src'));
    walk(path.join(root, 'scripts'));
    for (const file of files) {
      expect(fs.readFileSync(file, 'utf8')).not.toMatch(/app-tabs|themed-text|reset-project|explore\.tsx/);
    }
  });
});
