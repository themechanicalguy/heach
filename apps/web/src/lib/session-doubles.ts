import { vi } from 'vitest';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

/**
 * The API's refresh rules in miniature, shared by every "tab" in a test: one cookie jar, refresh
 * tokens single use, and a reused one counted as replay (what signs a user out everywhere).
 */
export function fakeAuthServer({ refreshDelayMs = 5 } = {}) {
  const state = {
    cookie: 'refresh-0',
    generation: 0,
    refreshes: 0,
    replays: 0,
    logouts: 0,
    refreshFailure: undefined as 'network' | 503 | undefined,
  };
  const used = new Set<string>();
  const validAccess = new Set<string>();

  async function refresh(): Promise<Response> {
    state.refreshes += 1;
    const presented = state.cookie; // the browser attaches the cookie when the request starts
    await delay(refreshDelayMs);
    if (state.refreshFailure === 'network') throw new TypeError('Failed to fetch');
    if (state.refreshFailure) return new Response(null, { status: state.refreshFailure });
    if (used.has(presented) || presented === '') {
      if (presented !== '') state.replays += 1;
      return new Response(null, { status: 401 });
    }
    used.add(presented);
    state.generation += 1;
    state.cookie = `refresh-${String(state.generation)}`;
    const token = `access-${String(state.generation)}`;
    validAccess.add(token);
    return json({ accessToken: token, expiresIn: 900 });
  }

  async function handle(url: string, init: RequestInit = {}): Promise<Response> {
    if (url.endsWith('/auth/refresh')) return refresh();
    const bearer = new Headers(init.headers).get('authorization')?.replace('Bearer ', '') ?? '';
    if (!validAccess.has(bearer)) return new Response(null, { status: 401 });
    if (url.endsWith('/auth/logout')) {
      state.logouts += 1;
      validAccess.delete(bearer);
      state.cookie = '';
      return new Response(null, { status: 204 });
    }
    return json({ ok: true });
  }
  const fetchStub = vi.fn(handle);

  return {
    state,
    fetchStub,
    handle,
    /** Every access token issued so far stops working, as when they expire. */
    expireAccessTokens: () => {
      validAccess.clear();
    },
  };
}

/** Web Locks double: one holder at a time, in request order; records the most concurrent holders. */
export function lockDouble() {
  let tail: Promise<unknown> = Promise.resolve();
  let holders = 0;
  const stats = { maxHolders: 0, grants: 0 };
  const request = <T>(_name: string, task: () => Promise<T>): Promise<T> => {
    const run = tail.then(async () => {
      holders += 1;
      stats.grants += 1;
      stats.maxHolders = Math.max(stats.maxHolders, holders);
      try {
        return await task();
      } finally {
        holders -= 1;
      }
    });
    tail = run.catch(() => undefined);
    return run;
  };
  return { locks: { request }, stats };
}

/** In-memory BroadcastChannel: messages reach every other instance with the same name. */
export class FakeBroadcastChannel {
  static readonly open = new Set<FakeBroadcastChannel>();
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;

  constructor(readonly name: string) {
    FakeBroadcastChannel.open.add(this);
  }

  postMessage(data: unknown): void {
    for (const other of FakeBroadcastChannel.open) {
      if (other !== this && other.name === this.name) {
        other.onmessage?.(new MessageEvent('message', { data }));
      }
    }
  }
}

/** A fresh copy of api.ts, as a new browser tab would load it. */
export async function openTab() {
  vi.resetModules();
  return import('./api');
}
