import { CATALOGUES } from '@heach/i18n';
import { useState } from 'react';
import { ResourceView } from '../components/account/ResourceView';
import { I18nProvider } from './i18n-context';
import { act, render, screen, fireEvent, renderHook, waitFor } from '@testing-library/react';
import { api } from './api';
import type * as ApiModule from './api';
import { useResource } from './use-resource';

vi.mock('./api', async (original) => ({
  ...(await original<typeof ApiModule>()),
  api: vi.fn(),
}));
const send = vi.mocked(api);
beforeEach(() => {
  send.mockReset();
});

it('does not show a previous person/filter result or let a late response overwrite a newer one', async () => {
  let first: (value: unknown) => void = vi.fn<(value: unknown) => void>();
  let second: (value: unknown) => void = vi.fn<(value: unknown) => void>();
  send
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          first = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          second = resolve;
        }),
    );
  const { result, rerender } = renderHook(
    ({ body }) => useResource<string[]>('/vault/search', body),
    { initialProps: { body: '{"person":"synthetic-first"}' } },
  );
  rerender({ body: '{"person":"synthetic-second"}' });
  expect(result.current.resource.state).toBe('loading');
  await act(async () => {
    second(['Synthetic second record']);
    await Promise.resolve();
  });
  expect(result.current.resource).toEqual({ state: 'ready', data: ['Synthetic second record'] });
  await act(async () => {
    first(['Synthetic first record']);
    await Promise.resolve();
  });
  expect(result.current.resource).toEqual({ state: 'ready', data: ['Synthetic second record'] });
});
it('keeps disabled queries off the network and fetches when valid input is supplied', async () => {
  send.mockResolvedValue([]);
  const { result, rerender } = renderHook(
    ({ enabled }) => useResource('/search/any-slots', '{}', enabled),
    { initialProps: { enabled: false } },
  );
  expect(send).not.toHaveBeenCalled();
  rerender({ enabled: true });
  await waitFor(() => {
    expect(result.current.resource.state).toBe('ready');
  });
  expect(send).toHaveBeenCalledExactlyOnceWith('/search/any-slots', { method: 'POST', body: '{}' });
});

it('keeps the same resource visible throughout a refresh, then replaces it', async () => {
  let complete: (value: unknown) => void = vi.fn<(value: unknown) => void>();
  send.mockResolvedValueOnce(['original']).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const { result, rerender } = renderHook(({ path }) => useResource<string[]>(path), {
    initialProps: { path: '/organisation' },
  });
  await waitFor(() => {
    expect(result.current.resource.state).toBe('ready');
  });
  let refreshing: Promise<void> = Promise.resolve();
  act(() => {
    refreshing = result.current.reload();
  });
  expect(result.current.resource).toEqual({ state: 'ready', data: ['original'] });
  await act(async () => {
    complete(['updated']);
    await refreshing;
  });
  expect(result.current.resource).toEqual({ state: 'ready', data: ['updated'] });
  send.mockImplementationOnce(() => new Promise(() => undefined));
  rerender({ path: '/another-organisation' });
  expect(result.current.resource.state).toBe('loading');
});

function StatefulChild({ refresh }: Readonly<{ refresh: () => Promise<void> }>) {
  const [message, setMessage] = useState('');
  return (
    <>
      <input aria-label="Synthetic input" />
      <button
        onClick={() => {
          setMessage('Synthetic saved');
          void refresh();
        }}
      >
        Synthetic save
      </button>
      <p>{message}</p>
    </>
  );
}
function ResourceHarness() {
  const { resource, reload } = useResource<string[]>('/organisation');
  return (
    <I18nProvider locale="en" messages={CATALOGUES.en}>
      <ResourceView resource={resource} reload={reload}>
        {() => <StatefulChild refresh={reload} />}
      </ResourceView>
    </I18nProvider>
  );
}
it('preserves child messages and focused inputs when a mutation refreshes the same resource', async () => {
  let complete: (value: unknown) => void = vi.fn<(value: unknown) => void>();
  send.mockResolvedValueOnce([]).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  render(<ResourceHarness />);
  const input = await screen.findByLabelText('Synthetic input');
  fireEvent.click(screen.getByRole('button', { name: 'Synthetic save' }));
  input.focus();
  expect(screen.getByText('Synthetic saved')).toBeTruthy();
  await act(async () => {
    complete(['updated']);
    await Promise.resolve();
  });
  expect(screen.getByText('Synthetic saved')).toBeTruthy();
  expect(screen.getByLabelText('Synthetic input')).toBe(input);
  expect(document.activeElement).toBe(input);
});

it('keeps ready children and focus on a failed refresh and offers a retry', async () => {
  send
    .mockResolvedValueOnce([])
    .mockRejectedValueOnce(new Error('Synthetic refresh failure'))
    .mockResolvedValueOnce(['updated']);
  render(<ResourceHarness />);
  const input = await screen.findByLabelText('Synthetic input');
  fireEvent.click(screen.getByRole('button', { name: 'Synthetic save' }));
  input.focus();
  const retry = await screen.findByRole('button', { name: CATALOGUES.en.state.retry });
  expect(screen.getByText('Synthetic saved')).toBeTruthy();
  expect(document.activeElement).toBe(input);
  fireEvent.click(retry);
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: CATALOGUES.en.state.retry })).toBeNull();
  });
  expect(screen.getByLabelText('Synthetic input')).toBe(input);
});
