import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeBroadcastChannel, fakeAuthServer, lockDouble, openTab } from './session-doubles';

let server: ReturnType<typeof fakeAuthServer>;
let lock: ReturnType<typeof lockDouble>;

beforeEach(() => {
  server = fakeAuthServer();
  lock = lockDouble();
  FakeBroadcastChannel.open.clear();
  vi.stubGlobal('fetch', server.fetchStub);
  vi.stubGlobal('navigator', { locks: lock.locks });
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A tab that restored its session, whose access token has since expired. */
async function signedInTabWithExpiredToken() {
  const tab = await openTab();
  expect(await tab.refreshSession()).toBe('ok');
  server.expireAccessTokens();
  return tab;
}

describe('api() and refreshSession()', () => {
  it('SE-07.5 parallel 401s share one refresh and each call retries once', async () => {
    const tab = await signedInTabWithExpiredToken();
    const before = server.state.refreshes;
    const results = await Promise.all([tab.api('/a'), tab.api('/b'), tab.api('/c')]);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(server.state.refreshes - before).toBe(1);
    expect(server.state.replays).toBe(0);
    expect(server.fetchStub).toHaveBeenCalledTimes(1 + 3 + 1 + 3);
  });

  it('SE-07.5 a 401 after another call refreshed retries without refreshing', async () => {
    const tab = await signedInTabWithExpiredToken();
    let releaseSecond: () => void = () => undefined;
    // The second call's 401 arrives only after the first call's refresh has finished.
    server.fetchStub.mockImplementationOnce(async (url: string, init?: RequestInit) => {
      await new Promise<void>((resolve) => {
        releaseSecond = resolve;
      });
      return server.handle(url, init);
    });
    const second = tab.api('/slow');
    const first = await tab.api('/fast');
    releaseSecond();
    expect([first, await second]).toEqual([{ ok: true }, { ok: true }]);
    expect(server.state.refreshes).toBe(2); // the restore, then one for both calls
    expect(server.state.replays).toBe(0);
  });

  it('SE-07.5 a call still refused after a refresh fails with 401 without refreshing again', async () => {
    const tab = await signedInTabWithExpiredToken();
    server.fetchStub.mockClear();
    server.fetchStub.mockImplementation(async (url: string, init?: RequestInit) =>
      url.endsWith('/auth/refresh')
        ? fakeAuthServer().fetchStub(url, init)
        : new Response(null, { status: 401 }),
    );
    await expect(tab.api('/a')).rejects.toMatchObject({ status: 401 });
    const refreshCalls = server.fetchStub.mock.calls.filter(([url]) => url.endsWith('/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });

  it('SE-07.7 refreshes run inside the cross-tab lock, one at a time', async () => {
    const tabOne = await signedInTabWithExpiredToken();
    const tabTwo = await openTab();
    const results = await Promise.all([
      tabOne.api('/a'),
      tabTwo.api('/b'),
      tabOne.api('/c'),
      tabTwo.api('/d'),
    ]);
    expect(results).toHaveLength(4);
    expect(lock.stats.maxHolders).toBe(1);
    expect(server.state.replays).toBe(0);
  });

  it('SE-07.7 without the lock, two tabs replay the shared cookie (the defect the lock prevents)', async () => {
    vi.stubGlobal('navigator', {});
    const tabOne = await signedInTabWithExpiredToken();
    const tabTwo = await openTab();
    await Promise.allSettled([tabOne.api('/a'), tabTwo.api('/b')]);
    expect(server.state.replays).toBe(1);
  });
});

describe('refresh failures and ended sessions', () => {
  it('SE-07.8 a rejected refresh ends the session here and in other tabs', async () => {
    const tabOne = await signedInTabWithExpiredToken();
    const tabTwo = await openTab();
    expect(await tabTwo.refreshSession()).toBe('ok');
    const endedInTwo = vi.fn();
    tabTwo.onSessionEnded(endedInTwo);
    server.state.cookie = ''; // revoked elsewhere: the server answers 401
    await expect(tabOne.api('/a')).rejects.toMatchObject({ status: 401 });
    expect(tabOne.hasAccessToken()).toBe(false);
    expect(endedInTwo).toHaveBeenCalledOnce();
    expect(tabTwo.hasAccessToken()).toBe(false);
  });

  it('SE-07.8 the refresh endpoint is never refreshed', async () => {
    const tab = await openTab();
    server.state.cookie = '';
    await expect(tab.api('/auth/refresh', { method: 'POST' })).rejects.toMatchObject({
      status: 401,
    });
    expect(server.state.refreshes).toBe(1);
  });

  it.each(['network', 503] as const)('SE-07.9 a %s failure keeps the session', async (failure) => {
    const tab = await signedInTabWithExpiredToken();
    const ended = vi.fn();
    tab.onSessionEnded(ended);
    server.state.refreshFailure = failure;
    const call = tab.api('/a');
    if (failure === 'network') await expect(call).rejects.toBeInstanceOf(TypeError);
    else await expect(call).rejects.toMatchObject({ status: 503 });
    expect(tab.hasAccessToken()).toBe(true);
    expect(ended).not.toHaveBeenCalled();
    expect(server.state.logouts).toBe(0);
    const refreshesSoFar = server.state.refreshes;
    server.state.refreshFailure = undefined;
    expect(await tab.api('/b')).toEqual({ ok: true });
    expect(server.state.refreshes - refreshesSoFar).toBe(1);
  });

  it('SE-07.11 results from an ended session are ignored', async () => {
    server = fakeAuthServer({ refreshDelayMs: 300 });
    vi.stubGlobal('fetch', server.fetchStub);
    const tab = await signedInTabWithExpiredToken();
    const call = tab.api('/a');
    await vi.waitFor(() => {
      expect(server.state.refreshes).toBe(2); // the restore, then this call's refresh in flight
    });
    tab.endSession();
    await expect(call).rejects.toMatchObject({ status: 401 });
    expect(tab.hasAccessToken()).toBe(false);
  });

  it('SE-07.11 a call from an ended session is not retried with a later session token', async () => {
    const tab = await signedInTabWithExpiredToken();
    let releaseCall: () => void = () => undefined;
    server.fetchStub.mockImplementationOnce(async (url: string, init?: RequestInit) => {
      await new Promise<void>((resolve) => {
        releaseCall = resolve;
      });
      return server.handle(url, init);
    });
    const call = tab.api('/old-session');
    tab.startSession('access-of-the-next-sign-in');
    releaseCall();
    await expect(call).rejects.toMatchObject({ status: 401 });
    const oldSessionCalls = server.fetchStub.mock.calls.filter(([url]) =>
      url.endsWith('/old-session'),
    );
    expect(oldSessionCalls).toHaveLength(1);
  });

  it('SE-07.10 sign-out waits for the in-flight refresh and revokes the session it produced', async () => {
    const tab = await signedInTabWithExpiredToken();
    const call = tab.api('/a');
    await tab.signOutOfThisDevice();
    await call.catch(() => undefined);
    expect(server.state.logouts).toBe(1);
    expect(server.state.cookie).toBe('');
    expect(tab.hasAccessToken()).toBe(false);
    expect(await tab.refreshSession()).toBe('rejected');
  });
});
