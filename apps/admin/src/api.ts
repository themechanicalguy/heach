/** Admin API calls with an in-memory access token and the admin refresh cookie (SE-04). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`API responded ${String(status)}`);
    this.name = 'ApiError';
  }
}

let accessToken: string | undefined;
let refreshing: Promise<boolean> | undefined;
let onSessionEnded: (() => void) | undefined;

// The refresh cookie is shared by every tab and rotates on use; a second tab sending the old
// one would look like a replay and end the session everywhere (SE-07.5, SE-07.6).
const REFRESH_LOCK = 'heach-admin-refresh';

export function setAccessToken(token: string | undefined): void {
  accessToken = token;
}

/** Called once the refresh cookie is refused, so the console can return to sign-in. */
export function whenSessionEnds(listener: (() => void) | undefined): void {
  onSessionEnded = listener;
}

function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('x-correlation-id', crypto.randomUUID());
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  if (init.body) headers.set('content-type', 'application/json');
  return fetch(`/api/admin/v1${path}`, {
    ...init,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });
}

/** Runs the task under the cross-tab lock where the browser has one. */
function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  return locks ? locks.request(REFRESH_LOCK, task) : task();
}

async function requestRefresh(): Promise<boolean> {
  const response = await send('/auth/refresh', { method: 'POST' });
  if (response.status === 401) {
    accessToken = undefined;
    onSessionEnded?.();
    return false;
  }
  if (!response.ok) throw await errorFrom(response);
  accessToken = ((await response.json()) as { accessToken: string }).accessToken;
  return true;
}

/**
 * Restores or extends the session from the refresh cookie: one refresh at a time in this tab and
 * across tabs. False only when the cookie is refused; an outage throws instead.
 */
export function refresh(): Promise<boolean> {
  refreshing ??= withRefreshLock(requestRefresh).finally(() => {
    refreshing = undefined;
  });
  return refreshing;
}

async function errorFrom(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => ({}))) as { code?: unknown };
  return new ApiError(response.status, typeof body.code === 'string' ? body.code : undefined);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await send(path, init);
  if (response.status === 401 && !path.startsWith('/auth/') && (await refresh())) {
    response = await send(path, init);
  }
  if (!response.ok) throw await errorFrom(response);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/** The reason for a failure, as a key of `errors` in the catalogue; never the response body. */
export function errorReason(error: unknown, known: readonly string[]): string {
  if (error instanceof ApiError) {
    if (error.code && known.includes(error.code)) return error.code;
    return error.status === 403 ? 'forbidden' : 'generic';
  }
  return error instanceof TypeError ? 'network' : 'generic';
}
