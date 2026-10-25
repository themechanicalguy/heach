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

- [x] T001 Create apps/api/test/restore-check.int-spec.ts helpers: seed synthetic notes and audit entries in a local database, `pg_dump -Fc` it to a temp file, restore helpers, corrupt one ciphertext tag, break one audit link, checksum live tables
- [x] T002 [P] Create apps/api/src/jobs/restore-check.spec.ts with a fake pool and fake encryptor

---

## Phase 2: User Story 1 - The newest backup is proven restorable (P1)

- [x] T003 [US1] EN-10.5 test: restore of a seeded dump passes; counts equal the seed (fails first: no job)
- [x] T004 [US1] EN-10.6 tests: freshness unit test over object names (missing, 27 hours old, fresh); integration cases for truncated dump, corrupted tag and broken link each fail at their stage and emit one alert through a fake publisher
- [x] T005 [US1] EN-10.7 test: `audit.verify_chain()` and authenticated decryption of up to 1,000 rows, newest first
- [x] T006 [US1] EN-10.8 test: a killed run's database is dropped by the next run; no `heach_restorecheck_*` older than a day remains
- [x] T007 [US1] EN-10.9 test: live table checksums equal before and after; only one audit entry added
- [x] T008 [US1] Record T003 to T007 failing in Evidence
- [x] T009 [US1] apps/api/src/jobs/restore-check.ts: `main(argv)` returns the exit code; verify chain, decrypt and count, one JSON line; `job:restore-check` script in apps/api/package.json
- [x] T010 [US1] deploy/dev/restore-check.sh: newest `pg/*.dump` by name, 26-hour freshness, stale-database cleanup, restore with `--exit-on-error`, one-off API container, trap drop, SNS publish on failure with the API role's credentials (research D-5, amended)
- [x] T011 [US1] deploy/dev/heach-restore-check.service and .timer (Sundays 00:00 UTC, `Persistent=true`); deploy/dev/deploy.sh installs and enables; assertion in scripts/deploy-script.test.mjs

---

## Phase 3: User Story 2 - Nothing personal leaves the check (P1)

- [x] T012 [US2] EN-10.10 test: one `backup.restore_check` entry (role `system`, actor `job:restore-check`, run ID); job output and fake SNS payload contain no seeded body, user ID or note ID
- [x] T013 [US2] Summary audit entry in the job, best effort on failure

---

## Phase 4: Polish

- [x] T014 docs/runbooks/backup-restore.md: schedule, failure handling, record table for weekly runs
- [x] T015 `pnpm check`; `pnpm --filter @heach/api test:e2e`; `pnpm test:scripts`; changed-line coverage; record counts in Evidence
- [x] T016 Update docs/implementation-status.md (EN-10 row), docs/backlog.md item 5, docs/specs/README.md row
- [x] T017 After deploy: run the service once on the dev host (operator) and add its record to the runbook

## Dependencies & Execution Order

T001 and T002 first; T003 to T008 before T009 to T013 (fail first); T014 to T016 last; T017 after
the merge and deploy.

## Evidence

Implementation branch `fix/006-recurring-restore-check`, 25 October 2026 (Claude Code), on the
local isolated stack (`COMPOSE_PROJECT_NAME=heach-spec003`, PostgreSQL 18.6 and Redis over TLS).

**Fail first (T008).** Before the job and script existed: unit `restore-check.spec.ts` could not
load (`Cannot find module './restore-check.js'`); integration `restore-check.int-spec.ts` 13 of 13
failed (no job build, no script); `scripts/restore-check.test.mjs` 4 of 4 and the new
`deploy-script.test.mjs` timer case failed (5 of 11 in those two files).

**After implementation (T015).**

| Check                                                                                                   | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit `src/jobs/restore-check.spec.ts`                                                                   | 9 of 9 passed (EN-10.5, EN-10.7, EN-10.9, EN-10.10)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Integration `test/restore-check.int-spec.ts` (real `pg_dump`, `pg_restore`, built job, the host script) | 16 of 16 passed (13 through the host script, 3 calling the job's `main()` in process: good copy 0, broken link 1, live database name refused): pass run (counts, under 2 minutes, no throwaway left, live tables unchanged plus exactly one audit entry, entry as `job:restore-check` with the dump name, no body, user ID or note ID in output or alert); one alert each for freshness (no dump, 27-hour-old dump), restore (truncated dump), audit-chain (altered entry; `.failed` entry written), decrypt (altered tag) and `job`; SIGTERM drops the copy; three SIGKILLed runs' copies dropped by the next run once a day old, a younger one kept (SC-003) |
| Scripts `restore-check.test.mjs`, `deploy-script.test.mjs`                                              | 11 of 11 passed (freshness by object name; timer installed, weekly Sunday 00:00 UTC, `Persistent=true`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Whole API integration suite                                                                             | 133 of 133 passed, after deleting 2,640 leftover synthetic notes from earlier local runs in the isolated local database: with them, three re-encryption tests (spec 005) hit their 5-second timeout re-encrypting the whole table, unrelated to this change; CI starts from an empty database                                                                                                                                                                                                                                                                                                                                                                  |
| `pnpm check`                                                                                            | 37 of 37 tasks passed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

SC-002 is met by the integration test (one alert per failure stage, 100%). SC-004: the passing run
took under 2 minutes locally (asserted). **Deployed** in #80 (`a2cbf6f`, Deploy dev run 40157998902, green). **T017 done 25 October 2026**:
the service run by hand on the dev host passed in 6 seconds (SC-004) and a synthetic failure proved
the host alert path (published, delivered, received by the owner); records in the
[runbook](../../docs/runbooks/backup-restore.md#weekly-restore-check-records-sc-001). The timer's
first scheduled run is Sunday 1 November 2026, 00:00 UTC. **SC-001 is open**: four consecutive
scheduled runs (1, 8, 15 and 22 November) must be recorded there.

**Amendment (owner-approved 25 October 2026).** See the Approval lines of spec.md and plan.md:
counts in the log line rather than the audit entry (no detail column), API role used only for
`audit.append` against the live database, read grants in the throwaway copy only, and stage `job`.
The job takes `RESTORE_DATABASE_NAME` and refuses any name other than `heach_restorecheck_<digits>`.
