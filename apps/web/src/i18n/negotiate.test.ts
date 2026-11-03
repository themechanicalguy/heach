import { negotiateLocale } from './negotiate';

describe('negotiateLocale', () => {
  it('picks the first supported language and defaults to Odia', () => {
    expect(negotiateLocale('hi-IN,hi;q=0.9,en;q=0.8')).toBe('hi');
    expect(negotiateLocale('fr-FR, en-GB;q=0.5')).toBe('en');
    expect(negotiateLocale('fr')).toBe('or');
    expect(negotiateLocale(null)).toBe('or');
  });
});

it.each([
  ['en;q=0.5, or;q=1.0', 'or'],
  ['or;q=0.1, hi-IN;q=0.9, en;q=0.5', 'hi'],
  ['en;q=0, hi;q=0.5', 'hi'],
  ['hi;q=0.8, en;q=0.8', 'hi'],
  ['hi;q=2, en;q=0.5', 'en'],
  ['hi;q=invalid, en', 'en'],
  ['enough, hi', 'hi'],
])('negotiates %s as %s', (header, expected) => {
  expect(negotiateLocale(header)).toBe(expected);
});
