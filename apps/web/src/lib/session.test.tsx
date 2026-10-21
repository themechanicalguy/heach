import { act, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeBroadcastChannel, fakeAuthServer, lockDouble } from './session-doubles';

let server: ReturnType<typeof fakeAuthServer>;

beforeEach(() => {
  server = fakeAuthServer({ refreshDelayMs: 20 });
  FakeBroadcastChannel.open.clear();
  vi.stubGlobal('fetch', server.fetchStub);
  vi.stubGlobal('navigator', { locks: lockDouble().locks });
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Loads api.ts and session.tsx fresh, as a new tab would, and renders the provider. */
async function renderApp() {
  vi.resetModules();
  const api = await import('./api');
  const { SessionProvider, useSession } = await import('./session');
  let session: ReturnType<typeof useSession> | undefined;
  function Status() {
    session = useSession();
    return <p>{session.status}</p>;
  }
  render(
    <StrictMode>
      <SessionProvider>
        <Status />
      </SessionProvider>
    </StrictMode>,
  );
  const current = () => {
    if (!session) throw new Error('provider not rendered');
    return session;
  };
  return { api, session: current };
}

describe('SessionProvider', () => {
  it('SE-07.6 a double start restores the session with one refresh', async () => {
    await renderApp();
    expect(await screen.findByText('signed-in')).toBeTruthy();
    expect(server.state.refreshes).toBe(1);
    expect(server.state.replays).toBe(0);
  });

  it("SE-07.8 the provider shows signed out when a call's refresh is rejected", async () => {
    const { api } = await renderApp();
    await screen.findByText('signed-in');
    server.expireAccessTokens();
    server.state.cookie = '';
    await act(async () => {
      await api.api('/a').catch(() => undefined);
    });
    expect(screen.getByText('signed-out')).toBeTruthy();
  });

  it('SE-07.10 sign-out waits for the in-flight refresh', async () => {
    const { api, session } = await renderApp();
    await screen.findByText('signed-in');
    server.expireAccessTokens();
    const call = api.api('/a').catch(() => undefined);
    await act(async () => {
      await session().signOut();
    });
    await call;
    expect(screen.getByText('signed-out')).toBeTruthy();
    expect(server.state.logouts).toBe(1);
    expect(server.state.replays).toBe(0);
    expect(server.state.cookie).toBe(''); // the last cookie write is the logout's clear
  });

  it('SE-07.11 a restore that completes after sign-out does not sign the tab back in', async () => {
    const { api } = await renderApp();
    await act(async () => {
      api.endSession(); // ended while the restore refresh is still in flight
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getByText('signed-out')).toBeTruthy();
    expect(api.hasAccessToken()).toBe(false);
  });
});
