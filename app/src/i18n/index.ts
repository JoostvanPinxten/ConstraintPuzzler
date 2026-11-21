// The texts of the app in every language: an i18next instance with the app's catalogs
// (namespace `app`) and the engine's (namespace `core`). Components use `useTranslation()`, so
// they render again when the language changes; plain modules in logic/ use `i18n.t`.
import {
  CORE_NAMESPACE,
  CORE_RESOURCES,
  DEFAULT_LANGUAGE,
  LANGUAGES,
  formatMessage,
  type Language,
  type Message,
} from '@constraintpuzzler/core';
import { getLocales } from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en/app.json';
import nl from './locales/nl/app.json';
import { resolveLanguage } from '../logic/language';

export const APP_NAMESPACE = 'app';

type BaseKey<K> = K extends `${infer Base}_${'zero' | 'one' | 'two' | 'few' | 'many' | 'other'}`
  ? Base
  : K;

/** A key of the app's catalog (without the plural suffix). */
export type AppKey = BaseKey<keyof typeof en>;

/** The app's catalogs per language. */
export const APP_RESOURCES: Readonly<Record<Language, Readonly<Record<string, string>>>> = {
  en,
  nl,
};

export const i18n = i18next.createInstance();

void i18n.use(initReactI18next).init({
  // the device's language, until the settings (read asynchronously) say otherwise
  lng: resolveLanguage(
    'system',
    getLocales().map((locale) => locale.languageTag),
  ),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES.map((language) => language.code),
  resources: Object.fromEntries(
    LANGUAGES.map(({ code }) => [
      code,
      { [APP_NAMESPACE]: APP_RESOURCES[code], [CORE_NAMESPACE]: CORE_RESOURCES[code] },
    ]),
  ),
  ns: [APP_NAMESPACE, CORE_NAMESPACE],
  defaultNS: APP_NAMESPACE,
  // keys are flat, with dots in them ("toolbar.undo")
  keySeparator: false,
  nsSeparator: false,
  // React escapes text itself
  interpolation: { escapeValue: false },
  // the resources are bundled: initialise synchronously, so the first render has its texts
  initAsync: false,
  returnNull: false,
});

/** The language the app is shown in now. */
export function currentLanguage(): Language {
  const language = i18n.language;
  return LANGUAGES.some(({ code }) => code === language)
    ? (language as Language)
    : DEFAULT_LANGUAGE;
}

type CoreT = (key: string, options: object) => string;

/** An engine message in the current language. */
export function formatCore(message: Message): string {
  const t = i18n.t.bind(i18n) as unknown as CoreT;
  return formatMessage(message, (key, params) =>
    t(key, {
      ns: CORE_NAMESPACE,
      replace: params,
      ...(typeof params['count'] === 'number' ? { count: params['count'] } : {}),
    }),
  );
}
