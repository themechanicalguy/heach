import type { PinCoverage } from '@heach/types';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceablePins } from './ServiceablePins';

const state = vi.hoisted(() => ({ setSearch: vi.fn<(value: unknown) => void>() }));
vi.mock('../../lib/care-search', () => ({
  useCareSearch: () => ({
    search: { pin: '', q: 'knee', service: 'physiotherapy' },
    setSearch: state.setSearch,
  }),
}));

const pins: PinCoverage[] = [
  {
    pin: '751001',
    district: 'Khordha',
    providers: 12,
    band: 'available',
    nextAvailable: '2026-11-10T05:00:00.000Z',
  },
  { pin: '751002', district: 'Khordha', providers: 2, band: 'limited', nextAvailable: null },
  { pin: '751003', district: 'Cuttack', providers: 0, band: 'none', nextAvailable: null },
];

afterEach(() => {
  cleanup();
  state.setSearch.mockClear();
});

describe('Serviceable PINs (SD-04)', () => {
  it('lists each PIN with its district, availability and next free time', () => {
    render(<ServiceablePins locale="en" service="physiotherapy" pins={pins} accounts />);
    const row = (pin: string) => within(screen.getByRole('row', { name: new RegExp(pin) }));
    expect(row('751001').getByText('751001')).toBeTruthy();
    expect(row('751001').getByText(/Available/)).toBeTruthy();
    expect(row('751001').getByText(/12 providers/)).toBeTruthy();
    expect(row('751001').getByText(/Tue, 10 Nov/)).toBeTruthy();
    expect(row('751002').getByText('None in the next 7 days')).toBeTruthy();
    expect(screen.queryByRole('row', { name: /751003/ })).toBeNull();
  });

  it('folds PINs nobody serves yet into a list, and puts the served ones first', () => {
    render(
      <ServiceablePins locale="en" service="physiotherapy" pins={[...pins].reverse()} accounts />,
    );
    expect(screen.getByText('1 PIN code is not served yet')).toBeTruthy();
    expect(screen.getByText('751003')).toBeTruthy();
    const order = screen
      .getAllByRole('row')
      .slice(1)
      .map((entry) => entry.textContent);
    expect(order[0]).toContain('751001');
    expect(order[1]).toContain('751002');
  });

  it('says so when no PIN is served yet', () => {
    const none = pins.map((pin) => ({ ...pin, providers: 0, band: 'none' as const }));
    render(<ServiceablePins locale="en" service="physiotherapy" pins={none} accounts />);
    expect(screen.getByText('No PIN code can book this service yet.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('offers a search action on each served PIN, and fills the form with it', () => {
    render(<ServiceablePins locale="en" service="physiotherapy" pins={pins} accounts />);
    expect(screen.getAllByRole('link', { name: /Use PIN/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole('link', { name: 'Use PIN 751002 in the search form' }));
    expect(state.setSearch).toHaveBeenCalledWith({
      pin: '751002',
      q: 'knee',
      service: 'physiotherapy',
    });
  });

  it('has no search action when the search form is not on the page', () => {
    render(<ServiceablePins locale="en" service="physiotherapy" pins={pins} accounts={false} />);
    expect(screen.queryByRole('link', { name: /Use PIN/ })).toBeNull();
  });
});
