import { maskName } from './masking.js';

describe('Masked names in admin lists (AD-01)', () => {
  it('AD-01 keeps only the first letter of each word', () => {
    expect(maskName('Synthetic Patient')).toBe('S•••••••• P••••••');
    expect(maskName('  A  ')).toBe('A•');
    expect(maskName(null)).toBeNull();
  });

  it('I18N-04 masks Odia and Devanagari names by letter, keeping vowel signs whole', () => {
    expect(maskName('ସୀତା')).toBe('ସୀ•');
    expect(maskName('राम')).toBe('रा•');
  });
});
