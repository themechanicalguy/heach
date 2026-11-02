import { searchPatterns } from './search-patterns.js';

function matches(term: string, query: string) {
  return searchPatterns(query)?.some((pattern) =>
    new RegExp(`^${pattern.replaceAll('%', '.*').replaceAll('_', '.')}$`, 'u').test(term),
  );
}

describe('SD-02 spelling tolerance', () => {
  it.each([
    ['physiotherapy', 'physiotherpy'],
    ['nursing', 'nursxng'],
    ['attendant', 'atttendant'],
    ['ଫିଜିଓଥେରାପି', 'ଫିଜିଓଥେରପି'],
    ['फिजियोथेरेपी', 'फिजियोथेरेपि'],
  ])('finds %s from %s', (term, query) => {
    expect(matches(term, query)).toBe(true);
  });
  it('bounds wildcard expansion and does not broaden short searches', () => {
    expect(searchPatterns('ab')).toEqual(['%ab%']);
    expect(searchPatterns('a'.repeat(60))?.length).toBeLessThanOrEqual(182);
    expect(searchPatterns(undefined)).toBeNull();
    expect(searchPatterns('%_\\abc')).toEqual(['%abc%']);
  });
});
