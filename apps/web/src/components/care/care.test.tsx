import { CATALOGUES } from '@heach/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProviderProfile, SearchResult } from '@heach/types';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { translatorFor } from '../../i18n/messages';
import type * as ApiModule from '../../lib/api';
import { I18nProvider } from '../../lib/i18n-context';
import { ProviderProfileView } from './ProviderProfileView';
import { SearchView } from './SearchView';
import { ServiceTiles } from './ServiceTiles';

const state = vi.hoisted(() => ({ api: vi.fn(), replace: vi.fn(), params: new URLSearchParams() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: state.replace }),
  useSearchParams: () => state.params,
}));
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

const result: SearchResult = {
  providerId: '00000000-0000-4000-8000-000000000011',
  listingId: '00000000-0000-4000-8000-000000000012',
  name: 'Synthetic Nurse',
  role: 'nurse',
  gender: 'female',
  languages: ['or'],
  itemCode: 'nursing_wound_dressing',
  itemName: 'Wound cleaning and dressing',
  kind: 'visit',
  prescriptionRequired: false,
  feePaise: 45_000,
  travelSurchargePaise: 5_000,
  durationMinutes: 45,
  earliestSlot: '2026-10-30T04:30:00.000Z',
  rating: null,
  ratingCount: 0,
};

/** Answers by path, as the API would. */
function route(responses: Record<string, unknown>) {
  state.api.mockImplementation((path: string) => {
    const key = Object.keys(responses).find((prefix) => path.startsWith(prefix));
    return key ? Promise.resolve(responses[key]) : Promise.reject(new Error(`unexpected ${path}`));
  });
}

beforeEach(() => {
  state.api.mockReset();
  state.replace.mockReset();
  state.params = new URLSearchParams();
});

describe('Home tiles (SD-01)', () => {
  it('SD-01 shows the four services as links', () => {
    const { t } = translatorFor('en');
    render(<ServiceTiles locale="en" t={t} />);
    expect(screen.getByRole('link', { name: /Nursing at home/ }).getAttribute('href')).toBe(
      '/en/services/nursing',
    );
    expect(screen.getAllByRole('link')).toHaveLength(4);
  });
});

describe('SearchView (SD-02 to SD-04)', () => {
  it('SD-04 asks for a valid PIN code, then searches and shows the results', async () => {
    route({
      '/catalogue': [{ code: 'nursing_wound_dressing', name: 'Wound cleaning and dressing' }],
      '/search': [result],
    });
    inEnglish(<SearchView service="nursing" />);
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('Enter a 6-digit PIN code.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your PIN code'), { target: { value: '751001' } });
    fireEvent.change(await screen.findByLabelText('Speaks'), { target: { value: 'or' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('Synthetic Nurse')).toBeTruthy();
    expect(screen.getByText('1 provider found')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View and book' }).getAttribute('href')).toContain(
      '/en/providers/',
    );
    expect(state.replace).toHaveBeenCalledWith('/en/services/nursing?pin=751001&language=or');
    expect(String(state.api.mock.calls.at(-1)?.[0])).toContain('language=or');
  });

  it('SD-04 searches at once from a shared URL and says when nobody serves the PIN', async () => {
    state.params = new URLSearchParams('pin=753001');
    route({ '/catalogue': [], '/search': [] });
    inEnglish(<SearchView service="lab" />);
    expect(await screen.findByText(/No verified provider visits this PIN code/)).toBeTruthy();
  });

  it('SD-02 searches by provider or service name from the URL', async () => {
    state.params = new URLSearchParams('pin=751001&q=Synthetic');
    route({ '/catalogue': [], '/search': [] });
    inEnglish(<SearchView service="nursing" />);
    await screen.findByText(/No verified provider visits this PIN code/);
    expect(
      (state.api.mock.calls as [string][]).some(([path]) => path.includes('q=Synthetic')),
    ).toBe(true);
    const box = screen.getByLabelText(CATALOGUES.en.search.text);
    expect(box).toHaveProperty('value', 'Synthetic');
    fireEvent.change(box, { target: { value: 'Physio' } });
    fireEvent.click(screen.getByRole('button', { name: CATALOGUES.en.search.find }));
    await waitFor(() => {
      expect((state.api.mock.calls as [string][]).some(([path]) => path.includes('q=Physio'))).toBe(
        true,
      );
    });
  });

  it('UX-04 shows an error with retry when search fails', async () => {
    state.params = new URLSearchParams('pin=751001');
    state.api.mockImplementation((path: string) =>
      path.startsWith('/search') ? Promise.reject(new TypeError('offline')) : Promise.resolve([]),
    );
    inEnglish(<SearchView service="physiotherapy" />);
    expect(
      await screen.findByText('No connection. Check your internet and try again.'),
    ).toBeTruthy();
  });
});

describe('ProviderProfileView (PO-05, AV-02)', () => {
  const profile: ProviderProfile = {
    id: result.providerId,
    name: 'Synthetic Nurse',
    role: 'nurse',
    gender: 'female',
    languages: ['or', 'en'],
    identityVerified: true,
    registrationNumber: 'SYN-1',
    listings: [
      {
        listingId: 'l-1',
        itemCode: 'nursing_injection',
        itemName: 'Injection',
        kind: 'visit',
        prescriptionRequired: true,
        feePaise: 30_000,
        durationMinutes: 30,
        preparation: null,
      },
      {
        listingId: result.listingId,
        itemCode: 'nursing_wound_dressing',
        itemName: 'Wound care',
        kind: 'visit',
        prescriptionRequired: false,
        feePaise: 45_000,
        durationMinutes: 45,
        preparation: 'Keep the area dry.',
      },
    ],
    pins: ['751001'],
    travelSurchargePaise: 0,
    rating: 4.5,
    ratingCount: 2,
  };

  it('PO-05 shows badges, services, and links each free time to booking', async () => {
    state.params = new URLSearchParams(`listing=${result.listingId}`);
    state.api.mockImplementation((path: string) => {
      if (path.includes('/slots?listing=l-1')) return Promise.resolve({ slots: [] });
      if (path.includes('/slots')) return Promise.resolve({ slots: ['2026-10-30T04:30:00.000Z'] });
      return Promise.resolve(profile);
    });
    inEnglish(<ProviderProfileView providerId={profile.id} />);
    expect(await screen.findByText('Verified identity')).toBeTruthy();
    expect(screen.getByText('Registration number: SYN-1')).toBeTruthy();
    expect(screen.getByText("Needs a doctor's prescription")).toBeTruthy();
    expect(screen.getByText('Rated 4.5 by 2 patients')).toBeTruthy();
    expect(screen.getByText('Preparation: Keep the area dry.')).toBeTruthy();
    const book = await screen.findByRole('link', { name: /^Book/ });
    expect(book.getAttribute('href')).toBe(
      `/en/book/${result.listingId}?provider=${profile.id}&start=${encodeURIComponent('2026-10-30T04:30:00.000Z')}`,
    );
    await waitFor(() => {
      expect(screen.getByText('No free time in the next 7 days.')).toBeTruthy();
    });
  });
});
