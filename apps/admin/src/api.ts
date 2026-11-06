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

/** Sends with the access token; on 401 refreshes once and retries once. */
async function authorised(path: string, init: RequestInit): Promise<Response> {
  let response = await send(path, init);
  if (response.status === 401 && !path.startsWith('/auth/') && (await refresh())) {
    response = await send(path, init);
  }
  if (!response.ok) throw await errorFrom(response);
  return response;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await authorised(path, init);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/**
 * Saves a file the API serves to signed-in admins. A plain link cannot send the in-memory access
 * token, so the file is fetched and handed to the browser as a Blob.
 */
export async function download(path: string, fileName: string): Promise<void> {
  const blob = await (await authorised(path, {})).blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Revoked a moment later: some browsers start the download after click() returns.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1_000);
}

/** The reason for a failure, as a key of `errors` in the catalogue; never the response body. */
export function errorReason(error: unknown, known: readonly string[]): string {
  if (error instanceof ApiError) {
    if (error.code && known.includes(error.code)) return error.code;
    return error.status === 403 ? 'forbidden' : 'generic';
  }
  return error instanceof TypeError ? 'network' : 'generic';
}
