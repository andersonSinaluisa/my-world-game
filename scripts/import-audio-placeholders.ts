/**
 * Placeholder sound effects for the core pack (HU-GAME-056): CC0 Kenney sounds converted to the
 * AUDIO_SYSTEM §4 format (.m4a AAC mono 44.1 kHz ~96 kbps, loudness-normalized to about −16 LUFS).
 * NOT final audio. Uses ffmpeg-static (dev dependency); run once and commit the output.
 *
 * Usage: npx tsx scripts/import-audio-placeholders.ts   (then npm run content:assets)
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpeg: string = require('ffmpeg-static');

const PACK = path.resolve(__dirname, '..', 'content', 'core');
const VENDOR = path.resolve(__dirname, '..', '..', 'assets', 'vendor', 'kenney');
const SOURCES: Record<string, string> = {
  'interface-sounds': 'https://kenney.nl/assets/interface-sounds',
  'digital-audio': 'https://kenney.nl/assets/digital-audio',
};

/** AudioKey → [vendor pack, file]. Keys with _01.._03 are variants of the same sound (RN-4). */
const SFX: Record<string, [string, string]> = {
  sfx_ui_tap: ['interface-sounds', 'click_002.ogg'],
  sfx_pickup_default: ['interface-sounds', 'pluck_001.ogg'],
  sfx_drop_default_01: ['interface-sounds', 'drop_001.ogg'],
  sfx_drop_default_02: ['interface-sounds', 'drop_002.ogg'],
  sfx_drop_default_03: ['interface-sounds', 'drop_003.ogg'],
  sfx_reject_soft: ['interface-sounds', 'error_003.ogg'],
  sfx_open_default: ['interface-sounds', 'open_001.ogg'],
  sfx_close_default: ['interface-sounds', 'close_001.ogg'],
  sfx_toggle_default: ['interface-sounds', 'switch_002.ogg'],
  sfx_eat_default: ['interface-sounds', 'scratch_001.ogg'],
  sfx_drink_default: ['interface-sounds', 'glass_002.ogg'],
  sfx_spawn_default: ['interface-sounds', 'pluck_002.ogg'],
  sfx_use_default: ['interface-sounds', 'select_001.ogg'],
  sfx_store_default: ['interface-sounds', 'drop_004.ogg'],
  sfx_coin: ['digital-audio', 'highUp.ogg'],
  sfx_character_appear: ['interface-sounds', 'confirmation_001.ogg'],
  sfx_portal_whoosh: ['interface-sounds', 'maximize_003.ogg'],
  sfx_register_ching: ['digital-audio', 'powerUp2.ogg'],
};

function main() {
  const dir = path.join(PACK, 'assets', 'audio');
  fs.mkdirSync(dir, { recursive: true });
  const assetsFile = path.join(PACK, 'assets.json');
  const assets = JSON.parse(fs.readFileSync(assetsFile, 'utf8'));
  for (const [key, [pack, file]] of Object.entries(SFX)) {
    const input = path.join(VENDOR, pack, 'Audio', file);
    const out = path.join(dir, `${key}.m4a`);
    // Already converted files are kept: re-encoding would change their bytes for nothing.
    if (!fs.existsSync(out)) execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', input, '-t', '1.5', '-ac', '1', '-ar', '44100', '-af', 'loudnorm=I=-16:TP=-1.5', '-c:a', 'aac', '-b:a', '96k', out]);
    assets.audio[key] = { file: `assets/audio/${key}.m4a`, kind: 'sfx', placeholder: true, license: 'CC0', source: SOURCES[pack] };
  }
  assets.audio = Object.fromEntries(Object.entries(assets.audio).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(assetsFile, JSON.stringify(assets, null, 2) + '\n');
  console.log(`Converted ${Object.keys(SFX).length} sounds into content/core/assets/audio`);
}

main();
