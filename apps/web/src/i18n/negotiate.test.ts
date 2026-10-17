import { negotiateLocale } from './negotiate';

describe('negotiateLocale', () => {
  it('picks the first supported language and defaults to Odia', () => {
    expect(negotiateLocale('hi-IN,hi;q=0.9,en;q=0.8')).toBe('hi');
    expect(negotiateLocale('fr-FR, en-GB;q=0.5')).toBe('en');
    expect(negotiateLocale('fr')).toBe('or');
    expect(negotiateLocale(null)).toBe('or');
  });
});
