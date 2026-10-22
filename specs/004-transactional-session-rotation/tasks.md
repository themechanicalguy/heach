---
description: 'Tasks for transactional session rotation and replay handling'
---

# Tasks: Transactional session rotation and replay handling

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/)

**Prerequisites**: spec.md and plan.md merged as Approved (constitution gate G2), and spec 003
implemented on `main` (its `withTransaction` helper). Nothing below starts before both.
Implementation branch: `fix/004-transactional-session-rotation`.

**Tests**: every criterion SE-07.14 to SE-07.20 has a test task whose title starts with its ID.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 Create apps/api/test/session-rotation.int-spec.ts with helpers reused from `auth-helpers.ts` (login, refresh, `statuses`), a fault injector (`vi.spyOn` on the app's `SessionRepository` and `AccessTokenStore` singletons, throwing once) and a "nothing of this user works" assertion (every known access token → 401, every known cookie → 401)

---

## Phase 2: Foundational (blocks every story)

- [ ] T002 `SessionRepository`: add `lockByHash(client, hash)` (`SELECT … FOR UPDATE` on the session–user join), `lockUser(client, userId)`, and give `revokeIfActive`, `revokeAllForUser` and `create` an optional client (research D-1); existing callers unchanged
- [ ] T003 Create apps/api/src/auth/session.service.spec.ts with a fake transaction runner and repository doubles that record call order

**Checkpoint**: repository can run inside spec 003's transaction.

---

## Phase 3: User Story 1 - A server fault during refresh does not sign the user out (P1) 🎯 MVP

### Tests (write first; they fail before implementation)

- [ ] T004 [P] [US1] `SE-07.14 a failed session insert keeps the old session` in session-rotation.int-spec.ts and session.service.spec.ts (order `BEGIN`, lock, revoke, insert, issue, `COMMIT`; `ROLLBACK` on throw)
- [ ] T005 [P] [US1] `SE-07.15 a failed token issue or commit leaves no usable token` in session-rotation.int-spec.ts and session.service.spec.ts (`COMMIT` throws → issued token revoked)
- [ ] T006 [P] [US1] `SE-07.16 only 401 clears the refresh cookie` in apps/api/src/auth/auth.controller.spec.ts (new) and session-rotation.int-spec.ts
- [ ] T007 [US1] `SE-07.17 the same cookie refreshes after a transient fault` in session-rotation.int-spec.ts; SC-002 loop of 50
- [ ] T008 [US1] Run T004 to T007 against current `main` and record the failures in Evidence (regression proof)

### Implementation

- [ ] T009 [US1] `SessionService.refresh` inside `withTransaction` with `SET LOCAL lock_timeout = '5s'`, lock, checks, revoke, insert, issue, commit; revoke the issued token if commit fails (D-1, D-3)
- [ ] T010 [US1] `AuthController.refresh`: clear the cookie only for `UnauthorizedException` (D-4)

**Checkpoint**: F2 closed.

---

## Phase 4: User Story 2 - A replayed token cannot leave a live session behind (P1)

### Tests

- [ ] T011 [P] [US2] `SE-07.18 a concurrent replay revokes the winner too` in session-rotation.int-spec.ts: 50 concurrent pairs (SC-001)
- [ ] T012 [P] [US2] `SE-07.19 a sequential replay revokes every session` in session-rotation.int-spec.ts
- [ ] T013 [P] [US2] `SE-07.20 sign-out of all devices during another device's refresh leaves no session` in session-rotation.int-spec.ts: 50 repetitions
- [ ] T014 [US2] Record T011 and T013 failing against current `main` in Evidence

### Implementation

- [ ] T015 [US2] Replay path inside the same lock: revoke all session rows, commit, then revoke all access tokens; warn log with user ID only (D-2)
- [ ] T016 [US2] `signOutEverywhere` takes `lockUser` inside `withTransaction` before revoking (D-1)
- [ ] T017 [US2] Update the SE-07.13 comment in apps/api/test/auth.int-spec.ts: the winner is now covered by SE-07.18

---

## Phase 5: Verification and status

- [ ] T018 `pnpm check`; `pnpm --filter @heach/api test:e2e`; record counts and SC-003 timings in Evidence
- [ ] T019 Update docs/implementation-status.md SE-07 row (transactional rotation done; OTP re-verification still Step 3), docs/backlog.md item 3, docs/specs/README.md status
- [ ] T020 Open the code pull request with `Spec: specs/004-transactional-session-rotation/spec.md` and `Criteria: SE-07.14 to SE-07.20`

## Dependencies & Execution Order

- Spec 003 implemented → T001 to T003 → US1 (T004 to T010) → US2 (T011 to T017) → T018 to T020.
- US2 depends on US1's transaction (T009). [P] tasks touch different test names and can be written
  together.

## Evidence

Filled in during implementation.
