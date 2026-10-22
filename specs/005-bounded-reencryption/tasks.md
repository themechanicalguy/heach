---
description: 'Tasks for bounded, audited re-encryption after a key rotation'
---

# Tasks: Bounded, audited re-encryption after a key rotation

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/)

**Prerequisites**: spec.md and plan.md merged as Approved (constitution gate G2), and spec 003
implemented on `main`. Nothing below starts before both. Implementation branch:
`fix/005-bounded-reencryption`.

**Tests**: every criterion EN-05.4 to EN-05.9 has a test task whose title starts with its ID.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 Create apps/api/src/jobs/reencrypt.spec.ts with a fake pool (scripted batches, configurable `rowCount` per update, call counter with a hard bound so a loop fails instead of hanging) and a fake encryptor
- [ ] T002 Create apps/api/test/reencrypt.int-spec.ts with helpers: seed N synthetic notes, rotate, set a row's version, corrupt a tag, count `audit.entry` rows by action and correlation ID (`connectAs`)

---

## Phase 2: Foundational (blocks every story)

- [ ] T003 `RequestContext.system` (optional) and `AuditService.record` writing actor `system` role and the job's actor ID when there is no principal; unit test in apps/api/src/audit/audit.service.spec.ts (research D-4)

---

## Phase 3: User Story 1 - The job always finishes and only moves old data (P1) 🎯 MVP

### Tests (write first; they fail before implementation)

- [ ] T004 [P] [US1] `EN-05.4 one pass even when rows cannot be updated or decrypted` in reencrypt.spec.ts and reencrypt.int-spec.ts (SC-001 data set)
- [ ] T005 [P] [US1] `EN-05.5 only rows below the target version are re-encrypted` in reencrypt.int-spec.ts (versions 1, 2, 3; rotation mid-run through a spy) and reencrypt.spec.ts
- [ ] T006 [P] [US1] `EN-05.6 counts are what actually happened and failures exit non-zero` in reencrypt.spec.ts and reencrypt.int-spec.ts
- [ ] T007 [P] [US1] `EN-05.9 a clean re-run reports 0 and audits nothing` in reencrypt.int-spec.ts (SC-003)
- [ ] T008 [US1] Run T004 against current `main` and record that it hits the loop bound in Evidence (regression proof)

### Implementation

- [ ] T009 [US1] `reencryptHealth`: target once, keyset select `id > $cursor AND (body->>'keyVersion')::int < $target ORDER BY id LIMIT 100`, per-row try/catch, counts from `rowCount`, return `{ reencrypted, skipped, failed }` (D-1 to D-3, D-5)
- [ ] T010 [US1] Job entry point: run ID, `runWithContext` with the system actor, start and end log lines, `process.exitCode = 1` when failed; adapt `crypto.int-spec.ts` EN-05.3 to the new result

---

## Phase 4: User Story 2 - Every re-encrypted value is audited (P1)

### Tests

- [ ] T011 [P] [US2] `EN-05.7 each re-encrypted row has its entry in the same transaction` in reencrypt.int-spec.ts (SC-002; audit spy failing for one row → unchanged, failed)
- [ ] T012 [P] [US2] `EN-05.8 an undecryptable row is unchanged and audited as failed` in reencrypt.int-spec.ts

### Implementation

- [ ] T013 [US2] Per row: KMS work before `withTransaction`; inside, conditional update then `audit.record(sample_note.reencrypt, client)` when `rowCount` is 1; on failure `sample_note.reencrypt.failed` best effort (D-4)

---

## Phase 5: Verification and status

- [ ] T014 Update docs/runbooks/key-rotation.md: output, exit code, audit check query, record table
- [ ] T015 `pnpm check`; `pnpm --filter @heach/api test:e2e`; record counts in Evidence
- [ ] T016 Update docs/implementation-status.md (EN-05 row, SE-05 row: re-encryption gap closed), docs/backlog.md item 4, docs/specs/README.md status
- [ ] T017 Open the code pull request with `Spec: specs/005-bounded-reencryption/spec.md` and `Criteria: EN-05.4 to EN-05.9`

## Dependencies & Execution Order

- Spec 003 implemented → T001 to T003 → US1 (T004 to T010) → US2 (T011 to T013) → T014 to T017.
- Independent of spec 004; can be built before or after it.

## Evidence

Filled in during implementation.
