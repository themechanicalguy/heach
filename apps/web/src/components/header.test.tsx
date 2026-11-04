import { CATALOGUES } from '@heach/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n-context';
import { HeaderAccount, SignOutButton } from './HeaderAccount';
import { HeaderCare } from './site/HeaderCare';
import { LanguageSwitch } from './LanguageSwitch';
import { ShellNav } from './ShellNav';

interface HeaderState {
  pathname: string;
  query: string;
  status: 'checking' | 'signed-in' | 'signed-out';
  account: { state: string; me?: { activeRole: string } };
}

const state = vi.hoisted(() => {
  const initial: HeaderState = {
    pathname: '',
    query: '',
    status: 'signed-out',
    account: { state: 'idle' },
  };
  return {
    ...initial,
    api: vi.fn(() => Promise.resolve()),
    signOut: vi.fn(() => Promise.resolve()),
    replace: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useSearchParams: () => new URLSearchParams(state.query),
  useRouter: () => ({ replace: state.replace }),
}));
vi.mock('../lib/session', () => ({
  useSession: () => ({ status: state.status, signOut: state.signOut }),
}));
vi.mock('../lib/account', () => ({ useAccount: () => ({ account: state.account }) }));
vi.mock('../lib/api', () => ({ api: state.api }));
vi.mock('../lib/care-search', () => ({
  useCareSearch: () => ({ person: '', setPerson: vi.fn() }),
}));
vi.mock('../lib/use-resource', () => ({
  useResource: () => ({ resource: { state: 'ready', data: [] }, reload: vi.fn() }),
}));

const inEnglish = (node: ReactNode) =>
  render(
    <I18nProvider locale="en" messages={CATALOGUES.en}>
      {node}
    </I18nProvider>,
  );

beforeEach(() => {
  state.pathname = '/en/account';
  state.query = '';
  state.status = 'signed-out';
  state.account = { state: 'idle' };
  state.api.mockClear();
  state.signOut.mockReset().mockResolvedValue(undefined);
  state.replace.mockClear();
});

describe('LanguageSwitch', () => {
  it('preserves repeated, empty and encoded query values when switching language', () => {
    state.pathname = '/en/shared/token';
    state.query = 'pin=123456&filter=a&filter=b&empty=&slot=a%2Bb';
    inEnglish(<LanguageSwitch />);
    fireEvent.click(screen.getByRole('button', { name: /English/ }));
    expect(screen.getByRole('link', { name: 'ଓଡ଼ିଆ' }).getAttribute('href')).toBe(
      `/or/shared/token?${state.query}`,
    );
  });

  it('AC-02 opens the three languages, each linking to the same page', () => {
    inEnglish(<LanguageSwitch />);
    const button = screen.getByRole('button', { name: /English/ });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/or/account',
      '/en/account',
      '/hi/account',
    ]);
    expect(screen.getByRole('link', { name: 'English' }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('link', { name: 'ଓଡ଼ିଆ' }).getAttribute('lang')).toBe('or');
  });

  it('closes on Escape with focus back on its button, and on a press outside', () => {
    inEnglish(<LanguageSwitch />);
    const button = screen.getByRole('button', { name: /English/ });
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    fireEvent.pointerDown(document.body);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('AC-02 keeps a new choice on a signed-in account only', () => {
    inEnglish(<LanguageSwitch />);
    fireEvent.click(screen.getByRole('button', { name: /English/ }));
    fireEvent.click(screen.getByRole('link', { name: 'हिन्दी' }));
    expect(state.api).not.toHaveBeenCalled();
    state.account = { state: 'ready' };
    fireEvent.click(screen.getByRole('button', { name: /English/ }));
    fireEvent.click(screen.getByRole('link', { name: 'हिन्दी' }));
    expect(state.api).toHaveBeenCalledWith(
      '/me/locale',
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});

describe('HeaderAccount', () => {
  it('offers sign-in or sign-up once the visitor is known to be signed out', () => {
    inEnglish(<HeaderAccount />);
    expect(screen.getByRole('link', { name: 'Sign in / Sign up' }).getAttribute('href')).toBe(
      '/en/sign-in',
    );
  });

  it.each([
    ['while the session is checked', 'checking', '/en'],
    ['on the sign-in page', 'signed-out', '/en/sign-in'],
    ['during setup', 'signed-out', '/en/setup/role'],
  ] as const)('shows nothing %s', (_, status, pathname) => {
    state.status = status;
    state.pathname = pathname;
    inEnglish(<HeaderAccount />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('reserves a non-interactive sign-in slot while checking the session', () => {
    state.status = 'checking';
    state.pathname = '/en';
    const { container } = inEnglish(<HeaderAccount />);
    const slot = container.querySelector('.header-sign-in');
    expect(slot?.getAttribute('aria-hidden')).toBe('true');
    expect(slot?.hasAttribute('href')).toBe(false);
    expect(slot?.textContent).toContain(CATALOGUES.en.nav.signIn);
  });

  it('shows nothing once signed in: signing out is in the account menu (G01)', () => {
    state.status = 'signed-in';
    const { container } = inEnglish(<HeaderAccount />);
    expect(container.childElementCount).toBe(0);
  });
});

describe('SignOutButton', () => {
  it('SE-07.10 signs this device out and goes home', async () => {
    state.status = 'signed-in';
    inEnglish(<SignOutButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => {
      expect(state.replace).toHaveBeenCalledWith('/en');
    });
    expect(state.signOut).toHaveBeenCalledTimes(1);
  });

  it('goes home even when the logout call fails, as the session has ended here', async () => {
    state.status = 'signed-in';
    state.signOut.mockRejectedValue(new Error('network'));
    inEnglish(<SignOutButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => {
      expect(state.replace).toHaveBeenCalledWith('/en');
    });
  });
});

describe('HeaderCare (G01 compact header)', () => {
  const controls = (container: HTMLElement) =>
    Array.from(
      container.querySelectorAll(':scope > * > button, :scope > a, :scope > nav > button'),
    ).map((node) => node.getAttribute('aria-label') ?? node.textContent);

  it('signed out: language first, then a services menu with help', () => {
    const { container } = inEnglish(<HeaderCare language={<LanguageSwitch />} />);
    expect(controls(container)).toEqual(['English', 'Services']);
    fireEvent.click(screen.getByRole('button', { name: 'Services' }));
    const menu = screen.getByRole('navigation', { name: 'Services' });
    expect(Array.from(menu.querySelectorAll('a')).map((link) => link.getAttribute('href'))).toEqual(
      [
        '/en/services/physiotherapy',
        '/en/services/nursing',
        '/en/services/attendant',
        '/en/services/lab',
        '/en/pages/contact',
      ],
    );
  });

  it('signed in for care: who for, language, the bell, then the account menu', () => {
    state.status = 'signed-in';
    state.account = { state: 'ready', me: { activeRole: 'patient' } };
    const { container } = inEnglish(<HeaderCare language={<LanguageSwitch />} />);
    expect(controls(container)).toEqual(['For me', 'English', 'Alerts', 'More']);
    expect(screen.getByRole('link', { name: 'Alerts' }).getAttribute('href')).toBe(
      '/en/notifications',
    );
    const more = screen.getByRole('button', { name: 'More' });
    fireEvent.click(more);
    const menu = screen.getByRole('navigation', { name: 'More' });
    expect(menu.textContent).toContain('Plans');
    expect(menu.textContent).toContain('Help');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(more);
  });

  it('signed in as a provider: no person picker and no plans', () => {
    state.status = 'signed-in';
    state.account = { state: 'ready', me: { activeRole: 'nurse' } };
    const { container } = inEnglish(<HeaderCare language={<LanguageSwitch />} />);
    expect(controls(container)).toEqual(['English', 'Alerts', 'More']);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('navigation', { name: 'More' }).textContent).not.toContain('Plans');
  });
});

describe('ShellNav', () => {
  const linkNames = () => screen.getAllByRole('link').map((link) => link.textContent);

  it.each(['checking', 'signed-out'] as const)('leaves Account out while %s', (status) => {
    state.status = status;
    inEnglish(<ShellNav accounts sample={false} />);
    expect(linkNames()).toEqual(['Home']);
  });

  it('shows Account once signed in', () => {
    state.status = 'signed-in';
    inEnglish(<ShellNav accounts sample={false} />);
    expect(linkNames()).toEqual(['Home', 'Profile']);
    expect(screen.getByRole('link', { name: 'Profile' }).getAttribute('href')).toBe('/en/account');
  });
});
