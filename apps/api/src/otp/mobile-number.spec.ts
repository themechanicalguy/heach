import { maskMobile, normaliseIndianMobile } from './mobile-number.js';

describe('Indian mobile numbers (L-6)', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['091-9876543210', undefined],
    ['09876543210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['(+91) 98765-43210', '+919876543210'],
  ])('SE-08 normalises %s', (input, expected) => {
    expect(normaliseIndianMobile(input)).toBe(expected);
  });

  it.each(['5876543210', '987654321', '98765432101', '+4479460000', 'abc', '', '+91 0000000000'])(
    'SE-08 refuses %s',
    (input) => {
      expect(normaliseIndianMobile(input)).toBeUndefined();
    },
  );

  it('LM-02 masks all but the last four digits', () => {
    expect(maskMobile('+919876543210')).toBe('••••••3210');
  });
});
