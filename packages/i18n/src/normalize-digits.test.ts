import { normalizeDigits } from './normalize-digits.js';

it.each([
  ['୦୧୨୩୪୫୬୭୮୯', '0123456789'],
  ['०१२३४५६७८९', '0123456789'],
  ['+୯୧ ९୮7६୫4३୨1०', '+91 9876543210'],
  ['PIN: ୭५1୦०1', 'PIN: 751001'],
  ['', ''],
  ['୬abc-१२.୩', '6abc-12.3'],
  ['Odia ଓଡ଼ିଆ, हिन्दी, 0123456789', 'Odia ଓଡ଼ିଆ, हिन्दी, 0123456789'],
])('normalizes %s as %s', (input, expected) => {
  expect(normalizeDigits(input)).toBe(expected);
  expect(normalizeDigits(normalizeDigits(input))).toBe(expected);
});
