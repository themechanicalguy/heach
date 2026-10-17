import type { AccessToken } from '@heach/types';

/** HTTP status from the API; the body is never shown, it may echo nothing useful anyway. */
export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`API responded ${String(status)}`);
    this.name = 'ApiError';
  }
}

let accessToken: string | undefined;

/** The access token lives in memory only, never in storage (SE-07). */
export function setAccessToken(token: string | undefined): void {
  accessToken = token;
}

export function hasAccessToken(): boolean {
  return accessToken !== undefined;
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

/** Uses the refresh cookie to get a new access token; false when signed out. */
export async function refreshSession(): Promise<boolean> {
  const response = await send('/auth/refresh', { method: 'POST' });
  if (!response.ok) {
    setAccessToken(undefined);
    return false;
  }
  setAccessToken(((await response.json()) as AccessToken).accessToken);
  return true;
}

/** Calls the API; on 401 it refreshes once and retries. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await send(path, init);
  if (response.status === 401 && path !== '/auth/refresh' && (await refreshSession())) {
    response = await send(path, init);
  }
  if (!response.ok) throw new ApiError(response.status);
  return (response.status === 204 ? undefined : await response.json()) as T;
}
