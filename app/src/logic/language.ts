// Which language to show: the one chosen in the settings, or the device's.
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '@constraintpuzzler/core';

/** The language setting: a language, or "system" for the device's language. */
export type LanguageSetting = 'system' | Language;

export function isLanguage(code: string | null | undefined): code is Language {
  return LANGUAGES.some((language) => language.code === code);
}

/**
 * The language to show: the chosen one, else the first of the device's languages (most
 * preferred first, e.g. "nl" or "nl-BE") that the app has, else English.
 */
export function resolveLanguage(
  setting: LanguageSetting,
  deviceLanguages: readonly (string | null)[],
): Language {
  if (setting !== 'system') return setting;
  for (const tag of deviceLanguages) {
    const code = tag?.split('-')[0]?.toLowerCase();
    if (isLanguage(code)) return code;
  }
  return DEFAULT_LANGUAGE;
}
