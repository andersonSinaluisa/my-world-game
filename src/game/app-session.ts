import { ExpoAudioPort } from '@/engine/adapters/audio/expo-audio-port';
import { SqliteSaveStore } from '@/engine/adapters/sqlite/sqlite-save-store';

import { consoleLogger, GameSession } from './session';

/** The real app session: bundled content + SQLite saves (ADR-006) + expo-audio (AUDIO_SYSTEM). */
export function createAppSession(): GameSession {
  return new GameSession(
    () => SqliteSaveStore.open(),
    consoleLogger,
    (source) => new ExpoAudioPort(source, consoleLogger),
  );
}
