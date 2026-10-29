import { CATALOGUES } from '@heach/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Availability, ProviderListings } from '@heach/types';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../../lib/api';
import { I18nProvider } from '../../lib/i18n-context';
import { ProviderServicesView } from './ProviderServicesView';

const state = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof ApiModule>()),
  api: state.api,
}));

const inEnglish = (node: ReactNode) =>
  render(
    <I18nProvider locale="en" messages={CATALOGUES.en}>
      {node}
    </I18nProvider>,
  );

const listings: ProviderListings = {
  role: 'attendant',
  items: [
    {
      code: 'attendant_day_12h',
      name: 'Attendant, 12-hour day shift',
      kind: 'shift',
      prescriptionRequired: false,
      defaultDurationMinutes: 720,
      listing: null,
    },
  ],
  pins: ['751001'],
  travelSurchargePaise: 5_000,
  serviceablePins: [
    { pin: '751001', district: 'Khordha', serviceable: true },
    { pin: '753001', district: 'Cuttack', serviceable: true },
  ],
};
const availability: Availability = {
  rules: [{ weekday: 1, startMinute: 540, endMinute: 1080 }],
  bufferMinutes: 15,
  blocks: [{ id: 'b-1', start: '2026-11-01T18:30:00.000Z', end: '2026-11-02T18:30:00.000Z' }],
};

function bodyOf(path: string): unknown {
  const calls = state.api.mock.calls as [string, RequestInit | undefined][];
  const body = calls.find(([called, init]) => called === path && init?.body)?.[1]?.body;
  return typeof body === 'string' ? JSON.parse(body) : undefined;
}

beforeEach(() => {
  state.api.mockReset();
  state.api.mockImplementation((path: string, init?: RequestInit) => {
    if (path === '/provider/listings') return Promise.resolve(listings);
    if (path.startsWith('/provider/availability') && !init?.method)
      return Promise.resolve(availability);
    if (path.startsWith('/provider/listings/') || path === '/provider/service-area')
      return Promise.resolve(listings);
    return Promise.resolve(init?.method === 'PUT' ? availability : undefined);
  });
});

describe('ProviderServicesView (SL-02 to SL-07, AV-01, AV-03)', () => {
  it('SL-04 saves an attendant shift with its fee and care settings', async () => {
    inEnglish(<ProviderServicesView />);
    fireEvent.change(await screen.findByLabelText('Fee (₹)'), { target: { value: '900' } });
    fireEvent.click(screen.getByLabelText('In hospital'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(bodyOf('/provider/listings/attendant_day_12h')).toEqual({
        feePaise: 90_000,
        durationMinutes: 720,
        active: true,
        careSettings: ['home', 'hospital'],
        homeCollection: true,
      });
    });
  });

  it('SL-05 saves the PIN codes and travel charge', async () => {
    inEnglish(<ProviderServicesView />);
    fireEvent.click(await screen.findByLabelText('753001 · Cuttack'));
    fireEvent.click(screen.getByRole('button', { name: 'Save area' }));
    await waitFor(() => {
      expect(bodyOf('/provider/service-area')).toEqual({
        pins: ['751001', '753001'],
        travelSurchargePaise: 5_000,
      });
    });
  });

  it('AV-01 saves weekly hours and buffer, adds and removes leave', async () => {
    inEnglish(<ProviderServicesView />);
    const sundayOpen = (await screen.findAllByLabelText('Offered')).at(1);
    if (!sundayOpen) throw new Error('No day rows');
    fireEvent.click(sundayOpen);
    fireEvent.click(screen.getByRole('button', { name: 'Save hours' }));
    await waitFor(() => {
      expect(bodyOf('/provider/availability')).toMatchObject({ bufferMinutes: 15 });
    });
    fireEvent.change(screen.getByLabelText('First day'), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByLabelText('Last day'), { target: { value: '2026-12-02' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add leave' }));
    await waitFor(() => {
      expect(bodyOf('/provider/availability/blocks')).toEqual({
        start: '2026-11-30T18:30:00.000Z',
        end: '2026-12-02T18:30:00.000Z',
      });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => {
      expect(state.api).toHaveBeenCalledWith('/provider/availability/blocks/b-1', {
        method: 'DELETE',
      });
    });
  });

  it('SL-07 tells a provider who is not approved yet', async () => {
    const { ApiError } = await import('../../lib/api');
    state.api.mockRejectedValue(new ApiError(403, 'provider_not_approved'));
    inEnglish(<ProviderServicesView />);
    expect(
      await screen.findByText('You can set up your services once your application is approved.'),
    ).toBeTruthy();
  });
});
