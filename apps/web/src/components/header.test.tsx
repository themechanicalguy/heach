import { CATALOGUES } from '@heach/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n-context';
import { HeaderAccount } from './HeaderAccount';
import { LanguageSwitch } from './LanguageSwitch';
import { ShellNav } from './ShellNav';

interface HeaderState {
  pathname: string;
  status: 'checking' | 'signed-in' | 'signed-out';
  account: { state: string };
}

const state = vi.hoisted(() => {
  const initial: HeaderState = { pathname: '', status: 'signed-out', account: { state: 'idle' } };
  return {
    ...initial,
    api: vi.fn(() => Promise.resolve()),
    signOut: vi.fn(() => Promise.resolve()),
    replace: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ replace: state.replace }),
}));
vi.mock('../lib/session', () => ({
  useSession: () => ({ status: state.status, signOut: state.signOut }),
}));
vi.mock('../lib/account', () => ({ useAccount: () => ({ account: state.account }) }));
vi.mock('../lib/api', () => ({ api: state.api }));

const inEnglish = (node: ReactNode) =>
  render(
    <I18nProvider locale="en" messages={CATALOGUES.en}>
      {node}
    </I18nProvider>,
  );

beforeEach(() => {
  state.pathname = '/en/account';
  state.status = 'signed-out';
  state.account = { state: 'idle' };
  state.api.mockClear();
  state.signOut.mockReset().mockResolvedValue(undefined);
  state.replace.mockClear();
});

describe('LanguageSwitch', () => {
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

  it('SE-07.10 signed in, signs this device out and goes home', async () => {
    state.status = 'signed-in';
    inEnglish(<HeaderAccount />);
    expect(screen.queryByRole('link')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => {
      expect(state.replace).toHaveBeenCalledWith('/en');
    });
    expect(state.signOut).toHaveBeenCalledTimes(1);
  });

  it('goes home even when the logout call fails, as the session has ended here', async () => {
    state.status = 'signed-in';
    state.signOut.mockRejectedValue(new Error('network'));
    inEnglish(<HeaderAccount />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => {
      expect(state.replace).toHaveBeenCalledWith('/en');
    });
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
    expect(linkNames()).toEqual(['Home', 'Account']);
    expect(screen.getByRole('link', { name: 'Account' }).getAttribute('href')).toBe('/en/account');
  });
});
