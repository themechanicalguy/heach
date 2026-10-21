# Research: Rate-limit bypass with fake bearer tokens

Inputs: review S-1, T-3 and P-1 (`docs/reviews/2026-10-18-codebase-review.md`, not yet committed);
Step 2 spec SO-08.1, SO-08.2, D3 and the dependency table; ADR 0008 (one dev host); current code
on `main` at 0190912.

## Current behaviour (confirmed 2026-10-21)

- `apps/api/src/app.module.ts` registers `UserThrottlerGuard` before `AuthGuard`, so the limiter
  runs first on every route except the health probes (`@SkipThrottle`).
- `UserThrottlerGuard.getTracker` returns `token:<hash>` whenever the header matches
  `^Bearer [\w-]{20,}$`, without checking the token, and `ip:<req.ip>` otherwise.
- Storage is `@nestjs/throttler`'s default in-memory storage; one limit,
  `RATE_LIMIT_PER_MINUTE` (default 120), window fixed at 60 seconds; RUM overrides to 60.
- `app.set('trust proxy', 1)`: `req.ip` is the last `X-Forwarded-For` entry. On the dev host the
  API port is not published (`deploy/dev/compose.yml`); Caddy is the only way in and, with no
  `trusted_proxies` configured, replaces client-supplied forwarding headers with the real peer
  address.
- Caddy limits `/api/*` to 300 requests a minute per remote address before the API (SO-08.2).
- Probe (throwaway integration tests, deleted): limit 5; 20 requests to `POST /v1/auth/refresh` each
  with a new random 32-character token → 20 × 401, no 429. 8 requests without a header → 5 × 401,
  then 3 × 429. The bypass is real at the API; on the dev host it is capped by Caddy's 300 a minute
  per address. A 429 carries `Retry-After: 60` and the standard error body; requests with
  `X-Forwarded-For: <spoofed>, 10.1.1.1` share the `10.1.1.1` counter (last entry wins).
- The request log line has method, route template, status and duration only; no address or header.

## Decisions

### D-1 Counter storage: keep in memory (owner to confirm)

- **Decision**: keep the throttler's in-memory storage.
- **Why**: one API process per environment (ADR 0008), so counters are exact; no new failure mode
  (a Redis outage cannot switch limits off or fail every request); no dependency; smallest change.
  The bypass is a keying defect, not a storage defect.
- **Alternatives**: (a) a small custom `ThrottlerStorage` over the existing `ioredis` client
  (`INCR` + `PEXPIRE` in one `MULTI`): no new dependency, survives restarts, needed for a second
  process; adds a fail-open-or-closed decision on Redis errors. Deferred to a backlog item
  triggered by a second API process. (b) `@nest-lab/throttler-storage-redis`: a new dependency;
  rejected under the working rules when (a) is available.

### D-2 Key for a live session: user only

- **Decision**: `user:<userId>` for a token that resolves; no address counter for that request.
- **Why**: Indian mobile networks put many subscribers behind shared addresses; also counting by
  address would let one user or anonymous traffic limit every signed-in user there (SO-08.7). The
  address is still bounded at the edge by Caddy.
- **Alternative**: count both user and address (two named throttlers). Stricter per address but
  harms shared-address users; rejected.

### D-3 Key for everything else: address

- **Decision**: no header, malformed header, unknown, expired or revoked token, and lookup errors
  all use `ip:<req.ip>`.
- **Why**: the only key a client cannot mint freely. A lookup error falls to the stricter key
  rather than skipping the limit (SO-08.11).

### D-4 Lookup reuse

- **Decision**: the guard calls `AccessTokenStore.resolve` (the same store the authentication
  guard uses). It does not set `request.principal`; authentication stays solely in `AuthGuard`.
- **Why**: one source of truth for "live session"; keeps the guards' responsibilities separate.
  The second Redis read per authenticated request is accepted (sub-millisecond).
- **Alternative**: cache the principal on the request for `AuthGuard`. Saves one read but couples
  the guards and moves an authentication decision into the limiter; rejected for now.

### D-5 Configurable window

- **Decision**: add `RATE_LIMIT_WINDOW_SECONDS` (integer, at least 1, default 60). The RUM override
  keeps 60 seconds.
- **Why**: proves recovery (SO-08.9) in an integration test in about a second without fake timers
  inside Nest. Default behaviour unchanged.

### D-6 Allowance per route (owner to confirm; added 2026-10-22)

- **Decision**: keep `@nestjs/throttler`'s per-route keys (class, handler, throttler name and
  tracker), as Step 2 does today. "One allowance" in SO-08.6 means one per user per route.
- **Why**: unchanged Step 2 behaviour; a busy route (RUM sends batches) cannot block sign-in or
  notes for the same user. Caddy's 300 a minute per address bounds the total across `/api/*`.
- **Alternative**: one allowance per tracker across all routes (override `generateKey`). Stricter
  against a client spreading load over routes, but changes SO-08.1's meaning for every route and
  makes RUM traffic count against API calls; rejected for this fix.

### D-7 Lookup wait (added 2026-10-22)

- **Decision**: no extra timeout in the tracker. The shared Redis client already bounds a stalled
  command (`connectTimeout` 1 second, `maxRetriesPerRequest` 1); a rejection falls to the address
  (D-3). The request is counted only after the lookup finishes, so a stall delays it but never
  lets it through uncounted.
- **Alternative**: a separate shorter timeout (for example 250 ms) in the tracker. Adds a second
  timeout policy for one call site; not needed while `AuthGuard` waits on the same client anyway.

## Not changed

- Guard order, `trust proxy 1`, Caddy configuration, limit value, health-probe exemption, error
  filter. No grouping of IPv6 addresses by prefix (spec edge case).
