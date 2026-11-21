// The catalogs: every language is complete, they only use the syntax the engine's English
// formatter supports, and that formatter gives the same text as i18next.
import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import {
  CORE_NAMESPACE,
  CORE_RESOURCES,
  DEFAULT_LANGUAGE,
  LANGUAGES,
  baseKey,
  englishTranslate,
  formatMessage,
  interpolate,
  lookup,
  msg,
  valueList,
  type Language,
  type MessageKey,
} from '../../src/i18n/message';

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

function placeholders(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((match) => match[1] as string).sort();
}

/** The base keys of a catalog with the placeholders of all their forms. */
function shape(catalog: Readonly<Record<string, string>>): Map<string, string[]> {
  const result = new Map<string, Set<string>>();
  for (const [key, template] of Object.entries(catalog)) {
    const names = result.get(baseKey(key)) ?? new Set<string>();
    for (const name of placeholders(template)) names.add(name);
    result.set(baseKey(key), names);
  }
  return new Map([...result].map(([key, names]) => [key, [...names].sort()]));
}

/** Sample parameters for a template: `count` as a number, the rest as text. */
function sampleParams(template: string, count: number): Record<string, string | number> {
  const params: Record<string, string | number> = { count };
  for (const name of placeholders(template)) if (name !== 'count') params[name] = `<${name}>`;
  return params;
}

describe('the message catalogs', () => {
  const english = shape(CORE_RESOURCES[DEFAULT_LANGUAGE]);

  for (const { code } of LANGUAGES) {
    const catalog = CORE_RESOURCES[code];

    it(`${code}: has every message, with the same placeholders`, () => {
      expect(shape(catalog)).toEqual(english);
    });

    it(`${code}: has every plural form the language needs`, () => {
      const forms = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
      for (const key of Object.keys(catalog)) {
        if (baseKey(key) === key) continue;
        for (const form of forms) {
          // English and Dutch need only "one" and "other"; "zero" etc. are optional extras
          if (form === 'one' || form === 'other') {
            expect(catalog, `${code}: ${baseKey(key)}_${form}`).toHaveProperty(
              `${baseKey(key)}_${form}`,
            );
          }
        }
      }
    });

    it(`${code}: uses only {{param}} placeholders and plural keys`, () => {
      for (const [key, template] of Object.entries(catalog)) {
        expect(template, key).not.toContain('$t(');
        const braces = template.match(/\{\{[^}]*\}\}/g) ?? [];
        for (const brace of braces) expect(brace, key).toMatch(/^\{\{\w+\}\}$/);
        expect(key, key).toMatch(/^[\w.]+$/);
      }
    });
  }

  it('the English formatter gives the same text as i18next', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({
      lng: 'en',
      resources: { en: { [CORE_NAMESPACE]: CORE_RESOURCES.en } },
      keySeparator: false,
      nsSeparator: false,
      interpolation: { escapeValue: false },
    });
    for (const [key, template] of Object.entries(CORE_RESOURCES.en)) {
      for (const count of [0, 1, 2]) {
        const params = sampleParams(template, count);
        const base = baseKey(key) as MessageKey;
        expect(englishTranslate(base, params), key).toBe(
          i18n.t(base, { ns: CORE_NAMESPACE, replace: params, count }),
        );
      }
    }
  });
});

describe('lookup and interpolate', () => {
  const catalog = {
    plain: 'Row {{index}} of {{size}}',
    cells_one: '{{count}} cell in {{group}}',
    cells_other: '{{count}} cells in {{group}}',
    fallback: '{{count}} things',
  };

  for (const language of ['en', 'nl']) {
    it(`match i18next for placeholders and plurals (${language})`, async () => {
      const i18n = i18next.createInstance();
      await i18n.init({
        lng: language,
        resources: { [language]: { test: catalog } },
        keySeparator: false,
        nsSeparator: false,
        interpolation: { escapeValue: false },
      });
      for (const key of ['plain', 'cells', 'fallback']) {
        for (const count of [0, 1, 2, 5]) {
          const params = { count, index: 3, size: 9, group: 'Box 2' };
          const template = lookup(catalog, language, key, params);
          expect(interpolate(template ?? '', params), `${key} ${count}`).toBe(
            i18n.t(key, { ns: 'test', replace: params, count }),
          );
        }
      }
    });
  }

  it('rejects a missing parameter', () => {
    expect(() => interpolate('Row {{index}}', {})).toThrow("missing parameter 'index'");
  });
});

describe('formatMessage', () => {
  it('formats value lists, sorted, or as "none"', () => {
    expect(formatMessage(msg('values.none'))).toBe('none');
    expect(valueList([3, 1, 2])).toEqual({ values: [1, 2, 3] });
  });

  it('formats in another language with its translate function', () => {
    const dutch = (key: MessageKey) => CORE_RESOURCES.nl[key] ?? key;
    expect(formatMessage(msg('values.none'), dutch)).toBe('geen');
  });

  it('rejects unknown keys and missing parameters', () => {
    expect(() => englishTranslate('nope' as MessageKey, {})).toThrow("unknown message 'nope'");
  });

  it('lists every language once', () => {
    const codes: Language[] = LANGUAGES.map((language) => language.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain(DEFAULT_LANGUAGE);
  });
});
