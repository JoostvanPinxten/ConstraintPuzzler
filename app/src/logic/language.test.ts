import { isLanguage, resolveLanguage } from './language';

describe('resolveLanguage', () => {
  it('uses the chosen language', () => {
    expect(resolveLanguage('nl', ['en-US'])).toBe('nl');
  });

  it('uses the first device language the app has', () => {
    expect(resolveLanguage('system', ['fr-FR', 'nl-BE', 'en-GB'])).toBe('nl');
    expect(resolveLanguage('system', [null, 'EN'])).toBe('en');
  });

  it('falls back to English', () => {
    expect(resolveLanguage('system', ['fr-FR'])).toBe('en');
    expect(resolveLanguage('system', [])).toBe('en');
  });
});

describe('isLanguage', () => {
  it('knows the languages of the app', () => {
    expect(isLanguage('nl')).toBe(true);
    expect(isLanguage('fr')).toBe(false);
    expect(isLanguage(null)).toBe(false);
  });
});
