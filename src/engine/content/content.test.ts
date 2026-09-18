import { prefabData, sceneData, testPack } from '@/test/fixtures/test-content';

import type { RawPack } from './raw-pack';
import { ContentLoadError, ContentRegistry } from './registry';
import { defaultLocale } from './locale';
import { satisfies } from './semver';
import { mergeComponents, validatePacks, type ImageInfo } from './validate-pack';

const silent = { debug: () => {}, info: () => {}, warn: jest.fn(), error: () => {} };
const codes = (packs: RawPack[], opts = {}) => validatePacks(packs, opts).issues.map((i) => i.code);
const errors = (packs: RawPack[], opts = {}) =>
  validatePacks(packs, opts).issues.filter((i) => i.severity === 'error');

function depPack(id: string, deps: Record<string, string> = {}, version = '1.0.0'): RawPack {
  return {
    manifest: {
      file: 'manifest.json',
      data: { id, name: 'pack.test.name', version, formatVersion: 1, provides: {}, dependencies: deps, distribution: 'bundled' },
    },
    prefabs: [],
    scenes: [],
    rules: [],
    locales: { es: { file: 'locales/es.json', data: { 'pack.test.name': 'x' } }, en: { file: 'locales/en.json', data: { 'pack.test.name': 'x' } } },
  };
}

describe('validatePacks', () => {
  it('accepts the fixture pack without errors', () => {
    expect(errors([testPack()])).toEqual([]);
  });

  it('reports unknown fields with a JSON pointer path', () => {
    const pack = testPack();
    (prefabData(pack, 'ball').components.sprite as Record<string, unknown>).colour = 'red';
    const issue = validatePacks([pack]).issues.find((i) => i.code === 'unknownField')!;
    expect(issue).toMatchObject({ pack: 'test', file: 'prefabs/toy/ball.json', path: '/components/sprite/colour' });
  });

  it('reports unknown components, missing dependencies and bad state refs', () => {
    const pack = testPack();
    prefabData(pack, 'ball').components.flying = {};
    delete prefabData(pack, 'lamp').components.states;
    (prefabData(pack, 'box').components.openable as Record<string, string>).openState = 'ajar';
    const c = codes([pack]);
    expect(c).toContain('unknownComponent');
    expect(c).toContain('missingDependency');
    expect(c).toContain('invalidStateRef');
  });

  it('reports id/file mismatch and duplicate prefab ids', () => {
    const pack = testPack();
    pack.prefabs.push({ file: 'prefabs/toy/ball2.json', data: { ...prefabData(pack, 'ball') } });
    const c = codes([pack]);
    expect(c).toContain('idFileMismatch');
    expect(c).toContain('duplicatePrefabId');
  });

  it('reports unknown assets and missing i18n keys in both locales', () => {
    const pack = testPack();
    (prefabData(pack, 'ball').components.sprite as Record<string, string>).asset = 'nope';
    prefabData(pack, 'teddy').metadata = { name: 'object.unknown.name' };
    const issues = validatePacks([pack]).issues;
    expect(issues.filter((i) => i.code === 'unknownAsset')).toHaveLength(1);
    expect(issues.filter((i) => i.code === 'missingI18n').map((i) => i.message)).toEqual([
      expect.stringContaining('es.json'),
      expect.stringContaining('en.json'),
    ]);
  });

  it('checks scene structure: height, default spawn, floor gaps, bounds, zones, localIds', () => {
    const pack = testPack();
    const room = sceneData(pack, 'room');
    room.size = { width: 3840, height: 1000 };
    room.spawnPoints = [{ id: 'door', x: 500, y: 960 }];
    room.floor = [{ y: 960, x1: 0, x2: 1000 }, { y: 960, x1: 1200 }];
    room.zones = [
      { id: 'left', name: 'zone.left.name', x1: 0, x2: 2000 },
      { id: 'right', name: 'zone.right.name', x1: 1920, x2: 3840 },
    ];
    room.entities.push({ localId: 'ball', prefabId: 'ball', transform: { x: 5000, y: 960 } });
    const c = codes([pack]);
    for (const code of ['invalidSceneHeight', 'missingDefaultSpawn', 'floorGap', 'zoneOverlap', 'duplicateLocalId', 'coordinateOutOfBounds']) {
      expect(c).toContain(code);
    }
  });

  it('checks inContainer references and slot capacity', () => {
    const pack = testPack();
    const room = sceneData(pack, 'room');
    room.entities.push(
      { localId: 'b2', prefabId: 'ball', inContainer: { localId: 'box', slot: 0 } },
      { localId: 'b3', prefabId: 'ball', inContainer: { localId: 'box', slot: 9 } },
      { localId: 'b4', prefabId: 'ball', inContainer: { localId: 'lamp', slot: 0 } },
    );
    const c = codes([pack]).filter((x) => x.startsWith('invalidContainer'));
    expect(c.sort()).toEqual(['invalidContainer', 'invalidContainerSlot', 'invalidContainerSlot']);
  });

  it('validates the merged result of overrides', () => {
    const pack = testPack();
    sceneData(pack, 'room').entities.push({ localId: 'box2', prefabId: 'box', transform: { x: 100, y: 960 }, overrides: { states: null } });
    expect(codes([pack])).toContain('missingDependency');
  });

  it('checks rules: unknown action/condition/component, tap with source, prefabId in global, duplicates', () => {
    const pack = testPack();
    const rules = pack.rules[0].data as Record<string, unknown>[];
    rules.push(
      { id: 'bad1', trigger: 'drop', target: { has: ['wings'] }, actions: [{ type: 'explode' }], conditions: [{ type: 'isFullMoon' }] },
      { id: 'bad2', trigger: 'tap', source: {}, target: { prefabId: 'test:ball' }, actions: [{ type: 'cycleState' }] },
      { id: 'bad1', trigger: 'tap', target: {}, actions: [{ type: 'cycleState' }] },
    );
    const c = codes([pack]);
    for (const code of ['unknownAction', 'unknownCondition', 'unknownComponent', 'tapWithSource', 'prefabIdInGlobal', 'duplicateRuleId']) {
      expect(c).toContain(code);
    }
  });

  it('stops at an invalid or unsupported manifest but keeps other packs', () => {
    const broken = testPack();
    (broken.manifest.data as Record<string, unknown>).formatVersion = 2;
    const result = validatePacks([broken, depPack('extra')]);
    expect(result.issues.map((i) => i.code)).toEqual(['unsupportedFormat']);
    expect(result.packs.map((p) => p.manifest.id)).toEqual(['extra']);
  });

  it('reports duplicate pack ids and duplicate asset keys across packs', () => {
    const other = testPack();
    (other.manifest.data as Record<string, unknown>).id = 'other';
    expect(codes([testPack(), testPack()])).toContain('duplicatePackId');
    expect(codes([testPack(), other])).toContain('duplicateAssetKey');
  });

  it('resolves dependencies: missing, version and cycles disable the pack and its dependents', () => {
    const result = validatePacks([
      depPack('a', { b: '^1.0.0' }),
      depPack('b', { a: '^1.0.0' }),
      depPack('c', { zzz: '^1.0.0' }),
      depPack('d', { e: '^2.0.0' }),
      depPack('e', {}, '1.4.0'),
      depPack('f', { c: '^1.0.0' }),
      depPack('g', { e: '^1.2.0' }),
    ]);
    const c = result.issues.map((i) => `${i.pack}:${i.code}`);
    expect(c).toEqual(expect.arrayContaining(['a:dependencyCycle', 'b:dependencyCycle', 'c:missingDependency', 'd:dependencyVersion']));
    expect(result.packs.map((p) => p.manifest.id).sort()).toEqual(['e', 'g']);
    // dependencies come first
    expect(result.packs.map((p) => p.manifest.id)).toEqual(['e', 'g']);
  });

  it('forbids referencing packs that are not declared as dependencies', () => {
    const pack = testPack();
    sceneData(pack, 'room').entities.push({ localId: 'foreign', prefabId: 'other:thing', transform: { x: 10, y: 960 } });
    expect(codes([pack])).toContain('undeclaredPackRef');
  });

  it('checks newGame scene and spawn', () => {
    const pack = testPack();
    (pack.manifest.data as { newGame: { spawnId: string } }).newGame.spawnId = 'roof';
    expect(codes([pack])).toContain('unknownSpawn');
  });

  it('checks image files via the injected reader', () => {
    const pack = testPack();
    const readImage = (_pack: string, file: string): ImageInfo | undefined => {
      if (file.includes('teddy')) return undefined;
      if (file.includes('ball')) return { format: 'png', w: 80, h: 80 };
      if (file.includes('brush')) return { format: 'webp', w: 61, h: 60 };
      if (file.includes('table')) return { format: 'webp', w: 4096, h: 180 };
      const m = /(\w+)\.webp$/.exec(file)!;
      const img = (pack.assets!.data as { images: Record<string, { w: number; h: number }> }).images[m[1]];
      return { format: 'webp', w: img.w, h: img.h };
    };
    const c = codes([pack], { readImage });
    expect(c.filter((x) => x === 'missingFile')).toHaveLength(1);
    expect(c).toContain('invalidImageFormat');
    expect(c).toContain('imageSizeMismatch');
    expect(c).toContain('textureTooLarge');
  });

  it('turns placeholders into errors only in release', () => {
    const pack = testPack();
    (pack.assets!.data as { images: Record<string, Record<string, unknown>> }).images.test_obj_ball.placeholder = true;
    expect(validatePacks([pack]).issues.find((i) => i.code === 'placeholderAsset')?.severity).toBe('warning');
    expect(validatePacks([pack], { release: true }).issues.find((i) => i.code === 'placeholderInRelease')?.severity).toBe('error');
  });

  it('schema level skips cross references', () => {
    const pack = testPack();
    (prefabData(pack, 'ball').components.sprite as Record<string, string>).asset = 'nope';
    expect(codes([pack], { level: 'schema' })).toEqual([]);
  });
});

describe('mergeComponents', () => {
  it('merges per field, replaces arrays and removes with null', () => {
    const base = { sprite: { asset: 'a', layer: 'props', pivot: { x: 0.5, y: 1 } }, draggable: {}, states: { current: 'x', values: ['x', 'y'] } };
    const merged = mergeComponents(base, { sprite: { pivot: { x: 0 } }, states: { values: ['x'] }, draggable: null });
    expect(merged).toEqual({ sprite: { asset: 'a', layer: 'props', pivot: { x: 0, y: 1 } }, states: { current: 'x', values: ['x'] } });
    expect(base.sprite.pivot.x).toBe(0.5);
  });
});

describe('satisfies', () => {
  it.each([
    ['1.2.3', '^1.0.0', true],
    ['2.0.0', '^1.0.0', false],
    ['1.2.3', '>=1.2.0', true],
    ['1.1.9', '>=1.2.0', false],
    ['1.2.3', '1.2.3', true],
  ])('%s satisfies %s → %s', (v, range, ok) => expect(satisfies(v, range)).toBe(ok));
});

describe('ContentRegistry', () => {
  const load = (packs: RawPack[], dev = true) => ContentRegistry.load(packs, { dev, logger: silent, corePack: 'test' });

  it('registers namespaced prefabs, scenes and rules', () => {
    const reg = load([testPack()]);
    expect(reg.prefab('test:ball')?.qualifiedId).toBe('test:ball');
    expect(reg.prefab('ball', 'test')?.qualifiedId).toBe('test:ball');
    expect(reg.scene('test:room')?.size.width).toBe(3840);
    expect(reg.rules().map((r) => r.qualifiedId)).toContain('test:paint_open_box');
    expect(reg.assetSize('test_obj_ball')).toEqual({ w: 80, h: 80 });
    expect(reg.newGame()?.sceneId).toBe('test:room');
  });

  it('resolves aliases and knows removed ids', () => {
    const reg = load([testPack()]);
    expect(reg.resolveAlias('test:old_ball')).toBe('test:ball');
    expect(reg.prefab('test:old_ball')?.qualifiedId).toBe('test:ball');
    expect(reg.isRemoved('test:retired_toy')).toBe(true);
  });

  it('throws on unknown prefab in dev and returns undefined in production', () => {
    expect(() => load([testPack()]).prefab('test:ghost')).toThrow('Unknown prefab');
    expect(load([testPack()], false).prefab('test:ghost')).toBeUndefined();
  });

  it('fails fast in dev when the core pack has errors', () => {
    const pack = testPack();
    (prefabData(pack, 'ball').components.sprite as Record<string, string>).asset = 'nope';
    expect(() => load([pack])).toThrow(ContentLoadError);
  });

  it('disables a broken non-core pack and keeps the rest', () => {
    const extra = depPack('extra', { test: '^9.0.0' });
    const reg = load([testPack(), extra]);
    expect(reg.packs().map((m) => m.id)).toEqual(['test']);
    expect(reg.issues.some((i) => i.code === 'dependencyVersion')).toBe(true);
  });

  it('translates with fallback to the other locale and then the key', () => {
    const pack = testPack();
    delete (pack.locales.en!.data as Record<string, string>)['ui.play.label'];
    const reg = ContentRegistry.load([pack], { dev: false, logger: silent, corePack: 'test' });
    expect(reg.t('object.ball.name', 'en')).toBe('Ball');
    expect(reg.t('ui.play.label', 'en')).toBe('Jugar');
    expect(reg.t('ui.nothing', 'es')).toBe('ui.nothing');
    expect(silent.warn).toHaveBeenCalled();
  });
});

describe('defaultLocale', () => {
  it.each([
    ['es-MX', 'es'],
    ['es', 'es'],
    ['en-GB', 'en'],
    ['fr-FR', 'en'],
  ])('%s → %s', (tag, loc) => expect(defaultLocale(tag)).toBe(loc));
});
