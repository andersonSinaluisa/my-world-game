import { createTestGame, type TestGame } from '@/test/create-test-game';
import { prefabData, sceneData, testPack } from '@/test/fixtures/test-content';
import { InMemorySaveStore } from '@/test/in-memory-save-store';

import type { RawPack } from '../content/raw-pack';
import { SaveService } from '../persistence/save-service';
import { AudioDirector, MUSIC_CROSSFADE_MS, type AudioPort } from './audio-director';

const ROOM = 'test:room';

function pack(): RawPack {
  const p = testPack();
  const audio = (p.assets!.data as { audio: Record<string, unknown> }).audio;
  const sfx = (key: string) => (audio[key] = { file: `assets/audio/${key}.m4a`, kind: 'sfx' });
  ['sfx_drop_default_01', 'sfx_drop_default_02', 'sfx_pickup_default', 'sfx_reject_soft', 'sfx_eat_crunch', 'sfx_toggle_default', 'sfx_ui_tap', 'sfx_open_default', 'sfx_close_default'].forEach(sfx);
  audio.mus_home_calm_01 = { file: 'assets/audio/mus_home_calm_01.m4a', kind: 'music', loop: true, volume: 0.5 };
  audio.amb_kitchen = { file: 'assets/audio/amb_kitchen.m4a', kind: 'ambience', loop: true };
  const room = sceneData(p, 'room');
  room.audio = { music: 'mus_home_calm_01' };
  (room.zones as { id: string; audio?: unknown }[])[1].audio = { ambience: 'amb_kitchen' };
  (prefabData(p, 'ball').components as Record<string, unknown>).sounds = { drop: 'sfx_eat_crunch' };
  p.rules[0].data = [
    { id: 'tap_switch', trigger: 'tap', target: { has: ['switchable'] }, actions: [{ type: 'toggleSwitch' }], priority: 10 },
    { id: 'tap_open', trigger: 'tap', target: { has: ['openable'] }, actions: [{ type: 'toggleOpen' }], priority: 10 },
  ];
  return p;
}

class FakePort implements AudioPort {
  sfx: { key: string; volume: number }[] = [];
  music: { key?: string; volume: number; ms: number }[] = [];
  ambience: { key?: string; volume: number; ms: number }[] = [];
  preloaded: string[][] = [];
  playSfx(key: string, volume: number) {
    this.sfx.push({ key, volume });
  }
  setMusic(key: string | undefined, volume: number, ms: number) {
    this.music.push({ key, volume, ms });
  }
  setAmbience(key: string | undefined, volume: number, ms: number) {
    this.ambience.push({ key, volume, ms });
  }
  preload(keys: string[]) {
    this.preloaded.push(keys);
  }
  pauseAll() {}
  resumeAll() {}
}

function setup(store?: InMemorySaveStore) {
  const g = createTestGame({ packs: [pack()], saveStore: store, viewportW: 2338 });
  const port = new FakePort();
  const director = new AudioDirector({
    events: g.engine.events,
    clock: g.clock,
    random: g.random,
    content: g.content,
    getEntity: (id) => g.world.get(id),
    activeScene: () => g.engine.scene,
    activeZone: () => g.engine.activeZoneId,
    sceneEntities: () => (g.engine.scene ? g.world.query({ sceneId: g.engine.scene.id }) : []),
    settings: () => g.engine.settings,
    port,
  });
  g.dispatch({ type: 'enterScene', sceneId: ROOM, spawnId: 'default' });
  return { g, port, director };
}

function drop(g: TestGame, id: string, x: number, y: number) {
  const t = g.engine.absoluteTransform(id)!;
  g.dispatch({ type: 'dragStart', entityId: id, worldPoint: { x: t.x, y: t.y - 10 } });
  g.dispatch({ type: 'dragEnd', entityId: id, worldPoint: { x, y } });
}

describe('interaction sounds (HU-GAME-056)', () => {
  it("an entity's own sound wins; otherwise the global fallback (with a random variant)", () => {
    const { g, port } = setup();
    drop(g, `${ROOM}/ball`, 1500, 700);
    expect(port.sfx.map((s) => s.key)).toEqual(['sfx_pickup_default', 'sfx_eat_crunch']);
    g.advance(200);
    drop(g, `${ROOM}/table`, 1000, 900);
    expect(port.sfx.at(-1)?.key).toMatch(/^sfx_drop_default_0[12]$/);
  });

  it('a tap on a switchable plays toggle; open/close by the resulting state', () => {
    const { g, port } = setup();
    g.dispatch({ type: 'pointerTap', worldPoint: { x: 3200, y: 800 } });
    expect(port.sfx.at(-1)?.key).toBe('sfx_toggle_default');
    g.advance(100);
    g.dispatch({ type: 'pointerTap', worldPoint: { x: 2000, y: 820 } });
    expect(port.sfx.at(-1)?.key).toBe('sfx_open_default');
    g.advance(100);
    g.dispatch({ type: 'pointerTap', worldPoint: { x: 2000, y: 820 } });
    expect(port.sfx.at(-1)?.key).toBe('sfx_close_default');
  });

  it('two sounds of the same type within 80 ms: only the first plays', () => {
    const { g, port } = setup();
    g.dispatch({ type: 'pointerTap', worldPoint: { x: 3200, y: 800 } });
    g.advance(50);
    g.dispatch({ type: 'pointerTap', worldPoint: { x: 3200, y: 800 } });
    expect(port.sfx.filter((s) => s.key === 'sfx_toggle_default')).toHaveLength(1);
  });

  it('muted or sfxVolume 0 plays nothing; the volume is the setting', () => {
    const { g, port } = setup();
    g.dispatch({ type: 'setSetting', key: 'sfxVolume', value: 0.3 });
    g.dispatch({ type: 'pointerTap', worldPoint: { x: 3200, y: 800 } });
    expect(port.sfx.at(-1)).toEqual({ key: 'sfx_toggle_default', volume: 0.3 });
    g.advance(100);
    g.dispatch({ type: 'setSetting', key: 'muted', value: true });
    const n = port.sfx.length;
    g.dispatch({ type: 'pointerTap', worldPoint: { x: 3200, y: 800 } });
    expect(port.sfx).toHaveLength(n);
  });
});

describe('music and ambience (HU-GAME-057)', () => {
  it('the scene music starts on entry, with the crossfade', () => {
    const { port } = setup();
    expect(port.music.at(-1)).toEqual({ key: 'mus_home_calm_01', volume: 0.6 * 0.5, ms: MUSIC_CROSSFADE_MS });
    expect(port.ambience.at(-1)?.key).toBeUndefined();
  });

  it('the kitchen zone adds its ambience and keeps the same music', () => {
    const { g, port } = setup();
    g.dispatch({ type: 'cameraSettled', cameraX: 1331, viewportW: 2338 }); // zone "right"
    expect(port.music.at(-1)?.key).toBe('mus_home_calm_01');
    expect(port.ambience.at(-1)).toMatchObject({ key: 'amb_kitchen', ms: MUSIC_CROSSFADE_MS });
  });

  it('a scene without audio is silent without errors', () => {
    const { g, port } = setup();
    g.dispatch({ type: 'enterScene', sceneId: 'test:hall', spawnId: 'default' });
    expect(port.music.at(-1)?.key).toBeUndefined();
  });

  it('music volume follows the settings without restarting the track', () => {
    const { g, port, director } = setup();
    g.dispatch({ type: 'setSetting', key: 'musicVolume', value: 0.2 });
    director.applySettings();
    expect(port.music.at(-1)).toEqual({ key: 'mus_home_calm_01', volume: 0.2 * 0.5, ms: 0 });
  });
});

describe('settings (HU-GAME-058)', () => {
  it('defaults, clamping to 0..1 in 0.1 steps, invalid values rejected', () => {
    const { g } = setup();
    expect(g.engine.settings).toEqual({ musicVolume: 0.6, sfxVolume: 0.9, muted: false });
    g.dispatch({ type: 'setSetting', key: 'musicVolume', value: 1.7 });
    g.dispatch({ type: 'setSetting', key: 'sfxVolume', value: 0.34 });
    expect(g.engine.settings).toMatchObject({ musicVolume: 1, sfxVolume: 0.3 });
    expect(g.dispatch({ type: 'setSetting', key: 'muted', value: 1 })).toEqual({ ok: false, reason: 'invalidCommand' });
  });

  it('muted keeps the slider values', () => {
    const { g } = setup();
    g.dispatch({ type: 'setSetting', key: 'musicVolume', value: 0.4 });
    g.dispatch({ type: 'setSetting', key: 'muted', value: true });
    g.dispatch({ type: 'setSetting', key: 'muted', value: false });
    expect(g.engine.settings).toEqual({ musicVolume: 0.4, sfxVolume: 0.9, muted: false });
  });

  it('settings persist', async () => {
    const store = new InMemorySaveStore();
    const { g } = setup(store);
    const save = new SaveService(g.engine, store, { scheduler: g.clock }).attach();
    g.dispatch({ type: 'setSetting', key: 'sfxVolume', value: 0.3 });
    await save.flush();
    const g2 = createTestGame({ packs: [pack()], saveStore: store });
    await new SaveService(g2.engine, store, { scheduler: g2.clock }).attach().load();
    expect(g2.engine.settings.sfxVolume).toBe(0.3);
  });
});
