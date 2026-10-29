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

export function setAccessToken(token: string | undefined): void {
  accessToken = token;
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

/** Restores or extends the session from the refresh cookie; one refresh at a time. */
export function refresh(): Promise<boolean> {
  refreshing ??= send('/auth/refresh', { method: 'POST' })
    .then(async (response) => {
      if (!response.ok) return false;
      accessToken = ((await response.json()) as { accessToken: string }).accessToken;
      return true;
    })
    .finally(() => {
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
