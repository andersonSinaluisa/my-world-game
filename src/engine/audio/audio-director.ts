import type { ContentRegistry } from '../content/registry';
import type { Entity } from '../core/entity';
import type { EventBus, GameEvent } from '../core/events';
import type { Clock, Random } from '../core/runtime';
import type { EntityId } from '../core/types';
import type { ActiveSceneInfo } from '../scene/scene-types';

/**
 * AudioDirector (AUDIO_SYSTEM §2-§3, HU-GAME-056..058). Pure: it maps domain events to *keys* and hands
 * them to an AudioPort; the expo-audio adapter only plays. The engine never knows files (RN-2).
 */

export type AudioKey = string;

export interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  /** UI language (HU-GAME-075); undefined = device default. */
  language?: 'es' | 'en';
}

/** HU-GAME-058 RN-5: defaults of a new game. */
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { musicVolume: 0.6, sfxVolume: 0.9, muted: false };
/** HU-GAME-056 RN-3: the same sound type within 80 ms is dropped. */
export const SAME_SOUND_GAP_MS = 80;
/** HU-GAME-057 RN-3. */
export const MUSIC_CROSSFADE_MS = 800;

export interface AudioPort {
  /** One-shot effect at `volume` (already multiplied by settings). */
  playSfx(key: AudioKey, volume: number): void;
  /** Loop the music track (undefined = silence) with a crossfade; same key keeps playing (RN-3). */
  setMusic(key: AudioKey | undefined, volume: number, crossfadeMs: number): void;
  setAmbience(key: AudioKey | undefined, volume: number, crossfadeMs: number): void;
  /** Preload the effects of a scene (RN-5); globals stay loaded. */
  preload(keys: AudioKey[]): void;
  /** App to background / foreground (RN-8, 057 RN-6). */
  pauseAll(): void;
  resumeAll(): void;
}

/** Fallback key per role (RN-1). Variants _01.._03 are resolved by `pickVariant`. */
const FALLBACK: Record<string, AudioKey> = {
  pickup: 'sfx_pickup_default',
  drop: 'sfx_drop_default',
  open: 'sfx_open_default',
  close: 'sfx_close_default',
  toggle: 'sfx_toggle_default',
  eat: 'sfx_eat_default',
  drink: 'sfx_drink_default',
  spawn: 'sfx_spawn_default',
  use: 'sfx_use_default',
};

export const SFX_REJECT = 'sfx_reject_soft';
export const SFX_COIN = 'sfx_coin';
export const SFX_UI_TAP = 'sfx_ui_tap';

/** Role of a performed interaction by its first action (RN-1 "fallback por tipo de acción"). */
const ACTION_ROLE: Record<string, string> = {
  eat: 'eat',
  drink: 'drink',
  toggleSwitch: 'toggle',
  spawn: 'spawn',
  store: 'drop',
  addToInventory: 'drop',
  hold: 'pickup',
  wear: 'use',
  unwear: 'pickup',
  sit: 'use',
  sleep: 'use',
  setState: 'use',
  cycleState: 'use',
};

export interface AudioDirectorDeps {
  events: EventBus;
  clock: Clock;
  random: Random;
  content?: ContentRegistry;
  getEntity: (id: EntityId) => Entity | undefined;
  activeScene: () => ActiveSceneInfo | undefined;
  activeZone: () => string | undefined;
  /** Entities of the active scene, for preloading their sounds. */
  sceneEntities: () => Entity[];
  settings: () => AudioSettings;
  port: AudioPort;
}

export class AudioDirector {
  private lastPlayed = new Map<string, number>();
  private music: AudioKey | undefined;
  private ambience: AudioKey | undefined;
  private unsubscribe: () => void;

  constructor(private readonly d: AudioDirectorDeps) {
    this.unsubscribe = d.events.subscribe((batch) => this.onBatch(batch));
  }

  dispose(): void {
    this.unsubscribe();
  }

  /** UI button sound (HUD and menus). */
  uiTap(): void {
    this.play(SFX_UI_TAP, 'ui');
  }

  /** Settings changed (HU-GAME-058 RN-2): the running music changes volume without restarting. */
  applySettings(): void {
    this.updateMusic(0);
  }

  // ---------- events ----------

  private onBatch(batch: readonly GameEvent[]): void {
    for (const e of batch) {
      switch (e.type) {
        case 'pickedUp':
          this.play(this.keyFor(e.entityId, 'pickup'), 'pickup');
          break;
        case 'dropped':
          if (e.placed) this.play(this.keyFor(e.entityId, 'drop'), 'drop');
          break;
        case 'interactionPerformed':
          this.onPerformed(e);
          break;
        case 'interactionRejected':
          this.play(SFX_REJECT, 'reject');
          break;
        case 'walletChanged':
          if (e.delta > 0) this.play(SFX_COIN, 'coin');
          break;
        case 'sceneWillChange':
          this.d.port.setMusic(undefined, 0, MUSIC_CROSSFADE_MS);
          this.d.port.setAmbience(undefined, 0, MUSIC_CROSSFADE_MS);
          this.music = this.ambience = undefined;
          break;
        case 'sceneLoaded':
          this.d.port.preload(this.sceneSfx());
          this.updateMusic(MUSIC_CROSSFADE_MS);
          break;
        case 'zoneChanged':
          this.updateMusic(MUSIC_CROSSFADE_MS);
          break;
        default:
          break;
      }
    }
  }

  private onPerformed(e: Extract<GameEvent, { type: 'interactionPerformed' }>): void {
    const action = e.actions[0];
    let role = ACTION_ROLE[action];
    const target = e.targetId ? this.d.getEntity(e.targetId) : undefined;
    if (action === 'toggleOpen' || action === 'open' || action === 'close') {
      const o = target?.components.openable;
      role = o && target?.components.states?.current === o.openState ? 'open' : 'close';
    }
    if (!role) return;
    // The entity that "makes" the sound: the item for eat/drink/store, otherwise the target.
    const main = ['eat', 'drink', 'drop', 'pickup'].includes(role) ? (e.sourceId ?? e.targetId) : (e.targetId ?? e.sourceId);
    this.play(this.keyFor(main, role), role);
  }

  /** sounds[role] of the entity, else the global fallback (RN-1). */
  keyFor(entityId: EntityId | undefined, role: string): AudioKey | undefined {
    const own = entityId ? (this.d.getEntity(entityId)?.components.sounds as Record<string, string> | undefined)?.[role] : undefined;
    return own ?? FALLBACK[role];
  }

  private play(key: AudioKey | undefined, type: string): void {
    if (!key) return;
    const s = this.d.settings();
    const volume = s.muted ? 0 : s.sfxVolume;
    if (volume <= 0) return; // RN-7
    const now = this.d.clock.now();
    const last = this.lastPlayed.get(type);
    if (last !== undefined && now - last < SAME_SOUND_GAP_MS) return; // RN-3
    this.lastPlayed.set(type, now);
    const resolved = this.pickVariant(key);
    if (!resolved) return;
    this.d.port.playSfx(resolved, volume * this.baseVolume(resolved));
  }

  /** `key` itself if it exists, else one of key_01..key_09 at random (RN-4). */
  pickVariant(key: AudioKey): AudioKey | undefined {
    const content = this.d.content;
    if (!content) return key;
    if (content.audio(key)) return key;
    const variants: AudioKey[] = [];
    for (let i = 1; i <= 9; i++) {
      const k = `${key}_0${i}`;
      if (content.audio(k)) variants.push(k);
    }
    return variants.length ? variants[Math.floor(this.d.random.next() * variants.length)] : undefined;
  }

  private baseVolume(key: AudioKey): number {
    return this.d.content?.audio(key)?.volume ?? 1;
  }

  // ---------- music and ambience (HU-GAME-057) ----------

  private updateMusic(crossfadeMs: number): void {
    const scene = this.d.activeScene();
    const zone = scene?.zones?.find((z) => z.id === this.d.activeZone());
    const music = zone?.audio?.music ?? scene?.audio?.music;
    const ambience = zone?.audio?.ambience ?? scene?.audio?.ambience;
    const s = this.d.settings();
    const volume = s.muted ? 0 : s.musicVolume;
    this.music = music;
    this.ambience = ambience;
    this.d.port.setMusic(music, music ? volume * this.baseVolume(music) : 0, crossfadeMs);
    this.d.port.setAmbience(ambience, ambience ? volume * this.baseVolume(ambience) : 0, crossfadeMs);
  }

  get currentMusic(): AudioKey | undefined {
    return this.music;
  }

  get currentAmbience(): AudioKey | undefined {
    return this.ambience;
  }

  /** Effects the entities of the active scene may play (RN-5 preload). */
  private sceneSfx(): AudioKey[] {
    const keys = new Set<AudioKey>();
    for (const e of this.d.sceneEntities()) {
      for (const k of Object.values((e.components.sounds as Record<string, string> | undefined) ?? {})) keys.add(k);
    }
    return [...keys];
  }
}
