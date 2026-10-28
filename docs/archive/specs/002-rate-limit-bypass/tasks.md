---
description: 'Tasks for the rate-limit bypass fix'
---

# Tasks: Rate-limit bypass with fake bearer tokens

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/)

**Prerequisites**: spec.md and plan.md merged as Approved (constitution gate G2). Nothing below
starts before that. Implementation branch: `fix/002-rate-limit-bypass`.

**Tests**: every criterion SO-08.4 to SO-08.11 has a test task whose title starts with its ID.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [x] T001 Add `RATE_LIMIT_WINDOW_SECONDS` (integer ≥ 1, default 60) to apps/api/src/config/env.schema.ts and a commented placeholder to .env.example; use it as the default throttler's `ttl` in apps/api/src/security/security.module.ts (research D-5). No behaviour change at the default

---

## Phase 2: Foundational (blocks every story)

- [x] T002 Create apps/api/test/rate-limit.int-spec.ts with helpers: boot with a small limit, send N requests with a chosen header set and `X-Forwarded-For` client address, collect statuses; a random-token helper (`randomBytes`, generated at run time). Sign-ins for setup use a separate `X-Forwarded-For` address from the one under test, so setup requests do not use up the tested allowance
- [x] T003 Create apps/api/src/security/user-throttler.guard.spec.ts with an `AccessTokenStore` double (resolves, returns undefined, throws) and a request builder

**Checkpoint**: test scaffolding in place; stories can start.

---

## Phase 3: User Story 1 - Fake tokens cannot escape the limit (P1) 🎯 MVP

**Goal**: anything that is not a live session is counted by client address.

### Tests (write first; they fail before implementation)

- [x] T004 [P] [US1] `SO-08.4 random, expired and revoked bearer tokens are counted by address` on `POST /v1/auth/refresh` and `GET /v1/sample/notes` in apps/api/test/rate-limit.int-spec.ts (expired: delete the `at:` key; revoked: log out); send 10 × N requests and assert at least 9 × N are 429 (SC-001)
- [x] T005 [P] [US1] `SO-08.5 malformed Authorization headers are counted by address` (wrong scheme, 19 characters, bad characters, empty) in rate-limit.int-spec.ts
- [x] T006 [P] [US1] `SO-08.8 many fake tokens give one tracker` in user-throttler.guard.spec.ts, and `SO-08.8 storage size does not grow with fake tokens` (10 and 1,000 requests, SC-002) in rate-limit.int-spec.ts
- [x] T007 [US1] Run T004 to T006 against the current guard and record that they fail (regression proof) in the Evidence section below

### Implementation

- [x] T008 [US1] Inject `AccessTokenStore` into `UserThrottlerGuard` and make `getTracker` async: `user:<userId>` for a resolved principal, otherwise `ip:<req.ip>` in apps/api/src/security/user-throttler.guard.ts (contracts/rate-limit.md counting rule); register the guard's dependency in app.module.ts or security.module.ts without changing guard order

**Checkpoint**: S-1 closed.

---

## Phase 4: User Story 2 - Signed-in users are limited as one user (P1)

### Tests

- [x] T009 [P] [US2] `SO-08.6 one user's tokens share one allowance` (two `login` sessions of one synthetic user, both on one route) in rate-limit.int-spec.ts
- [x] T010 [P] [US2] `SO-08.7 users and anonymous traffic at one address do not limit each other` (one route) in rate-limit.int-spec.ts

### Implementation

- [x] T011 [US2] No code beyond T008 expected; fix T008 if T009 or T010 fail

---

## Phase 5: User Story 3 - Limits are honest, recover, and leak nothing (P2)

### Tests

- [x] T012 [P] [US3] `SO-08.9 a 429 has Retry-After and a generic body, logs nothing sensitive, and recovers after the window` with `RATE_LIMIT_WINDOW_SECONDS=1`: assert header range, body has no token, address or user ID, captured request log lines contain none of them, and a request after the window succeeds, in rate-limit.int-spec.ts
- [x] T013 [P] [US3] `SO-08.10 a client-supplied X-Forwarded-For does not choose the address` (varying first entries, fixed last entry reaches 429) in rate-limit.int-spec.ts
- [x] T014 [P] [US3] `SO-08.11 a session-store failure counts by address` (store double throws) in user-throttler.guard.spec.ts
- [x] T015 [US3] scripts/rate-limit-check.sh `<base-url>`: 150 requests to `/api/v1/auth/refresh`, each with a random bearer token and random `X-Forwarded-For`, exit non-zero unless at least one response is a 429 with the API's JSON error body (`ThrottlerException`, not Caddy's empty 429) and none of the first 100 is a 429; no secrets, tokens generated at run time (SO-08.10)
- [x] T016 [US3] Run scripts/rate-limit-check.sh in the deploy-bundle job of .github/workflows/ci.yml just before "Caddy rate limits the API per client IP" (its 61-second wait then covers both)

### Implementation

- [x] T017 [US3] Make sure a lookup error in `getTracker` is caught and falls back to the address without logging (T014)

---

## Phase 6: Verification and status

- [x] T018 Existing `SO-08.1` test in apps/api/test/security.int-spec.ts still passes unchanged
- [x] T019 `pnpm check`, `pnpm --filter @heach/api test:e2e`, `node scripts/check-specs.mjs`, `pnpm test:scripts`, gitleaks; types unchanged (`pnpm --filter @heach/types check`)
- [x] T020 Update docs/implementation-status.md (SO-08 row: what exists, evidence, remaining gaps: shared counters, SE-08 OTP limits), docs/backlog.md (item 1 Done; add the shared-counter item) and docs/specs/README.md row
- [x] T021 (PR #64 opened; `/speckit-converge` followed by hand: Phase 7 below) `/speckit-converge`; record evidence below; open the code PR with `Spec:` and `Criteria: SO-08.4 to SO-08.11` lines

## Phase 7: Convergence

Added by `/speckit-converge` (followed by hand from its SKILL.md, 22 October 2026). Every criterion
SO-08.4 to SO-08.11, success criterion SC-001 to SC-003 and plan decision D-1 to D-7 is met in the
code; three edge cases of the spec had no direct test.

- [x] T022 Add a test that the health probes stay exempt when the request carries fake tokens, in apps/api/test/rate-limit.int-spec.ts per spec edge case "Routes that skip the limit today" (partial)
- [x] T023 Add a test that a valid token on a public route (`auth/refresh`) is counted by user, not by address, per spec edge case "A valid token on a public route" (partial)
- [x] T024 Add a test that a wrong-role caller is counted before it is refused with 403, so it reaches 429, per spec edge case "A valid token whose role does not match the route" (partial)

---

## Dependencies & Execution Order

- T001 → T012 (needs the window setting). T002, T003 → all test tasks.
- Tests T004 to T006 → T007 (fail first) → T008.
- T008 → T009 to T014 can pass; T015 → T016.
- Stories 2 and 3 depend on T008 only; within a phase, [P] tasks touch different test cases and
  can be written in parallel.
- Phase 6 last.

## Evidence

Recorded 22 October 2026 on branch `fix/002-rate-limit-bypass`, local services under their own
compose project (PostgreSQL 18 and Redis 8 with TLS, as `pnpm services:up`).

### Regression proof (T007): the same tests, run against the guard on `main`

| Run                                                                 | Before the fix (`UserThrottlerGuard` from `main`)                                                                        | After the fix                                                                                                                                                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit `user-throttler.guard.spec.ts`                                 | 5 of 12 fail: SO-08.4 (live-session lookup), SO-08.6, SO-08.8, SO-08.11 (store rejects, store throws)                    | 12 of 12 pass                                                                                                                                                                              |
| Integration `rate-limit.int-spec.ts`                                | 9 of 14 fail: SO-08.4 random, expired and revoked on both routes (6), SO-08.8, SO-08.6, SO-08.10 (varying first entries) | 17 of 17 pass (14 plus the 3 convergence tests; 9 of the first 14 fail before the fix); the API integration suite is 88 of 88 (13 files), with SO-08.1 in `security.int-spec.ts` unchanged |
| SC-001, 10 × N = 50 requests with new random tokens, limit 5        | 0 of 50 refused (at least 45 required)                                                                                   | 45 of 50 refused (the first 5 served)                                                                                                                                                      |
| SC-002, limiter counters after fake-token requests from one address | 10 requests: 10; 1,010 requests: 1,010 (one per token)                                                                   | unchanged between 10 and 1,010 requests                                                                                                                                                    |
| Deploy bundle through Caddy, `scripts/rate-limit-check.sh`          | API image built from `main`'s guard: `requests=150 api_429=0`, exit 1                                                    | fixed image: `requests=150 api_429=30 early_429=0`, exit 0 (run twice)                                                                                                                     |

Tests that pass both before and after by design, because they pin behaviour that must not change:
SO-08.5 (malformed headers were already counted by address), SO-08.7 (users and anonymous traffic
stay separate), SO-08.10 last-entry rule, SO-08.9 (429 body, `Retry-After`, logs, recovery).

### Checks run (T018, T019)

- `pnpm check`: lint, typecheck, unit tests, build, `lint:scripts`, `test:scripts` (42 script tests, 5 new for `rate-limit-check.sh`): pass
- `pnpm --filter @heach/api test:e2e`: 88 of 88 pass
- `node scripts/check-changed-coverage.mjs HEAD^1` with the API coverage run: 100% (11 of 11 changed lines), gate 80%
- `node scripts/check-specs.mjs`, `pnpm format:check`: pass; `pnpm --filter @heach/types check`: generated types up to date (no OpenAPI change)
- `pnpm secrets:scan` (gitleaks, whole history) and the commit hook scan: no leaks
- Semgrep (CI's pinned image and rules, run over `apps/api` and `scripts`): exit 0
- Deploy bundle built from this branch (api, admin and web images, Caddy in front, throwaway passwords): `/api/readyz` ok, `rate-limit-check.sh` passes

### Notes

- Cases that sign in as a shared synthetic user each boot a fresh app: the allowance is now per
  user, so cases would otherwise use up each other's.
- The request log line carries method, route, status and duration only; SO-08.9 captures the
  logger's calls and finds no token, address or user ID.
- `test/capture-output.ts` patches `process.stdout.write`, which the logger (pino on a file
  descriptor) bypasses; the log assertion in `sample-notes.int-spec.ts` therefore cannot see
  request logs. Not changed here; reported as follow-up.
- `/speckit-converge` was followed by hand from its SKILL.md: three edge-case tests were missing (T022 to T024, Phase 7) and are added; a second pass finds nothing further.
