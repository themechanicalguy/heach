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

- [ ] T001 Add `RATE_LIMIT_WINDOW_SECONDS` (integer ≥ 1, default 60) to apps/api/src/config/env.schema.ts and a commented placeholder to .env.example; use it as the default throttler's `ttl` in apps/api/src/security/security.module.ts (research D-5). No behaviour change at the default

---

## Phase 2: Foundational (blocks every story)

- [ ] T002 Create apps/api/test/rate-limit.int-spec.ts with helpers: boot with a small limit, send N requests with a chosen header set and `X-Forwarded-For` client address, collect statuses; a random-token helper (`randomBytes`, generated at run time). Sign-ins for setup use a separate `X-Forwarded-For` address from the one under test, so setup requests do not use up the tested allowance
- [ ] T003 Create apps/api/src/security/user-throttler.guard.spec.ts with an `AccessTokenStore` double (resolves, returns undefined, throws) and a request builder

**Checkpoint**: test scaffolding in place; stories can start.

---

## Phase 3: User Story 1 - Fake tokens cannot escape the limit (P1) 🎯 MVP

**Goal**: anything that is not a live session is counted by client address.

### Tests (write first; they fail before implementation)

- [ ] T004 [P] [US1] `SO-08.4 random, expired and revoked bearer tokens are counted by address` on `POST /v1/auth/refresh` and `GET /v1/sample/notes` in apps/api/test/rate-limit.int-spec.ts (expired: delete the `at:` key; revoked: log out); send 10 × N requests and assert at least 9 × N are 429 (SC-001)
- [ ] T005 [P] [US1] `SO-08.5 malformed Authorization headers are counted by address` (wrong scheme, 19 characters, bad characters, empty) in rate-limit.int-spec.ts
- [ ] T006 [P] [US1] `SO-08.8 many fake tokens give one tracker` in user-throttler.guard.spec.ts, and `SO-08.8 storage size does not grow with fake tokens` (10 and 1,000 requests, SC-002) in rate-limit.int-spec.ts
- [ ] T007 [US1] Run T004 to T006 against the current guard and record that they fail (regression proof) in the Evidence section below

### Implementation

- [ ] T008 [US1] Inject `AccessTokenStore` into `UserThrottlerGuard` and make `getTracker` async: `user:<userId>` for a resolved principal, otherwise `ip:<req.ip>` in apps/api/src/security/user-throttler.guard.ts (contracts/rate-limit.md counting rule); register the guard's dependency in app.module.ts or security.module.ts without changing guard order

**Checkpoint**: S-1 closed.

---

## Phase 4: User Story 2 - Signed-in users are limited as one user (P1)

### Tests

- [ ] T009 [P] [US2] `SO-08.6 one user's tokens share one allowance` (two `login` sessions of one synthetic user) in rate-limit.int-spec.ts
- [ ] T010 [P] [US2] `SO-08.7 users and anonymous traffic at one address do not limit each other` in rate-limit.int-spec.ts

### Implementation

- [ ] T011 [US2] No code beyond T008 expected; fix T008 if T009 or T010 fail

---

## Phase 5: User Story 3 - Limits are honest, recover, and leak nothing (P2)

### Tests

- [ ] T012 [P] [US3] `SO-08.9 a 429 has Retry-After and a generic body, logs nothing sensitive, and recovers after the window` with `RATE_LIMIT_WINDOW_SECONDS=1`: assert header range, body has no token, address or user ID, captured request log lines contain none of them, and a request after the window succeeds, in rate-limit.int-spec.ts
- [ ] T013 [P] [US3] `SO-08.10 a client-supplied X-Forwarded-For does not choose the address` (varying first entries, fixed last entry reaches 429) in rate-limit.int-spec.ts
- [ ] T014 [P] [US3] `SO-08.11 a session-store failure counts by address` (store double throws) in user-throttler.guard.spec.ts
- [ ] T015 [US3] scripts/rate-limit-check.sh `<base-url>`: 150 requests to `/api/v1/auth/refresh`, each with a random bearer token and random `X-Forwarded-For`, exit non-zero unless at least one 429 and the first 120 are not 429; no secrets, tokens generated at run time (SO-08.10)
- [ ] T016 [US3] Run scripts/rate-limit-check.sh in the deploy-bundle job of .github/workflows/ci.yml just before "Caddy rate limits the API per client IP" (its 61-second wait then covers both)

### Implementation

- [ ] T017 [US3] Make sure a lookup error in `getTracker` is caught and falls back to the address without logging (T014)

---

## Phase 6: Verification and status

- [ ] T018 Existing `SO-08.1` test in apps/api/test/security.int-spec.ts still passes unchanged
- [ ] T019 `pnpm check`, `pnpm --filter @heach/api test:e2e`, `node scripts/check-specs.mjs`, `pnpm test:scripts`, gitleaks; types unchanged (`pnpm --filter @heach/types check`)
- [ ] T020 Update docs/implementation-status.md (SO-08 row: what exists, evidence, remaining gaps: shared counters, SE-08 OTP limits), docs/backlog.md (item 1 Done; add the shared-counter item) and docs/specs/README.md row
- [ ] T021 `/speckit-converge`; record evidence below; open the code PR with `Spec:` and `Criteria: SO-08.4 to SO-08.11` lines

---

## Dependencies & Execution Order

- T001 → T012 (needs the window setting). T002, T003 → all test tasks.
- Tests T004 to T006 → T007 (fail first) → T008.
- T008 → T009 to T014 can pass; T015 → T016.
- Stories 2 and 3 depend on T008 only; within a phase, [P] tasks touch different test cases and
  can be written in parallel.
- Phase 6 last.

## Evidence

Filled in during implementation.
