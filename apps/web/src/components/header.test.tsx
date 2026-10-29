import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n-context';
import { LanguageSwitch } from './LanguageSwitch';
import { SignInLink } from './SignInLink';

interface HeaderState {
  pathname: string;
  status: 'checking' | 'signed-in' | 'signed-out';
  account: { state: string };
}

const state = vi.hoisted(() => {
  const initial: HeaderState = { pathname: '', status: 'signed-out', account: { state: 'idle' } };
  return { ...initial, api: vi.fn(() => Promise.resolve()) };
});

vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }));
vi.mock('../lib/session', () => ({ useSession: () => ({ status: state.status }) }));
vi.mock('../lib/account', () => ({ useAccount: () => ({ account: state.account }) }));
vi.mock('../lib/api', () => ({ api: state.api }));

const inEnglish = (node: ReactNode) => render(<I18nProvider locale="en">{node}</I18nProvider>);

beforeEach(() => {
  state.pathname = '/en/account';
  state.status = 'signed-out';
  state.account = { state: 'idle' };
  state.api.mockClear();
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

describe('SignInLink', () => {
  it('shows once the visitor is known to be signed out', () => {
    inEnglish(<SignInLink />);
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/en/sign-in');
  });

  it.each([
    ['while the session is checked', 'checking', '/en'],
    ['when signed in', 'signed-in', '/en'],
    ['on the sign-in page', 'signed-out', '/en/sign-in'],
    ['during setup', 'signed-out', '/en/setup/role'],
  ] as const)('is hidden %s', (_, status, pathname) => {
    state.status = status;
    state.pathname = pathname;
    inEnglish(<SignInLink />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
