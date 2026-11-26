import { api, refresh, setAccessToken } from './api';

const json = (status: number, body: unknown = {}) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('Admin token refresh (SE-07.5, SE-07.6, SE-07.8)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setAccessToken(undefined);
  });

  it('refreshes under one cross-tab lock and shares one request within the tab', async () => {
    const fetch = vi.fn(() => json(200, { accessToken: 'synthetic-token' }));
    const request = vi.fn((_name: string, task: () => Promise<unknown>) => task());
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('navigator', { locks: { request } });
    await expect(Promise.all([refresh(), refresh()])).resolves.toEqual([true, true]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('heach-admin-refresh', expect.any(Function));
  });

  it('an outage during refresh is an error, not a signed-out session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => json(503)),
    );
    await expect(refresh()).rejects.toMatchObject({ status: 503 });
  });

  it('a refused refresh ends the call with 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => json(401)),
    );
    await expect(api('/dashboard')).rejects.toMatchObject({ status: 401 });
  });
});
