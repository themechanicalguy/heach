import { describe, expect, it } from 'vitest';
import { routeTemplate, withoutQueryOrFragment } from './telemetry-urls';

describe('URLs kept by telemetry (LM-03.1, LM-04.1, MV-11)', () => {
  it('drops the query string and the fragment, where a share token travels', () => {
    expect(withoutQueryOrFragment('https://h.example/or/shared#Ab3_synthetic-token-1234567')).toBe(
      'https://h.example/or/shared',
    );
    expect(withoutQueryOrFragment('/en/book?pin=751024#x')).toBe('/en/book');
  });

  it('turns a path into a route template without IDs or tokens', () => {
    expect(routeTemplate('/or/bookings/3f2b8c1e-0000-4000-8000-000000000001')).toBe(
      '/[locale]/bookings/[id]',
    );
    expect(routeTemplate('/en/shared/Ab3_synthetic-token-1234567')).toBe(
      '/[locale]/shared/[token]',
    );
    expect(routeTemplate('/hi/services/nursing_wound_dressing')).toBe(
      '/[locale]/services/nursing_wound_dressing',
    );
  });
});
