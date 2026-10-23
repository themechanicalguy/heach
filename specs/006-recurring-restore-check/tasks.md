---
description: 'Tasks for recurring restore verification of the nightly backup'
---

# Tasks: Recurring restore verification of the nightly backup

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md)

**Prerequisites**: spec.md and plan.md merged as Approved (constitution gate G2). Nothing below
starts before that. Implementation branch: `fix/006-recurring-restore-check`.

**Tests**: every criterion EN-10.5 to EN-10.10 has a test task whose title starts with its ID.
Tests are written first and recorded failing (no job exists) before the job is written.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 Create apps/api/test/restore-check.int-spec.ts helpers: seed synthetic notes and audit entries in a local database, `pg_dump -Fc` it to a temp file, restore helpers, corrupt one ciphertext tag, break one audit link, checksum live tables
- [ ] T002 [P] Create apps/api/src/jobs/restore-check.spec.ts with a fake pool and fake encryptor

---

## Phase 2: User Story 1 - The newest backup is proven restorable (P1)

- [ ] T003 [US1] EN-10.5 test: restore of a seeded dump passes; counts equal the seed (fails first: no job)
- [ ] T004 [US1] EN-10.6 tests: freshness unit test over object names (missing, 27 hours old, fresh); integration cases for truncated dump, corrupted tag and broken link each fail at their stage and emit one alert through a fake publisher
- [ ] T005 [US1] EN-10.7 test: `audit.verify_chain()` and authenticated decryption of up to 1,000 rows, newest first
- [ ] T006 [US1] EN-10.8 test: a killed run's database is dropped by the next run; no `heach_restorecheck_*` older than a day remains
- [ ] T007 [US1] EN-10.9 test: live table checksums equal before and after; only one audit entry added
- [ ] T008 [US1] Record T003 to T007 failing in Evidence
- [ ] T009 [US1] apps/api/src/jobs/restore-check.ts: `main(argv)` returns the exit code; verify chain, decrypt and count, one JSON line; `job:restore-check` script in apps/api/package.json
- [ ] T010 [US1] deploy/dev/restore-check.sh: newest `pg/*.dump` by name, 26-hour freshness, stale-database cleanup, restore with `--exit-on-error`, one-off API container, trap drop, SNS publish on failure
- [ ] T011 [US1] deploy/dev/heach-restore-check.service and .timer (Sundays 00:00 UTC, `Persistent=true`); deploy/dev/deploy.sh installs and enables; assertion in scripts/deploy-script.test.mjs

---

## Phase 3: User Story 2 - Nothing personal leaves the check (P1)

- [ ] T012 [US2] EN-10.10 test: one `backup.restore_check` entry (role `system`, actor `job:restore-check`, run ID); job output and fake SNS payload contain no seeded body, user ID or note ID
- [ ] T013 [US2] Summary audit entry in the job, best effort on failure

---

## Phase 4: Polish

- [ ] T014 docs/runbooks/backup-restore.md: schedule, failure handling, record table for weekly runs
- [ ] T015 `pnpm check`; `pnpm --filter @heach/api test:e2e`; `pnpm test:scripts`; changed-line coverage; record counts in Evidence
- [ ] T016 Update docs/implementation-status.md (EN-10 row), docs/backlog.md item 5, docs/specs/README.md row
- [ ] T017 After deploy: run the service once on the dev host (operator) and add its record to the runbook

## Dependencies & Execution Order

T001 and T002 first; T003 to T008 before T009 to T013 (fail first); T014 to T016 last; T017 after
the merge and deploy.

## Evidence

None yet (Draft).
