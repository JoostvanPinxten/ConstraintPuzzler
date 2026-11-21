// The app's catalogs: every language is complete and uses only the supported syntax.
import {
  CORE_RESOURCES,
  DEFAULT_LANGUAGE,
  LANGUAGES,
  catalogProblems,
} from '@constraintpuzzler/core';

import { APP_RESOURCES, currentLanguage, formatCore, i18n } from '.';

describe('the app catalogs', () => {
  it.each(LANGUAGES.map((language) => language.code))('%s is complete', (code) => {
    expect(catalogProblems(APP_RESOURCES[DEFAULT_LANGUAGE], APP_RESOURCES[code])).toEqual([]);
  });

  it('keeps the app keys apart from the engine keys', () => {
    const engine = new Set(Object.keys(CORE_RESOURCES.en));
    expect(Object.keys(APP_RESOURCES.en).filter((key) => engine.has(key))).toEqual([]);
  });
});

describe('the i18next instance', () => {
  afterEach(async () => {
    await i18n.changeLanguage(DEFAULT_LANGUAGE);
  });

  it('formats app texts and engine messages in the current language', async () => {
    expect(currentLanguage()).toBe('en');
    expect(i18n.t('screen.progressValue', { filled: 3, total: 81 })).toBe('3 of 81');
    expect(formatCore({ key: 'values.none' })).toBe('none');
    await i18n.changeLanguage('nl');
    expect(currentLanguage()).toBe('nl');
    expect(i18n.t('screen.progressValue', { filled: 3, total: 81 })).toBe('3 van 81');
    expect(formatCore({ key: 'values.none' })).toBe('geen');
  });

  it('chooses plural forms', async () => {
    expect(i18n.t('placements.excludes', { count: 1 })).toMatch(/^it does not/);
    expect(i18n.t('placements.excludes', { count: 4 })).toMatch(/^none gives/);
    await i18n.changeLanguage('nl');
    expect(i18n.t('placements.excludes', { count: 4 })).toMatch(/^geen enkele/);
  });
});
