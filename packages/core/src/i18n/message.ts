/**
 * Messages for players: the engine describes what it did as a `Message` (a catalog key plus
 * parameters) instead of an English sentence, so the app can show it in the player's language.
 *
 * The texts live in JSON catalogs (`locales/<language>/*.json`) in the i18next format, which the
 * app reads with i18next. The engine itself has no dependencies, so it formats English with the
 * small formatter below, which supports only a subset of the i18next syntax: `{{param}}`
 * placeholders and plural keys (`key_one`, `key_other`, chosen by the `count` parameter). A test
 * checks that this formatter and i18next give the same text for every message.
 */
import enCore from './locales/en/core.json';
import nlCore from './locales/nl/core.json';

/** The languages the app can be shown in. */
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'nl', name: 'Nederlands' },
] as const;

export type Language = (typeof LANGUAGES)[number]['code'];

/** The language every text is written in first, and falls back to. */
export const DEFAULT_LANGUAGE: Language = 'en';

type Catalog = Readonly<Record<string, string>>;

/** The catalogs of the engine per language, as i18next resources of the namespace `core`. */
export const CORE_RESOURCES: Readonly<Record<Language, Catalog>> = {
  en: enCore,
  nl: nlCore,
};

/** The i18next namespace of the engine's messages. */
export const CORE_NAMESPACE = 'core';

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

type BaseKey<K> = K extends `${infer Base}_${'zero' | 'one' | 'two' | 'few' | 'many' | 'other'}`
  ? Base
  : K;

/** A key of the engine's catalog (without the plural suffix). */
export type MessageKey = BaseKey<keyof typeof enCore>;

/** A list of values, shown in ascending order ("1, 3, 4"), or as "none" when empty. */
export interface ValueList {
  readonly values: readonly number[];
}

export type MessageParam = string | number | Message | ValueList;

export interface Message {
  readonly key: MessageKey;
  readonly params?: Readonly<Record<string, MessageParam>>;
}

/** A message; `count` (a number) selects the plural form. */
export function msg(key: MessageKey, params?: Readonly<Record<string, MessageParam>>): Message {
  return params === undefined ? { key } : { key, params };
}

/** A list of values as a message parameter. */
export function valueList(values: Iterable<number>): ValueList {
  return { values: [...values].sort((a, b) => a - b) };
}

export function isMessage(value: unknown): value is Message {
  return typeof value === 'object' && value !== null && 'key' in value;
}

/**
 * Looks up a key of the engine's catalog and fills in its (already formatted) parameters; the
 * app passes one built on i18next, the engine uses `englishTranslate`.
 */
export type Translate = (
  key: MessageKey,
  params: Readonly<Record<string, string | number>>,
) => string;

/** Formats a message (and the messages in its parameters) with a translate function. */
export function formatMessage(message: Message, translate: Translate = englishTranslate): string {
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(message.params ?? {})) {
    params[name] = formatParam(value, translate);
  }
  return translate(message.key, params);
}

function formatParam(value: MessageParam, translate: Translate): string | number {
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (isMessage(value)) return formatMessage(value, translate);
  return value.values.length > 0 ? value.values.join(', ') : translate('values.none', {});
}

/** Fills in `{{param}}` placeholders; a missing parameter is an error in the catalog. */
export function interpolate(
  template: string,
  params: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`missing parameter '${name}' in '${template}'`);
    return String(value);
  });
}

/** Looks up a key in a catalog, choosing the plural form for `count` as i18next does. */
export function lookup(
  catalog: Catalog,
  language: string,
  key: string,
  params: Readonly<Record<string, string | number>>,
): string | undefined {
  const count = params['count'];
  if (typeof count === 'number') {
    const form = catalog[`${key}_${new Intl.PluralRules(language).select(count)}`];
    if (form !== undefined) return form;
  }
  return catalog[key];
}

/** Formats a key of the engine's catalog in English. */
export const englishTranslate: Translate = (key, params) => {
  const template = lookup(CORE_RESOURCES.en, 'en', key, params);
  if (template === undefined) throw new Error(`unknown message '${key}'`);
  return interpolate(template, params);
};

/** The key without its plural suffix (`foo_one` → `foo`). */
export function baseKey(key: string): string {
  return key.replace(PLURAL_SUFFIX, '');
}
