import { act, renderHook, waitFor } from '@testing-library/react';
import { CareSearchProvider, useCareSearch } from './care-search';
import { api } from './api';

vi.mock('./api', () => ({ api: vi.fn() }));
const session = vi.hoisted(() => ({ status: 'signed-in' }));
vi.mock('./session', () => ({ useSession: () => ({ status: session.status }) }));
vi.mock('./account', () => ({
  useAccount: () => ({ enabled: true, account: { state: 'ready', me: { activeRole: 'patient' } } }),
}));
const send = vi.mocked(api);
beforeEach(() => {
  send.mockReset();
  session.status = 'signed-in';
});

it('loads the saved PIN and hides it immediately when the selected person changes', async () => {
  send.mockResolvedValueOnce({ pin: '751001' }).mockResolvedValueOnce({ pin: '753001' });
  const { result } = renderHook(useCareSearch, { wrapper: CareSearchProvider });
  await waitFor(() => {
    expect(result.current.search.pin).toBe('751001');
  });
  act(() => {
    result.current.setPerson('synthetic-parent');
  });
  expect(result.current.search.pin).toBe('');
  await waitFor(() => {
    expect(result.current.search.pin).toBe('753001');
  });
  expect(send).toHaveBeenLastCalledWith('/me/care-pin/read', {
    method: 'POST',
    body: '{"person":"synthetic-parent"}',
  });
});

it('keeps the PIN prompt when no saved location exists', async () => {
  send.mockResolvedValue({ pin: null });
  const { result } = renderHook(useCareSearch, { wrapper: CareSearchProvider });
  await waitFor(() => {
    expect(send).toHaveBeenCalledTimes(1);
  });
  expect(result.current.search.pin).toBe('');
});

it('never renders a signed-in search PIN to the signed-out page', async () => {
  send.mockResolvedValue({ pin: '751001' });
  const signedOutPins: string[] = [];
  const { result, rerender } = renderHook(
    () => {
      const context = useCareSearch();
      if (session.status === 'signed-out') signedOutPins.push(context.search.pin);
      return context;
    },
    { wrapper: CareSearchProvider },
  );
  await waitFor(() => {
    expect(result.current.search.pin).toBe('751001');
  });
  session.status = 'signed-out';
  rerender();
  expect(signedOutPins.length).toBeGreaterThan(0);
  expect(signedOutPins.every((pin) => pin === '')).toBe(true);
});
