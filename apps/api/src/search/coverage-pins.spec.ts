import { listingKey, pinBand, summarisePins, type PinProviderRow } from './coverage-pins.js';

const row = (pin: string, providerId: string | null, itemCode = 'physio_assessment') => ({
  pin,
  district: 'Synthetic district',
  providerId,
  itemCode: providerId ? itemCode : null,
  durationMinutes: providerId ? 60 : null,
});

describe('pinBand', () => {
  it.each([
    [0, 'none'],
    [1, 'limited'],
    [2, 'limited'],
    [3, 'available'],
    [40, 'available'],
  ] as const)('%i providers is %s', (count, band) => {
    expect(pinBand(count)).toBe(band);
  });
});

describe('summarisePins (SD-04)', () => {
  const soon = new Date('2026-11-10T05:00:00.000Z');
  const later = new Date('2026-11-12T05:00:00.000Z');

  it('keeps a PIN nobody serves, with no providers and no time', () => {
    expect(summarisePins([row('751002', null)], new Map())).toEqual([
      {
        pin: '751002',
        district: 'Synthetic district',
        providers: 0,
        band: 'none',
        nextAvailable: null,
      },
    ]);
  });

  it('counts each provider once however many listings they have, and takes the soonest slot', () => {
    const rows: PinProviderRow[] = [
      row('751001', 'p1', 'a'),
      row('751001', 'p1', 'b'),
      row('751001', 'p2', 'a'),
    ];
    const earliest = new Map<string, Date | null>([
      [listingKey('p1', 'a'), later],
      [listingKey('p1', 'b'), soon],
      [listingKey('p2', 'a'), null],
    ]);
    expect(summarisePins(rows, earliest)).toMatchObject([
      { pin: '751001', providers: 2, band: 'limited', nextAvailable: soon.toISOString() },
    ]);
  });

  it('serves a PIN with no free slot as available but without a time', () => {
    const rows = ['p1', 'p2', 'p3'].map((id) => row('751003', id));
    expect(summarisePins(rows, new Map())).toMatchObject([
      { providers: 3, band: 'available', nextAvailable: null },
    ]);
  });

  it('names no provider in its output', () => {
    expect(JSON.stringify(summarisePins([row('751001', 'p-secret')], new Map()))).not.toContain(
      'p-secret',
    );
  });
});
