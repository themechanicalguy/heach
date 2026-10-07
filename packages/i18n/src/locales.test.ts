import { DEFAULT_LOCALE, isLocale, LOCALES } from './locales.js';

describe('locales', () => {
  it('launches with Odia, English and Hindi, Odia first by default', () => {
    expect(LOCALES).toEqual(['or', 'en', 'hi']);
    expect(DEFAULT_LOCALE).toBe('or');
  });

  it('recognises only supported locales', () => {
    expect(isLocale('hi')).toBe(true);
    expect(isLocale('fr')).toBe(false);
  });
});
