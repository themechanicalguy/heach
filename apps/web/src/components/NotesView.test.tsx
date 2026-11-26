import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../lib/api';
import { ApiError } from '../lib/api';
import { clientMessages, shellMessages } from '../lib/client-messages';
import { I18nProvider } from '../lib/i18n-context';
import { NotesView } from './NotesView';

interface AccountState {
  state: string;
  me?: { activeRole: string };
}
const env = vi.hoisted(() => {
  const account: AccountState = { state: 'idle' };
  return { api: vi.fn(), account, enabled: true };
});

vi.mock('../lib/api', async (original) => ({
  ...(await original<typeof ApiModule>()),
  api: env.api,
}));
vi.mock('../lib/session', () => ({ useSession: () => ({ status: 'signed-in' }) }));
vi.mock('../lib/account', () => ({
  useAccount: () => ({ enabled: env.enabled, account: env.account }),
}));

const open = () =>
  render(
    <I18nProvider locale="en" messages={shellMessages('en')}>
      <I18nProvider locale="en" messages={clientMessages('en', 'notes')}>
        <NotesView />
      </I18nProvider>
    </I18nProvider>,
  );
const patient = () => {
  env.account = { state: 'ready', me: { activeRole: 'patient' } };
};

beforeEach(() => {
  env.api.mockReset();
  env.account = { state: 'idle' };
  env.enabled = true;
});
afterEach(cleanup);

describe('My notes (sample, EN-13)', () => {
  it('says notes are for patients and asks nothing of the API for a provider role', () => {
    env.account = { state: 'ready', me: { activeRole: 'physiotherapist' } };
    open();
    expect(screen.getByText(/Notes are for patient accounts/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save note' })).toBeNull();
    expect(env.api).not.toHaveBeenCalled();
  });

  it('waits for the role before it loads the notes', () => {
    open();
    expect(env.api).not.toHaveBeenCalled();
  });

  it('saves a note, clears the box and reloads the list for a patient', async () => {
    patient();
    env.api.mockResolvedValueOnce([]).mockResolvedValueOnce({ id: 'n1', createdAt: '' });
    env.api.mockResolvedValueOnce([
      { id: 'n1', body: 'Knee felt better', createdAt: '2026-11-09T10:00:00Z' },
    ]);
    open();
    const box = await screen.findByLabelText('New note');
    fireEvent.change(box, { target: { value: 'Knee felt better' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    expect(await screen.findByText('Knee felt better')).toBeTruthy();
    expect((box as HTMLTextAreaElement).value).toBe('');
  });

  it('shows why a save failed and keeps what was typed', async () => {
    patient();
    env.api.mockResolvedValueOnce([]).mockRejectedValueOnce(new ApiError(403));
    open();
    const box = await screen.findByLabelText('New note');
    fireEvent.change(box, { target: { value: 'Keep me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();
    });
    expect((box as HTMLTextAreaElement).value).toBe('Keep me');
  });
});
