# Research: Transactional session rotation and replay handling

Inputs: [spec 001 analysis](../001-session-refresh-reliability/analysis.md) F1 and F2; review S-2
note and C-1 (`docs/reviews/2026-10-18-codebase-review.md`, not committed); Step 2 spec SE-07.1 to
SE-07.4; backlog item 3; code on `main` at 7c8c1c9.

## Current behaviour (read 2026-10-22, `main` 7c8c1c9)

- `SessionService.refresh` (`apps/api/src/auth/session.service.ts:33-48`): `findByHash` on the
  pool; if found and unexpired, `revokeIfActive` (one `UPDATE … WHERE revoked_at IS NULL`, rowCount
  decides the winner); then `issue` runs `sessions.create` (a second pool statement) and
  `accessTokens.issue` (Redis `MULTI`). Three independent steps, no transaction.
- A failure in `sessions.create` or `accessTokens.issue` leaves the old session revoked and returns
  500: the user has lost the session.
- `AuthController.refresh` (`auth.controller.ts:41-46`) clears the refresh cookie on every thrown
  error, including 500. So even a client that keeps the session on 5xx (spec 001 SE-07.9) has no
  cookie to retry with.
- Concurrent replay: request A wins `revokeIfActive`; request B loses it and calls
  `signOutEverywhere`, which revokes all session rows and every access token in `user-at:<user>`
  at that moment. A then inserts its new session and issues its access token afterwards, so both
  survive. `auth.int-spec.ts` SE-07.13 says so in a comment and does not assert the winner.
- `AuthGuard` resolves an access token from Redis only (`at:<hash>`); it never reads
  `app.session`. A surviving access token therefore works for up to 15 minutes even if its
  session row is revoked.
- `AccessTokenStore.issue` adds the hash to `user-at:<user>` in the same `MULTI` as the token, so a
  later `revokeAllForUser` finds it.
- Pool: `pg.Pool`, max 10, connection timeout 1 s. Redis: `maxRetriesPerRequest: 1`.

## Decisions

### D-1 One transaction per rotation, with a row lock (owner to confirm)

- **Decision**: `refresh` runs inside spec 003's `withTransaction`: `SELECT … FOR UPDATE` the
  session by token hash, check expiry and `revoked_at`, `UPDATE` it revoked, `INSERT` the new
  session, issue the access token in Redis, then `COMMIT`.
- **Why**: all-or-nothing gives SE-07.14 and SE-07.15. The lookup joins `app.user_test`, and a
  plain `FOR UPDATE` locks the matching rows of both tables, so every refresh of one user (any
  device) and every replay path is serialised on the user row. D-2 needs that: a replay must not
  run while another rotation of the same user is half done. Sign-out of all devices takes the same
  user-row lock (`SELECT … FROM app.user_test WHERE id = $1 FOR UPDATE`) before revoking, which
  gives SE-07.20. Per-user serialisation costs nothing measurable at one user's request rate.
- **Alternatives**: (a) keep the conditional `UPDATE` and add compensation (un-revoke on failure):
  racy and harder to prove; rejected. (b) `SERIALIZABLE` isolation with retries: more failure modes
  for one row; rejected.

### D-2 A concurrent replay waits, then revokes everything including the winner's output

- **Decision**: the second use blocks on the row lock until the first commits, then sees
  `revoked_at` set and runs the replay path (revoke all session rows for the user, then all access
  tokens in `user-at:<user>`). Because the first use committed its new session row and issued its
  access token **before** commit, both are visible to the replay path.
- **Why**: closes F1 without reading the session row in the guard and without a new key scheme.
- **Alternatives**: (a) revoke by `family_id` and check the family in the guard: needs a guard
  change and a Redis read per request; rejected for now. (b) re-run revocation after a delay:
  timing-based; rejected.

### D-3 Access token issued inside the transaction window; revoked if the commit fails

- **Decision**: issue the access token after the `INSERT` and before `COMMIT`. If `COMMIT` fails,
  revoke that token best effort before rethrowing. If Redis fails, the transaction rolls back.
- **Why**: ordering required by D-2; a Redis failure must not leave a committed rotation with no
  token returned (that would sign the user out on the next refresh as a replay).
- **Cost**: the session row lock (not the audit lock) is held across one Redis round trip. Bounded
  by `SET LOCAL lock_timeout = '5s'` so a waiting replay cannot hang a connection indefinitely.

### D-4 Clear the cookie only on 401

- **Decision**: the controller clears `heach_refresh` only when the error is an
  `UnauthorizedException`; every other error is rethrown without touching the cookie.
- **Why**: only 401 means "session over" (the contract spec 001 already gives the client).

### D-5 No grace window

- **Decision**: unchanged strict detection. A lost response (commit succeeded, client never got
  the new cookie) still makes the next use a replay.
- **Why**: owner's standing decision (backlog); a grace window needs its own approved spec.

## Rejected for this feature

- Moving access tokens into PostgreSQL or making them signed JWTs: architecture change, needs an
  ADR.
- Auditing refreshes: not Restricted data; see spec Out of scope.
