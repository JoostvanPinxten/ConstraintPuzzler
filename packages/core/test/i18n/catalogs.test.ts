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
  catalogProblems,
  englishTranslate,
  formatMessage,
  interpolate,
  lookup,
  msg,
  placeholders,
  valueList,
  type Language,
  type MessageKey,
} from '../../src/i18n/message';

/** Sample parameters for a template: `count` as a number, the rest as text. */
function sampleParams(template: string, count: number): Record<string, string | number> {
  const params: Record<string, string | number> = { count };
  for (const name of placeholders(template)) if (name !== 'count') params[name] = `<${name}>`;
  return params;
}

describe('the message catalogs', () => {
  for (const { code } of LANGUAGES) {
    it(`${code}: is complete and uses only the supported syntax`, () => {
      expect(catalogProblems(CORE_RESOURCES[DEFAULT_LANGUAGE], CORE_RESOURCES[code])).toEqual([]);
    });
  }

  it('reports what is wrong with a translation', () => {
    const english = { a: '{{x}} a', b_one: 'one', b_other: '{{count}} b' };
    expect(
      catalogProblems(english, {
        a: '{{y}} {{ z }}',
        b_other: '{{count}}',
        c: 'x',
        'd e': '$t(a)',
      }),
    ).toEqual([
      "'a' has {{y}}, expected {{x}}",
      "unknown 'c'",
      "unknown 'd e'",
      "'a': only {{name}}, not {{ z }}",
      "'b' lacks the plural form 'one'",
      "'d e': keys are letters, digits, _ and .",
      "'d e': no $t() nesting",
    ]);
    expect(catalogProblems(english, {})).toEqual(["missing 'a'", "missing 'b'"]);
  });

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
