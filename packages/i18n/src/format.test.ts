import { formatDateTime, formatPaise, formatCurrency, formatDate } from './format.js';

describe('formatting', () => {
  it('I18N-03.1 formats rupees with Indian grouping', () => {
    expect(formatCurrency(123456.5)).toBe('₹1,23,456.50');
  });

  it('I18N-03.1 formats dates per locale in India time', () => {
    const date = new Date('2026-10-18T20:00:00Z'); // 19 October in India
    expect(formatDate(date, 'en')).toBe('19 Oct 2026');
    expect(formatDate(date, 'or')).toContain('ଅକ୍ଟୋବର');
    expect(formatDate(date, 'hi')).toContain('अक्टू');
  });

  it('AV-04 formats a date and time in India time, and paise as rupees', () => {
    const time = new Date('2026-10-30T04:30:00Z'); // 10:00 in India
    expect(formatDateTime(time, 'en')).toMatch(/10:00/);
    expect(formatPaise(4_500_050)).toBe('₹45,000.50');
  });
});
