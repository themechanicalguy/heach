import { formatIcu, IcuSyntaxError } from './icu.js';

describe('formatIcu', () => {
  it('I18N-02.2 substitutes arguments and selects plural categories per locale', () => {
    const pattern = '{name} has {n, plural, =0 {nothing} one {# item} other {# items}}';
    expect(formatIcu(pattern, { name: 'A', n: 0 }, 'en')).toBe('A has nothing');
    expect(formatIcu(pattern, { name: 'A', n: 1 }, 'en')).toBe('A has 1 item');
    expect(formatIcu(pattern, { name: 'A', n: 1200 }, 'hi')).toBe('A has 1,200 items');
  });

  it('supports select and literal apostrophes', () => {
    expect(
      formatIcu("{r, select, patient {it''s you} other {someone}}", { r: 'patient' }, 'en'),
    ).toBe("it's you");
    expect(formatIcu('{r, select, patient {you} other {someone}}', { r: 'admin' }, 'en')).toBe(
      'someone',
    );
  });

  it('rejects malformed patterns', () => {
    expect(() => formatIcu('{n, plural, one {x}}', { n: 1 }, 'en')).toThrow(IcuSyntaxError);
    expect(() => formatIcu('{n, plural, other {x}', { n: 1 }, 'en')).toThrow(IcuSyntaxError);
    expect(() => formatIcu('a } b', {}, 'en')).toThrow(IcuSyntaxError);
    expect(() => formatIcu('{n, date}', { n: 1 }, 'en')).toThrow(IcuSyntaxError);
  });

  it('throws when a value is missing', () => {
    expect(() => formatIcu('Hi {name}', {}, 'en')).toThrow('Missing value for {name}');
  });
});
