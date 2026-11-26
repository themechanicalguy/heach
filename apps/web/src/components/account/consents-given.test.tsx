import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../../lib/api';
import { ApiError } from '../../lib/api';
import { clientMessages, shellMessages } from '../../lib/client-messages';
import { I18nProvider } from '../../lib/i18n-context';
import { ConsentsGiven } from './ConsentsGiven';

const env = vi.hoisted(() => ({ api: vi.fn(), reload: vi.fn() }));

vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof ApiModule>()),
  api: env.api,
}));
vi.mock('../../lib/account', () => ({ useAccount: () => ({ reload: env.reload }) }));

const TERMS = { purpose: 'terms', version: '2026-10', givenAt: '2026-11-01T10:00:00Z' };
const PRIVACY = { purpose: 'privacy', version: '2026-10', givenAt: '2026-11-01T10:00:00Z' };

const open = () =>
  render(
    <I18nProvider locale="en" messages={shellMessages('en')}>
      <I18nProvider locale="en" messages={clientMessages('en', 'account')}>
        <ConsentsGiven />
      </I18nProvider>
    </I18nProvider>,
  );

beforeEach(() => {
  env.api.mockReset();
  env.reload.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('Your consents (PR-01)', () => {
  it('lists each consent in force with the day it was given', async () => {
    env.api.mockResolvedValueOnce([TERMS, PRIVACY]);
    open();
    expect(await screen.findByText('Terms of use')).toBeTruthy();
    expect(screen.getByText('Using your details to run your account')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Withdraw' })).toHaveLength(2);
    expect(env.api).toHaveBeenCalledWith('/me/consents');
  });

  it('says what withdrawing means, and keeping it sends nothing', async () => {
    env.api.mockResolvedValueOnce([TERMS]);
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw' }));
    expect(screen.getByText(/you cannot use HEACH until you agree again/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeTruthy();
    expect(env.api).toHaveBeenCalledTimes(1);
  });

  it('withdraws, refreshes the list and reloads the account', async () => {
    env.api.mockResolvedValueOnce([TERMS, PRIVACY]).mockResolvedValueOnce(undefined);
    env.api.mockResolvedValueOnce([PRIVACY]);
    open();
    const [first] = await screen.findAllByRole('button', { name: 'Withdraw' });
    if (first) fireEvent.click(first);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, withdraw' }));
    expect(await screen.findByText('Consent withdrawn.')).toBeTruthy();
    expect(env.api).toHaveBeenCalledWith('/me/consents/terms', { method: 'DELETE' });
    await waitFor(() => {
      expect(screen.queryByText('Terms of use')).toBeNull();
    });
    expect(env.reload).toHaveBeenCalled();
  });

  it('shows the reason when the consent was already withdrawn elsewhere', async () => {
    env.api.mockResolvedValueOnce([TERMS]);
    env.api.mockRejectedValueOnce(new ApiError(409, 'consent_not_in_force'));
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, withdraw' }));
    expect(await screen.findByText('This consent has already been withdrawn.')).toBeTruthy();
    expect(env.reload).not.toHaveBeenCalled();
  });
});
