import { createAudioPlayer, preload as preloadSource, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import type { AudioKey, AudioPort } from '../../audio/audio-director';
import type { Logger } from '../../core/runtime';

/** HU-GAME-056 RN-3: at most 6 effects at once. */
export const MAX_POLYPHONY = 6;
/** Effects are short (≤ 1.5 s, AUDIO_SYSTEM §4): a voice is considered free after this. */
const VOICE_MS = 1500;
const FADE_STEPS = 10;

interface Track {
  key: AudioKey;
  player: AudioPlayer;
  volume: number;
}

/**
 * expo-audio implementation of the AudioPort (AUDIO_SYSTEM §1). It only plays what the AudioDirector
 * decides: a small pool of effect voices, one music track and one ambience with linear crossfades.
 * Session "mix with others", no background playback (HU-GAME-057 RN-7). Verified on devices.
 */
export class ExpoAudioPort implements AudioPort {
  private voices: { player: AudioPlayer; busyUntil: number }[] = [];
  private music: Track | undefined;
  private ambience: Track | undefined;
  private paused = false;

  constructor(
    private readonly source: (key: AudioKey) => number | undefined,
    private readonly logger: Logger,
    private readonly now: () => number = () => Date.now(),
  ) {
    void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch((e) =>
      this.logger.warn('Audio mode not set', { error: String(e) }),
    );
  }

  playSfx(key: AudioKey, volume: number): void {
    if (this.paused) return;
    const src = this.source(key);
    if (src === undefined) return this.logger.warn(`Missing audio "${key}"`);
    const t = this.now();
    let voice = this.voices.find((v) => v.busyUntil <= t);
    if (!voice) {
      if (this.voices.length >= MAX_POLYPHONY) return; // RN-3: drop instead of cutting another effect
      voice = { player: createAudioPlayer(src), busyUntil: 0 };
      this.voices.push(voice);
    } else {
      voice.player.replace(src);
    }
    voice.busyUntil = t + VOICE_MS;
    voice.player.volume = volume;
    void voice.player.seekTo(0).then(() => voice!.player.play());
  }

  setMusic(key: AudioKey | undefined, volume: number, crossfadeMs: number): void {
    this.music = this.crossfade(this.music, key, volume, crossfadeMs);
  }

  setAmbience(key: AudioKey | undefined, volume: number, crossfadeMs: number): void {
    this.ambience = this.crossfade(this.ambience, key, volume, crossfadeMs);
  }

  /** Same key: only the volume changes, the track does not restart (HU-GAME-057 RN-3). */
  private crossfade(current: Track | undefined, key: AudioKey | undefined, volume: number, ms: number): Track | undefined {
    if (current && current.key === key) {
      this.fade(current.player, current.player.volume, volume, ms);
      current.volume = volume;
      return current;
    }
    if (current) {
      const old = current.player;
      this.fade(old, old.volume, 0, ms, () => old.remove());
    }
    if (!key) return undefined;
    const src = this.source(key);
    if (src === undefined) {
      this.logger.warn(`Missing audio "${key}"`);
      return undefined;
    }
    const player = createAudioPlayer(src);
    player.loop = true;
    player.volume = 0;
    if (!this.paused) player.play();
    this.fade(player, 0, volume, ms);
    return { key, player, volume };
  }

  private fade(player: AudioPlayer, from: number, to: number, ms: number, done?: () => void): void {
    if (ms <= 0) {
      player.volume = to;
      done?.();
      return;
    }
    let step = 0;
    const timer = setInterval(() => {
      step++;
      player.volume = from + ((to - from) * step) / FADE_STEPS;
      if (step >= FADE_STEPS) {
        clearInterval(timer);
        done?.();
      }
    }, ms / FADE_STEPS);
  }

  preload(keys: AudioKey[]): void {
    for (const key of keys) {
      const src = this.source(key);
      if (src !== undefined) void preloadSource(src).catch(() => undefined);
    }
  }

  pauseAll(): void {
    this.paused = true;
    this.music?.player.pause();
    this.ambience?.player.pause();
    for (const v of this.voices) v.player.pause();
  }

  resumeAll(): void {
    this.paused = false;
    this.music?.player.play();
    this.ambience?.player.play();
  }
}
