import type { AccessToken, ApiErrorBody } from '@heach/types';

/**
 * HTTP status from the API and its stable reason code, if any; the rest of the body is never
 * shown. The code maps to a translated message (errors.*).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`API responded ${String(status)}`);
    this.name = 'ApiError';
  }
}

async function errorFrom(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    return new ApiError(response.status, typeof body.code === 'string' ? body.code : undefined);
  } catch {
    return new ApiError(response.status);
  }
}

export type RefreshOutcome = 'ok' | 'rejected' | 'failed';

type Refresh =
  | { outcome: 'ok'; token: string }
  | { outcome: 'rejected' }
  | { outcome: 'failed'; error: unknown };

const REFRESH_PATH = '/auth/refresh';
// Serialises refreshes across tabs: they share one single-use refresh cookie (SE-07.7).
const REFRESH_LOCK = 'heach-session-refresh';
// Tells other tabs the session ended; carries no token or ID (SE-07.8, SE-07.12).
const SESSION_CHANNEL = 'heach-session';
const SIGNED_OUT = { type: 'signed-out' } as const;

let accessToken: string | undefined;
// Bumped on every sign-in and session end, so results of an older session are dropped (SE-07.11).
let epoch = 0;
let inFlight: Promise<Refresh> | undefined;
let channel: BroadcastChannel | undefined;
const endedListeners = new Set<() => void>();

/** The access token lives in memory only, never in storage (SE-07). */
export function startSession(token: string): void {
  epoch += 1;
  accessToken = token;
}

export function hasAccessToken(): boolean {
  return accessToken !== undefined;
}

/** Ends the session in this tab and tells the browser's other tabs. Idempotent. */
export function endSession(): void {
  endLocally();
  sessionChannel()?.postMessage(SIGNED_OUT);
}

/** Called when the session ends here or in another tab; returns the unsubscribe function. */
export function onSessionEnded(listener: () => void): () => void {
  sessionChannel();
  endedListeners.add(listener);
  return () => {
    endedListeners.delete(listener);
  };
}

function endLocally(): void {
  epoch += 1;
  accessToken = undefined;
  for (const listener of endedListeners) listener();
}

function sessionChannel(): BroadcastChannel | undefined {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  channel = new BroadcastChannel(SESSION_CHANNEL);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const data = event.data as { type?: unknown } | null;
    if (data?.type === SIGNED_OUT.type) endLocally();
  };
  return channel;
}

/** Runs the task under the cross-tab lock where the browser has one (iOS < 15.4 does not). */
function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  return locks ? locks.request(REFRESH_LOCK, task) : task();
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  // One ID per request, carried through the API, its queries and its logs (LM-01.1).
  headers.set('x-correlation-id', crypto.randomUUID());
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  if (init.body) headers.set('content-type', 'application/json');
  return fetch(`/api/v1${path}`, {
    ...init,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });
}

/** One refresh request; only a 401 means the session is over (SE-07.8, SE-07.9). */
async function requestRefresh(): Promise<Refresh> {
  try {
    const response = await send(REFRESH_PATH, { method: 'POST' });
    if (response.status === 401) return { outcome: 'rejected' };
    if (!response.ok) return { outcome: 'failed', error: new ApiError(response.status) };
    return { outcome: 'ok', token: ((await response.json()) as AccessToken).accessToken };
  } catch (error) {
    return { outcome: 'failed', error };
  }
}

async function runRefresh(): Promise<Refresh> {
  const started = epoch;
  const result = await withRefreshLock(requestRefresh);
  if (epoch !== started) return { outcome: 'rejected' };
  if (result.outcome === 'ok') accessToken = result.token;
  if (result.outcome === 'rejected') endSession();
  return result;
}

/** At most one refresh per tab at a time; every caller shares it (SE-07.5, SE-07.6). */
function refreshOnce(): Promise<Refresh> {
  inFlight ??= runRefresh().finally(() => {
    inFlight = undefined;
  });
  return inFlight;
}

/** Uses the refresh cookie to get a new access token. */
export async function refreshSession(): Promise<RefreshOutcome> {
  return (await refreshOnce()).outcome;
}

/** Retries a 401 once: with a token another call already got, or after one shared refresh. */
async function retryAfter401(path: string, init: RequestInit, sentWith?: string) {
  const started = epoch;
  if (accessToken !== undefined && accessToken !== sentWith) return send(path, init);
  const result = await refreshOnce();
  if (result.outcome === 'failed') throw result.error;
  // Never retry a call from an ended session with a later session's token (SE-07.11).
  if (result.outcome === 'rejected' || epoch !== started) throw new ApiError(401);
  return send(path, init);
}

/** Calls the API; on 401 it refreshes at most once and retries once. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const sentWith = accessToken;
  const started = epoch;
  let response = await send(path, init);
  if (response.status === 401 && path !== REFRESH_PATH) {
    if (epoch !== started) throw new ApiError(401);
    response = await retryAfter401(path, init, sentWith);
  }
  if (!response.ok) throw await errorFrom(response);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/**
 * Signs this device out (SE-07.10). Runs under the refresh lock so it follows any refresh in
 * this or another tab, and its cookie clearing is the last cookie write. It calls `send`, not
 * `api`, because a refresh inside the lock must not wait for the lock again.
 */
export async function signOutOfThisDevice(): Promise<void> {
  try {
    await inFlight;
    await withRefreshLock(logoutWithFreshToken);
  } finally {
    endSession();
  }
}

/** Signs every device of this account out (SE-07.3), then this tab and its siblings. */
export async function signOutEverywhere(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST', body: JSON.stringify({ allDevices: true }) });
  } finally {
    endSession();
  }
}

async function logoutWithFreshToken(): Promise<void> {
  const logout = () =>
    send('/auth/logout', { method: 'POST', body: JSON.stringify({ allDevices: false }) });
  if ((await logout()).status !== 401) return;
  const refreshed = await requestRefresh();
  if (refreshed.outcome !== 'ok') return;
  accessToken = refreshed.token;
  await logout();
}
