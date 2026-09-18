import type { LocaleId } from './schemas';

/**
 * Default language (UI_UX_GUIDELINES §5): Spanish when the device is in any Spanish variant, English
 * otherwise. Pure: HU-GAME-075 passes the tag from expo-localization; until then callers pass undefined.
 */
export function defaultLocale(deviceLanguageTag: string | undefined): LocaleId {
  if (!deviceLanguageTag) return 'es';
  return deviceLanguageTag.toLowerCase().startsWith('es') ? 'es' : 'en';
}
