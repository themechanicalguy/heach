import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../../lib/api';
import { expectNoAxeViolations } from '../../../../../packages/ui/src/test/axe';
import { shellMessages } from '../../lib/client-messages';
import { I18nProvider } from '../../lib/i18n-context';
import { LocationProvider } from '../../lib/location';
import { LocationBanner } from './LocationBanner';
import { LocationDialog } from './LocationDialog';

interface Search {
  pin: string;
  q: string;
  service: 'physiotherapy' | 'nursing';
}
const store = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const snapshot = {
    current: { search: { pin: '', q: '', service: 'physiotherapy' }, ready: true } as {
      search: Search;
      ready: boolean;
    },
  };
  return {
    snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get: () => snapshot.current,
    set: (next: { search: Search; ready: boolean }) => {
      snapshot.current = next;
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
});
interface AccountState {
  state: string;
  me?: { activeRole: string };
}
const env = vi.hoisted(() => {
  const account: AccountState = { state: 'idle' };
  return { api: vi.fn(), pathname: '/en', account };
});

vi.mock('next/navigation', () => ({ usePathname: () => env.pathname }));
vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof ApiModule>()),
  api: env.api,
}));
vi.mock('../../lib/account', () => ({ useAccount: () => ({ account: env.account }) }));
vi.mock('../../lib/care-search', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useCareSearch: () => {
      const { search, ready } = useSyncExternalStore(store.subscribe, store.get);
      return {
        search,
        ready,
        person: '',
        setPerson: vi.fn(),
        setSearch: (next: Search) => {
          store.set({ search: next, ready: true });
        },
      };
    },
  };
});

const coverage = (services: string[]) => {
  env.api.mockResolvedValue({ served: services.length > 0, services });
};
const open = () =>
  render(
    <I18nProvider locale="en" messages={shellMessages('en')}>
      <LocationProvider>
        <LocationBanner />
        <LocationDialog />
      </LocationProvider>
    </I18nProvider>,
  );
const typePin = (pin: string) => {
  fireEvent.change(screen.getByLabelText('PIN code'), { target: { value: pin } });
};
const check = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Check my area', hidden: true }));
};

beforeEach(() => {
  store.snapshot.current = { search: { pin: '', q: '', service: 'physiotherapy' }, ready: true };
  env.api.mockReset();
  env.pathname = '/en';
  env.account = { state: 'idle' };
  sessionStorage.clear();
});
afterEach(cleanup);

describe('Where do you need care? (SD-04)', () => {
  it('asks once on a landing page when no PIN is known', () => {
    open();
    expect(screen.getByLabelText('PIN code')).toBeTruthy();
    expect(sessionStorage.getItem('heach:location-asked')).toBe('1');
  });

  it.each([
    ['a PIN is already known', () => (store.snapshot.current.search.pin = '751001')],
    [
      'it already asked in this visit',
      () => {
        sessionStorage.setItem('heach:location-asked', '1');
      },
    ],
    ['the saved PIN is still loading', () => (store.snapshot.current.ready = false)],
    ['the page is not a landing page', () => (env.pathname = '/en/pages/contact')],
    [
      'a provider is signed in',
      () => (env.account = { state: 'ready', me: { activeRole: 'nurse' } }),
    ],
  ])('does not ask when %s', (_reason, arrange) => {
    arrange();
    coverage(['physiotherapy']);
    open();
    expect(screen.queryByLabelText('PIN code')).toBeNull();
  });

  it('says a served area is served, and Continue closes the question', async () => {
    coverage(['physiotherapy']);
    open();
    typePin('751001');
    check();
    expect(await screen.findByText(/We visit 751001 for Physiotherapy at home/)).toBeTruthy();
    expect(env.api).toHaveBeenCalledWith('/coverage', {
      method: 'POST',
      body: JSON.stringify({ pin: '751001' }),
    });
    expect(screen.queryByRole('region', { name: 'Service area' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue', hidden: true }));
    await waitFor(() => {
      expect(screen.queryByLabelText('PIN code')).toBeNull();
    });
  });
});

describe('The not-served banner (SD-04)', () => {
  it('keeps a banner with both ways out when the area is not served, without blocking', async () => {
    coverage(['nursing']);
    open();
    typePin('751001');
    check();
    expect(
      await screen.findByText(/We do not offer Physiotherapy at home at 751001 yet/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue anyway', hidden: true }));
    const banner = await screen.findByRole('region', { name: 'Service area' });
    expect(banner.textContent).toContain(
      'Physiotherapy at home is not available at PIN code 751001.',
    );
    expect(
      screen.getAllByRole('link', { name: 'Contact help desk', hidden: true })[0],
    ).toHaveProperty('pathname', '/en/pages/contact');
    fireEvent.click(screen.getByRole('button', { name: 'Update location' }));
    expect((await screen.findByLabelText<HTMLInputElement>('PIN code')).value).toBe('751001');
  });

  it('checks the service of the page, not only the one last chosen', async () => {
    store.snapshot.current.search.pin = '751001';
    env.pathname = '/en/services/nursing';
    coverage(['physiotherapy']);
    open();
    const banner = await screen.findByRole('region', { name: 'Service area' });
    expect(banner.textContent).toContain('Nursing at home is not available at PIN code 751001.');
  });

  it('keeps the banner off pages that are not about finding care', async () => {
    store.snapshot.current.search.pin = '751001';
    env.pathname = '/en/pages/contact';
    coverage([]);
    open();
    await waitFor(() => {
      expect(env.api).toHaveBeenCalled();
    });
    expect(screen.queryByRole('region', { name: 'Service area' })).toBeNull();
  });

  it('rejects a malformed PIN without asking the server', () => {
    open();
    typePin('75100');
    check();
    expect(screen.getByText('Enter a 6-digit PIN code. It cannot start with 0.')).toBeTruthy();
    expect(env.api).not.toHaveBeenCalled();
  });

  it('says so when the check fails, and the banner does not claim the area is unserved', async () => {
    env.api.mockRejectedValue(new Error('offline'));
    open();
    typePin('751001');
    check();
    expect(await screen.findByText(/We could not check this area/)).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Service area' })).toBeNull();
  });

  it('UX-01.2 has no axe violations for the question, its answer and the banner', async () => {
    coverage(['nursing']);
    const { container } = open();
    typePin('751001');
    check();
    await screen.findByText(/We do not offer/);
    await expectNoAxeViolations(container);
  });
});
