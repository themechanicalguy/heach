---
description: 'Tasks for session-refresh reliability'
---

# Tasks: Session-refresh reliability

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/)

**Prerequisites**: spec.md and plan.md merged as Approved (constitution gate G2). Nothing below
starts before that.

**Tests**: every criterion SE-07.5 to SE-07.13 has a test task whose title starts with its ID.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

None: no flag, strings, migration or dependency.

---

## Phase 2: Foundational (blocks every story)

- [x] T001 Write failing tests first for the client contract in apps/web/src/lib/api.test.ts: a `fetch` stub with controllable timing, a `navigator.locks` double that records overlap, and a `BroadcastChannel` double
- [x] T002 Rework apps/web/src/lib/api.ts per [contracts/client-session.md](contracts/client-session.md): `refreshSession()` returning `ok`/`rejected`/`failed` with a shared in-flight promise, `startSession`, `endSession`, `settleRefresh`, `onSessionEnded`, epoch, Web Lock and `BroadcastChannel` with fallbacks; replace `setAccessToken`

**Checkpoint**: api.ts contract in place; stories can start.

---

## Phase 3: User Story 1 - Parallel requests survive token expiry (P1) 🎯 MVP

**Goal**: one refresh for any number of parallel 401s and for a double start.

### Tests (write first; they fail before implementation)

- [x] T003 [P] [US1] `SE-07.5 parallel 401s share one refresh and each call retries once` and `SE-07.5 a 401 after another call refreshed retries without refreshing` in apps/web/src/lib/api.test.ts
- [x] T004 [P] [US1] `SE-07.6 a double start restores the session with one refresh` (StrictMode render) in apps/web/src/lib/session.test.tsx

### Implementation

- [x] T005 [US1] Track the sent token in `api()` and retry without refreshing when it changed (research D6) in apps/web/src/lib/api.ts
- [x] T006 [US1] Restore through the shared `refreshSession()` and use `startSession` for sign-in in apps/web/src/lib/session.tsx

**Checkpoint**: C-1 fixed within one tab.

---

## Phase 4: User Story 2 - Several tabs stay signed in (P1)

### Tests

- [x] T007 [P] [US2] `SE-07.7 refreshes run inside the cross-tab lock, one at a time` (lock double) in apps/web/src/lib/api.test.ts
- [x] T008 [P] [US2] `SE-07.5 SE-07.7 parallel expired calls in two tabs keep the session` in apps/web/e2e/session-refresh.spec.ts: two pages in one context, the first calls to `/api/v1/sample/notes` answered 401 by `page.route` to simulate expiry, refreshes go to the real API; assert both pages load notes and a later refresh still succeeds (no revocation). Skipped unless `E2E_API`

### Implementation

- [x] T009 [US2] Wrap the refresh request in `navigator.locks.request('heach-session-refresh', …)` when available in apps/web/src/lib/api.ts
- [x] T010 [US2] Add e2e/session-refresh.spec.ts to the deploy-bundle job's Playwright file list in .github/workflows/ci.yml

**Checkpoint**: tabs coordinated.

---

## Phase 5: User Story 3 - Failures and logout are honest and final (P2)

### Tests

- [x] T011 [P] [US3] `SE-07.8 a rejected refresh ends the session here and in other tabs` and `SE-07.8 the refresh endpoint is never refreshed` in apps/web/src/lib/api.test.ts; `SE-07.8 the provider shows signed out when a call's refresh is rejected` in apps/web/src/lib/session.test.tsx
- [x] T012 [P] [US3] `SE-07.9 a network or server failure keeps the session` (thrown fetch and 503) in apps/web/src/lib/api.test.ts
- [x] T013 [P] [US3] `SE-07.10 sign-out waits for the in-flight refresh` in apps/web/src/lib/session.test.tsx
- [x] T014 [P] [US3] `SE-07.10 logout after a refresh ends the rotated session` in apps/api/test/auth.int-spec.ts
- [x] T015 [P] [US3] `SE-07.11 results from an ended session are ignored` in apps/web/src/lib/api.test.ts and apps/web/src/lib/session.test.tsx
- [x] T016 [P] [US3] `SE-07.12 signing out in one tab signs out the other` in apps/web/e2e/session-refresh.spec.ts

### Implementation

- [x] T017 [US3] Subscribe the provider to `onSessionEnded`; `signOut` = `settleRefresh` → logout → `endSession` in `finally` in apps/web/src/lib/session.tsx
- [x] T018 [US3] Distinguish `rejected` from `failed` in `refreshSession` and surface `failed` to the caller in apps/web/src/lib/api.ts

---

## Phase 6: User Story 4 - Stolen refresh tokens are still caught (P1)

- [x] T019 [P] [US4] `SE-07.13 a concurrent second use of a refresh token revokes every session` in apps/api/test/auth.int-spec.ts: two simultaneous refreshes with one cookie plus a second device: at most one 200, the other 401 with no `accessToken` and a cleared cookie; the second device's session and access token and the original token are rejected afterwards. Do not assert on the winner's new session (race, backlog item 3)
- [x] T020 [US4] Confirm no change to apps/api/src/auth/ (diff empty) and `pnpm --filter @heach/types check` passes

---

## Phase 7: Verification and status

- [x] T021 Run `pnpm check`, `pnpm test:scripts`, `node scripts/check-specs.mjs`; API integration and full-stack E2E locally or in CI
- [x] T022 SC-001: run the T008 test with `--repeat-each 50 --project desktop`; record the result
- [x] T023 Update docs/implementation-status.md: SE-07.5 to SE-07.13 rows with test evidence; spec index Status Done only when all pass
- [x] T024 Run /speckit-converge and resolve or record what it appends

---

## Dependencies & Execution Order

- T001 → T002 → stories. US1 and US4 first (P1), then US2, then US3. T019 is independent of the
  client work and can run first.
- Within a story: tests first and failing, then implementation.
- A task that changes behaviour not in spec.md stops; spec.md is changed and approved first.

---

## Phase 8: Convergence

Appended by `/speckit-converge` on 2026-10-21 (procedure followed by the agent; see analysis.md
F-notes). One finding: a call started in an older session could retry with a newer session's
token after a sign-out or a new sign-in.

- [x] T025 Make `api()` fail with 401 instead of retrying when the session epoch changed since the call started, with a `SE-07.11` unit test, per SE-07.11 (partial)

## Evidence (2026-10-21, local; GitHub Actions did not start: account billing)

Isolated local stack (`COMPOSE_PROJECT_NAME=heach-spec001`, fresh database, both migrations applied
from empty), API and web in dev mode (React StrictMode on):

- Web unit tests: 26 of 26 (`api.test.ts` 12, `session.test.tsx` 4, existing 10). Mutations:
  removing the shared refresh fails SE-07.5 and SE-07.6; removing the epoch check fails SE-07.11.
- API integration: 71 of 71, including SE-07.10 and SE-07.13; SE-07.13 repeated 10 times, 10 passed.
- E2E against the full stack: `session-refresh.spec.ts` and `notes-flow.spec.ts`, 12 of 12 on
  mobile, tablet and desktop. With the pre-fix client restored, both session tests fail.
- SC-001: `SE-07.5 SE-07.7` test with `--repeat-each 50`: 50 of 50 with the API rate limit at
  10000 per minute, as CI's integration tests set it. API log: 250 refreshes 200, 50 refreshes 401,
  all 401s being the expected cookie-less first load, so no replay. At the default 120 per minute
  the same loop is throttled (429) after about 39 runs; a 429 is a refresh failure (SE-07.9).
- `pnpm check` 37 of 37 tasks; `@heach/types check` up to date (no contract change);
  `check-specs` pass; `test:scripts` 37 of 37.
