---
description: 'Tasks for transactional domain writes and their audit entries'
---

# Tasks: Transactional domain writes and their audit entries

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/)

**Prerequisites**: spec.md and plan.md merged as Approved (constitution gate G2). Nothing below
starts before that. Implementation branch: `fix/003-transactional-audit-writes`.

**Tests**: every criterion SE-05.5 to SE-05.10 has a test task whose title starts with its ID.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [x] T001 Create apps/api/src/data-stores/transaction.spec.ts with a fake pool and client that record statements and `release` calls, and can be told to throw on `BEGIN`, a work statement, `COMMIT` or `ROLLBACK`

---

## Phase 2: Foundational (blocks every story)

- [x] T002 `SE-05.9 commits all or none and always releases the connection` in transaction.spec.ts: commit path; work throws → `ROLLBACK`, original error, one `release()`; `COMMIT` throws → `ROLLBACK`; `ROLLBACK` throws → `release(error)`, original error rethrown
- [x] T003 Implement `withTransaction` in apps/api/src/data-stores/transaction.ts (contracts/transaction-helper.md; research D-1, D-5); export it for repositories
- [x] T004 Refactor `PgDataKeyStore.add` in apps/api/src/crypto/pg-data-key-store.ts to use `withTransaction` (D-6); existing crypto unit and `crypto.int-spec.ts` tests pass unchanged
- [x] T005 Create apps/api/test/audit-transaction.int-spec.ts with helpers: boot the app, sign in a synthetic patient, a spy that makes `AuditService.record` send `audit.append` with a NULL role through the client it was given (a real database error inside the same transaction), count rows in `app.patient_note` and entries in `audit.entry` by action and correlation ID (`connectAs`), and corrupt a stored ciphertext's tag

**Checkpoint**: helper proven; integration scaffolding in place.

---

## Phase 3: User Story 1 - No Restricted write without its audit entry (P1) 🎯 MVP

### Tests (write first; they fail before implementation)

- [x] T006 [P] [US1] `SE-05.5 a failed audit entry leaves no note` in audit-transaction.int-spec.ts: 500 with the generic body, no row; repeat 50 times (SC-001)
- [x] T007 [P] [US1] `SE-05.6 a failed write leaves no create entry` in audit-transaction.int-spec.ts (encryptor spy throws; no row, no `sample_note.create` entry) and in notes.repository.spec.ts (insert throws → `audit.record` not called, `ROLLBACK` sent); plus SC-002: 50 saves give 50 rows and 50 create entries
- [x] T008 [US1] Run T006 and T007 against the current repository and record the failures in Evidence below (regression proof)

### Implementation

- [x] T009 [US1] `NotesRepository.create`: encrypt, then `withTransaction` with insert then `audit.record(event, client)` (D-4); inject the pool as `Pick<pg.Pool, 'query' | 'connect'>`. Unit test in notes.repository.spec.ts asserts the order encrypt, `BEGIN`, insert, audit, `COMMIT`

**Checkpoint**: S-2 write half closed.

---

## Phase 4: User Story 2 - Reads are audited as what actually happened (P1)

### Tests

- [x] T010 [P] [US2] `SE-05.7 a read that fails after lookup is audited as failed` (open and list a note with a corrupted tag: 500, no body text; one `.read.failed` / `.list.failed`, no `.read` / `.list` for the correlation ID) in audit-transaction.int-spec.ts
- [x] T011 [P] [US2] `SE-05.8 a failed read audit returns no data` (audit spy throws on read and list: 500, response contains no note text) in audit-transaction.int-spec.ts
- [x] T012 [US2] Record T010 failing against the current repository in Evidence (T011 is expected to pass already: research "Current behaviour")

### Implementation

- [x] T013 [US2] `findOwned` and `listOwned`: decrypt, then audit, then return; on failure after lookup append `.read.failed` / `.list.failed` best effort and rethrow the original error (D-2, D-3)

---

## Phase 5: User Story 3 - One shared way to write as a unit (P2)

- [x] T014 [US3] `SE-05.10 failed transactions do not exhaust the pool` in audit-transaction.int-spec.ts: 30 failed saves (3 × pool size, SC-003), then a save returns 201
- [x] T015 [US3] Check that no other `BEGIN` remains in apps/api/src outside transaction.ts (`grep`), and record it in Evidence

---

## Phase 6: Verification and status

- [x] T016 `SE-05.1` test in notes.repository.spec.ts still passes (fake pool gains `connect`; each public method still writes exactly one entry on success); `audit-chain.int-spec.ts`, `db-roles.int-spec.ts`, `sample-notes.int-spec.ts` unchanged and passing
- [x] T017 `pnpm check`, `pnpm --filter @heach/api test:e2e`, coverage threshold on changed code, `node scripts/check-specs.mjs`, `pnpm test:scripts`, gitleaks; types unchanged (`pnpm --filter @heach/types generate` gives no diff)
- [x] T018 Update docs/implementation-status.md (SE-05: what exists, evidence, remaining gaps: re-encryption job audit, P-2), docs/backlog.md (item 2 Done) and docs/specs/README.md row
- [ ] T019 `/speckit-converge` (left to the owner: the skill is user-invocable only); evidence recorded below and the code PR opened; record evidence below; open the code PR with `Spec:` and `Criteria: SE-05.5 to SE-05.10` lines

---

## Dependencies & Execution Order

- T001 → T002 → T003 → T004, T009. T005 → every integration test task.
- Tests T006, T007 → T008 (fail first) → T009. T010 → T012 → T013.
- T014 needs T009. Phase 6 last.
- [P] tasks touch different test cases and can be written in parallel.

## Evidence

Local run on 2026-10-22, branch `fix/003-transactional-audit-writes`, Node 24.22.1, pnpm 12.8.1,
isolated stack `COMPOSE_PROJECT_NAME=heach-spec003` (PostgreSQL 18, Redis 8, TLS).

**Regression proof (T008, T012)**: `audit-transaction.int-spec.ts` against the unchanged
repository on `main` 5c3c720: 3 failed, 92 passed.

- `SE-05.5`: `expected 51 to be 1`. All 50 notes were stored although every audit entry failed.
- `SE-05.7` read: `expected [ 'sample_note.read' ] to deeply equal [ 'sample_note.read.failed' ]`.
- `SE-05.7` list: `expected [ 'sample_note.list' ] to deeply equal [ 'sample_note.list.failed' ]`.
- `SE-05.6`, `SE-05.8` and `SE-05.10` passed already, as research "Current behaviour" predicted.

**After the change**:

| Check                                               | Result                                                                                                                                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @heach/api test` (unit)              | 51/51, including `transaction.spec.ts` (SE-05.9 ×5) and `notes.repository.spec.ts` (SE-05.1, SE-05.5 order, SE-05.6)                                                                                            |
| `pnpm --filter @heach/api test:e2e` (integration)   | 95/95 in 14 files, including `audit-transaction.int-spec.ts` (SE-05.5 ×50, SE-05.6, SC-002 ×50, SE-05.7 read and list, SE-05.8, SE-05.10 ×30) and unchanged `audit-chain`, `db-roles`, `sample-notes`, `crypto` |
| `pnpm check`                                        | 37/37 tasks                                                                                                                                                                                                     |
| T015 `grep "'BEGIN'" apps/api/src` (non-test)       | Only `data-stores/transaction.ts`                                                                                                                                                                               |
| `pnpm --filter @heach/types generate`               | No diff (no API contract change)                                                                                                                                                                                |
| `node scripts/check-specs.mjs`, `pnpm test:scripts` | Pass                                                                                                                                                                                                            |
