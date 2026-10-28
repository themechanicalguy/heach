# Contract: web client session module

Internal to `apps/web`; listed so review can check the implementation against it. Revised during
implementation (2026-10-21): `settleRefresh` became part of `signOutOfThisDevice`, which also
takes the cross-tab lock; behaviour in spec.md is unchanged.

## `apps/web/src/lib/api.ts`

| Export                         | Contract                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `api<T>(path, init?)`          | Sends the call with the current access token. On 401 (never for `/auth/refresh`): if the token changed since the call was sent, retries once with it; otherwise awaits `refreshSession()` and, on `ok`, retries once. Throws `ApiError(status)` for a non-OK final response; on refresh `failed` it rethrows the network error or throws `ApiError` with the refresh's status. A call never refreshes twice. |
| `refreshSession()`             | Returns `Promise<'ok' \| 'rejected' \| 'failed'>`. At most one refresh request per tab at a time (shared promise); across tabs, the request runs inside the Web Lock `heach-session-refresh` when available. On `ok` sets the token only if the epoch has not changed. On `rejected` ends the session (below). On `failed` changes nothing.                                                                  |
| `startSession(token)`          | Sign-in: epoch +1, sets the token.                                                                                                                                                                                                                                                                                                                                                                           |
| `endSession()`                 | Epoch +1, drops the token, notifies listeners, broadcasts `signed-out`. Idempotent.                                                                                                                                                                                                                                                                                                                          |
| `signOutOfThisDevice()`        | Waits for this tab's in-flight refresh, then, under the same cross-tab lock, calls logout (`allDevices: false`); on 401 it refreshes once without the lock and retries. Ends the session locally (`endSession`) in `finally`. Running under the lock makes the logout's cookie clearing the last cookie write, even if another tab was refreshing (SE-07.10).                                                |
| `onSessionEnded(listener)`     | Called when the session ends in this tab or another; returns an unsubscribe function.                                                                                                                                                                                                                                                                                                                        |
| `ApiError`, `hasAccessToken()` | Unchanged.                                                                                                                                                                                                                                                                                                                                                                                                   |

`setAccessToken` is replaced by `startSession` and `endSession`.

## `apps/web/src/lib/session.tsx`

| Member                     | Contract                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| Restore on mount           | One `refreshSession()` (shared across a double start); `ok` → `signed-in`, otherwise `signed-out`. |
| `signInAsTestUser(userId)` | Unchanged call; uses `startSession`.                                                               |
| `signOut()`                | `await signOutOfThisDevice()`; status `signed-out`.                                                |
| Session end                | Subscribes to `onSessionEnded`; sets `signed-out`.                                                 |

## Cross-tab channel

`BroadcastChannel('heach-session')`, message `{ type: 'signed-out' }` only; see
[data-model.md](../data-model.md).
