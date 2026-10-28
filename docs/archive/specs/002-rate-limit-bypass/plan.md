# Implementation Plan: Rate-limit bypass with fake bearer tokens

**Status**: Approved

**Spec**: [spec.md](spec.md) | **Date**: 2026-10-21 | **Approval**: Owner (Saurav Rath), 2026-10-22, explicit approval of this plan and its spec, with decisions D-1 to D-7 as written; takes effect when the owner merges this docs-only pull request

**Input**: Feature specification from `specs/002-rate-limit-bypass/spec.md`

## Summary

Fix review finding S-1 in the API's rate-limit tracker. `UserThrottlerGuard.getTracker` stops
trusting the shape of the bearer token: it looks the token up in the existing `AccessTokenStore`
and returns `user:<userId>` only for a live session; for no, malformed, unknown, expired or
revoked tokens, and when the lookup fails, it returns `ip:<req.ip>`. The guard order, the
in-memory throttler storage, the single limit and the proxy setting stay as in Step 2; a window
setting is added so tests can prove recovery. Counters stay per route, as in Step 2 (D-6). New integration tests prove the bypass is closed
(review T-3), and a deploy-bundle check proves it through Caddy. Decisions and rejected
alternatives: [research.md](research.md).

## Technical Context

**Apps and packages touched**: `apps/api` (`src/security/user-throttler.guard.ts`,
`src/security/security.module.ts`, `src/config/env.schema.ts`, new unit and integration tests);
`scripts/rate-limit-check.sh` (new) and `.github/workflows/ci.yml` (run it in the deploy-bundle
job); `.env.example` (document the new optional setting).

**New dependencies**: None. `@nestjs/throttler` 6.7.1 (already in the stack) supports an async
tracker; the token lookup reuses `AccessTokenStore` over the existing `ioredis` client.

**Storage**: None added. Counters stay in `@nestjs/throttler`'s in-memory storage (decision D-1).
The lookup reads the existing `at:<hash>` Redis key; nothing is written.

**Third parties**: None.

**Constraints**: One API process on the dev host behind one Caddy (ADR 0008). One extra Redis `GET`
per request that carries a well-formed bearer token (the authentication guard does its own lookup
afterwards, as today); sub-millisecond on the local network.

## Constitution Check

_GATE: Must pass before research. Re-check after design._ Re-checked after design: unchanged.

| Principle                               | How this plan meets it                                                                                                                | Violation and justification |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| I Spec before code                      | No application code until this spec and plan merge as Approved; this pull request is docs only                                        | None                        |
| II Traceable criteria                   | SO-08.4 to SO-08.11, each with a named test or CI check (Verification below)                                                          | None                        |
| III Data protection                     | Rate limiting still runs before authentication and authorisation (SE-02.1); no data stored; lookup is read-only                       | None                        |
| IV Synthetic data, logs, secrets        | Tests use the seeded synthetic users and random tokens generated at run time; no logging added; counter keys never logged or returned | None                        |
| V Languages, accessibility, performance | No strings or screens; one Redis read per bearer request                                                                              | None                        |
| VI Architecture, reuse, dependencies    | Extends the existing guard; reuses `AccessTokenStore`, `trust proxy` and the throttler; no new dependency or module                   | None                        |
| VII Evidence-based completion           | Implementation status updated with test evidence in the implementation pull request                                                   | None                        |
| VIII Changes and exceptions             | Refines SO-08.1 without changing it; single-process counters recorded as an assumption with a backlog item                            | None                        |
| IX Humans approve                       | Owner approves by merging; agent leaves Status Draft                                                                                  | None                        |

## Project Structure

### Documentation (this feature)

```text
specs/002-rate-limit-bypass/
├── spec.md              # Behaviour
├── plan.md              # This file
├── research.md          # Decisions D-1 to D-5 and rejected alternatives
├── data-model.md        # Counter keys (no stored data)
├── quickstart.md        # How to run the proofs
├── contracts/
│   └── rate-limit.md    # 429 response, headers, counting rule, configuration
├── checklists/
│   └── requirements.md
├── analysis.md          # Consistency analysis
└── tasks.md
```

### Source Code (repository root)

```text
apps/api/src/security/user-throttler.guard.ts       # tracker: live session → user, else IP
apps/api/src/security/user-throttler.guard.spec.ts  # new: SO-08.8, SO-08.11 (store double)
apps/api/src/security/security.module.ts            # window from config
apps/api/src/config/env.schema.ts                   # RATE_LIMIT_WINDOW_SECONDS (default 60)
apps/api/test/rate-limit.int-spec.ts                # new: SO-08.4 to SO-08.10
apps/api/test/security.int-spec.ts                  # SO-08.1 test unchanged
scripts/rate-limit-check.sh                         # new: SO-08.10 through Caddy
.github/workflows/ci.yml                            # deploy-bundle job runs it before the Caddy flood
.env.example                                        # documents RATE_LIMIT_WINDOW_SECONDS
```

## Data model and migrations

None. No table, column, Redis key or browser storage is added. Counter keys are described in
[data-model.md](data-model.md).

## Encryption and keys

None. No new data. Token lookup hashes the token exactly as the authentication guard does
(`hashToken`); the raw token is never stored or logged.

## API contracts

No endpoint, DTO or OpenAPI change; the generated client is unchanged. The behaviour every limited
route shares (counting rule, 429 response, headers, configuration) is in
[contracts/rate-limit.md](contracts/rate-limit.md).

## Audit, logging and monitoring

- No audit events (spec Audit and consent).
- No new log lines. The existing request log line (method, route template, status, duration)
  records 429s; it never contains the token, the address or the user ID (SO-08.9).
- A failed token lookup is not logged by the tracker (the authentication guard's own failure, if
  any, is logged as today without detail).
- The LM-07.1 error-rate monitor counts 5xx only; 429s do not raise alerts. Rate-limit alerts are
  out of scope.

## Threat model

Assets: API availability; the public endpoints (`auth/refresh`, `rum`, and OTP sign-in in Step 3)
that are reachable without an access token. Entry point: any HTTPS request to `/api/*` through
Caddy.

| Threat                                                                                                                               | Mitigation                                                                                                                                 | Criterion        |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| Denial of service: a new random bearer token on each request gets a fresh allowance (S-1)                                            | Count by user only for a token that resolves to a live session; otherwise by client address                                                | SO-08.4, SO-08.8 |
| Denial of service: malformed `Authorization` header to change the counting key                                                       | Anything that is not a live session is counted by address                                                                                  | SO-08.5          |
| Denial of service: one account signs in many times to collect tokens and allowances                                                  | Count by user ID, not by token                                                                                                             | SO-08.6          |
| Spoofing: client-supplied `X-Forwarded-For` picks a new address each request                                                         | API trusts exactly one proxy hop; Caddy appends the real address and does not trust client headers                                         | SO-08.10         |
| Denial of service: session store outage turns the limit off                                                                          | Lookup failure falls back to the address key                                                                                               | SO-08.11         |
| Denial of service against others: one user's or anonymous traffic exhausts a shared address's allowance for signed-in users          | Signed-in requests are counted by user only                                                                                                | SO-08.7          |
| Denial of service: a flood of well-formed fake tokens turns into session-store reads (one lookup per request, refused ones included) | Accepted: one Redis `GET` per request, bounded by Caddy's 300 a minute per address                                                         | SO-08.4          |
| Denial of service: a stalled session store holds requests in the tracker                                                             | Bounded by the shared Redis client (1 s connect timeout, one retry); the request is counted before it is served, by address on error (D-7) | SO-08.11         |
| Denial of service: a client spreads requests over many routes to get N on each                                                       | Accepted (Step 2 behaviour, D-6): bounded by Caddy's 300 a minute per address across `/api/*`                                              | SO-08.4          |
| Memory exhaustion: unbounded counters from unique tokens                                                                             | One counter per address and route for unauthenticated traffic; counters expire with the window                                             | SO-08.8          |
| Information disclosure: 429 response or logs reveal the token, address or user                                                       | Generic error body; counter key never logged or returned                                                                                   | SO-08.9          |
| Timing side channel: whether a token is live changes the counting key                                                                | Accepted: the response status already tells a token holder whether it is live (401 vs 200); the tracker adds no new information            | SO-08.4          |
| Elevation of privilege via tracker                                                                                                   | Tracker only chooses a counter; authentication and roles are still checked by the authentication guard afterwards (SE-02.1 unchanged)      | SO-08.6          |

## Rollout

One API release; no flag (a security fix with no user-visible change for honest clients). No
migration. Rollback is a redeploy of the previous image. After deploy, the deploy-bundle check
(SO-08.10) runs in CI on every pull request; on the dev host, `scripts/rate-limit-check.sh
<host>` can be run by hand; it uses up the caller's API allowance for one window.

## Verification

| Criterion          | Test or check                                                                                                                                                                                                                                                                                             | Where it runs                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| SO-08.4            | `apps/api/test/rate-limit.int-spec.ts` "SO-08.4 …" (public `auth/refresh` and protected `sample/notes`, random, expired and revoked tokens)                                                                                                                                                               | CI Checks job (integration)          |
| SO-08.5            | `rate-limit.int-spec.ts` "SO-08.5 …" (wrong scheme, short, bad characters, empty)                                                                                                                                                                                                                         | CI Checks job                        |
| SO-08.6            | `rate-limit.int-spec.ts` "SO-08.6 …" (two sessions of one user)                                                                                                                                                                                                                                           | CI Checks job                        |
| SO-08.7            | `rate-limit.int-spec.ts` "SO-08.7 …" (two users plus anonymous, one address)                                                                                                                                                                                                                              | CI Checks job                        |
| SO-08.8            | `user-throttler.guard.spec.ts` "SO-08.8 …" (tracker returns one key for many fake tokens); `rate-limit.int-spec.ts` (storage size constant for 10 and 1,000 fake-token requests, SC-002)                                                                                                                  | CI Checks job (unit and integration) |
| SO-08.9            | `rate-limit.int-spec.ts` "SO-08.9 …" (`RATE_LIMIT_WINDOW_SECONDS=1`: header, body, log capture, recovery)                                                                                                                                                                                                 | CI Checks job                        |
| SO-08.10           | `rate-limit.int-spec.ts` "SO-08.10 …" (spoofed `X-Forwarded-For` lists); `scripts/rate-limit-check.sh` through Caddy (150 requests: above the API's 120, below Caddy's 300, so any 429 is the API's), run in the deploy-bundle job just before the existing Caddy flood so its 61-second wait clears both | CI Checks job; CI Deploy bundle job  |
| SO-08.11           | `user-throttler.guard.spec.ts` "SO-08.11 …" (store double that throws)                                                                                                                                                                                                                                    | CI Checks job (unit)                 |
| SO-08.1 to SO-08.3 | Existing `security.int-spec.ts`, unchanged                                                                                                                                                                                                                                                                | CI Checks job                        |
| Regression proof   | With the current tracker, SO-08.4, SO-08.6 and SO-08.8 fail (recorded in tasks.md evidence)                                                                                                                                                                                                               | Local, once                          |

## Complexity Tracking

None. No principle is violated.
