# Research: Session-refresh reliability

## Current behaviour (verified 2026-10-21 on `main` at `5940f09`)

- `apps/web/src/lib/api.ts:48-52`: every call that gets 401 calls `refreshSession()` on its own.
  A throwaway unit probe with two parallel 401s counted **2** refresh requests (expected 1).
- `apps/web/src/lib/session.tsx:28-32`: the restore effect calls `refreshSession()`; React
  StrictMode runs it twice in development, which sends two refreshes with one cookie.
- `apps/api/src/auth/session.service.ts:40-42`: a token already revoked, or one that loses the
  atomic `revokeIfActive`, calls `signOutEverywhere`. The second of two concurrent refreshes with
  one cookie therefore revokes every session of the user. The existing SE-07.2 test covers the
  sequential case; no test covers the concurrent case.
- `session.tsx` `signOut` does not wait for an in-flight refresh, and `refreshSession` sets the
  token whenever its response arrives, so a refresh that completes after logout re-arms the tab
  with a valid access token. A rejected refresh during an ordinary call drops the token but does
  not change the provider's status (the UI still says signed in).
- A network failure (`fetch` throws) during refresh rejects the call; a 5xx clears the token as
  if signed out.
- Web client logic has no unit tests (review T-1).

Conclusion: review C-1 is still current, and the logout and failure gaps above are real.

## Decisions

### D1. Coordinate in the client; keep the server strict

- **Decision**: single-flight per tab plus a cross-tab lock; no server change.
- **Rationale**: removes every self-inflicted reuse while keeping SE-07.2 exactly as approved.
- **Alternatives rejected**:
  - _Server grace window_ (accept the previous token for ~10 s and return the same successor,
    suggested as optional in the review): weakens replay detection exactly when an attacker races
    the user, needs the successor token stored or re-derivable, and changes an approved
    criterion. Not adopted; listed in the [backlog](../../docs/backlog.md) as a decision for the owner.
  - _Retry the call on a replay 401_: too late, the server has already revoked every session.

### D2. Cross-tab lock: Web Locks API

- **Decision**: `navigator.locks.request('heach-session-refresh', …)` around the refresh request.
- **Rationale**: built into supported browsers except iOS 15.0–15.3; released automatically when
  a tab closes or crashes; no dependency.
- **Alternatives rejected**: a `localStorage` mutex (no atomic compare-and-set, stale locks after a
  crash, and EN-11 discourages session data in storage); a `SharedWorker` owning the token
  (not on Safari iOS 15, much larger change); leader election via `BroadcastChannel` (complex,
  same browser support).
- **Fallback**: without `navigator.locks` the refresh runs unlocked; in-tab guarantees still hold.

### D3. Cross-tab sign-out: `BroadcastChannel`

- **Decision**: channel `heach-session`; message `{ type: 'signed-out' }` only.
- **Rationale**: same-origin only, carries no secret, no dependency; the `storage` event would
  need a storage write (EN-11).
- **Fallback**: without it, another tab notices at its next refresh (cookie cleared → 401).

### D4. Stale results: session epoch

- **Decision**: a counter incremented whenever the session ends or a new sign-in starts; a refresh
  result or retried response is applied only if the epoch is unchanged since it started.
- **Rationale**: simplest way to make logout final regardless of response order.

### D5. Network and server failures

- **Decision**: refresh outcome is `ok`, `rejected` (401) or `failed` (network error or non-401
  failure). Only `rejected` ends the session; `failed` keeps the token and surfaces an error to the
  caller. No automatic retry.
- **Rationale**: a lost connection is not a sign-out (spec SE-07.9); retries are left to the user
  to avoid loops.

### D6. A 401 after another call already refreshed

- **Decision**: a call remembers the access token it sent; on 401, if the tab's token has changed
  since, it retries with the new token without refreshing.
- **Rationale**: a 401 that arrives after another call's refresh completed must not trigger a
  second rotation (SE-07.5 counts exactly one refresh).

### D7. Logout ordering

- **Decision**: `signOut` waits for any in-flight refresh, calls logout with the current token, and
  ends the session locally (epoch, token, status, broadcast) whether or not the call succeeded.
- **Rationale**: the server revokes the session the refresh produced (SE-07.10); a failed logout
  call must still leave the device signed out locally.
