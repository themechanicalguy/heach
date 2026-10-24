# Implementation Plan: Recurring restore verification of the nightly backup

**Status**: Approved

**Spec**: [spec.md](spec.md) | **Date**: 2026-10-24 | **Approval**: Owner (Saurav Rath), 2026-10-25, explicit approval of this spec and its plan as drafted ("Approve as drafted"), with decisions D-1 to D-5 as written, including the weekly Sunday schedule (D-1), the one summary audit entry (D-3) and the alert published with the API role's credentials (D-5, amended for spec 007); takes effect when this docs-only pull request merges

**Input**: Feature specification from `specs/006-recurring-restore-check/spec.md`

## Summary

Close the "no recurring restore check" gap in EN-10 (backlog item 5, first half). A new API job
`restore-check` connects to a throwaway database, runs `audit.verify_chain()`, decrypts up to 1,000
sample-note bodies and returns counts; it writes one summary audit entry to the live database as
the system job. A host script `deploy/dev/restore-check.sh` finds the newest dump, checks its age,
restores it into `heach_restorecheck_<time>`, runs the job in a one-off API container, drops the
database and publishes an alert on failure. A weekly systemd timer runs it; `deploy.sh` installs it
as it does the backup timer. No schema, endpoint, infrastructure or dependency change.

## Technical Context

**Apps and packages touched**: `apps/api`: new `src/jobs/restore-check.ts` and
`src/jobs/restore-check.spec.ts`, new `test/restore-check.int-spec.ts`; `package.json` script
`job:restore-check`. `deploy/dev`: new `restore-check.sh`, `heach-restore-check.service`,
`heach-restore-check.timer`; `deploy.sh` installs them. `scripts/deploy-script.test.mjs` asserts the
timer is installed. Docs: `docs/runbooks/backup-restore.md` (schedule, record table, failure
handling).

**New dependencies**: None (`pg_restore` and the AWS CLI are already on the host and in the
PostgreSQL image).

**Storage**: None added. A throwaway database exists for the length of a run.

**Third parties**: S3 (`pg/*`, decrypted by S3 with the backup key) through the host role; data-key
KMS calls inside the one-off API container through the API role; SNS publish with the API role's
credentials (research D-5, amended for spec 007). No IAM change.

**Constraints**: runs on the t4g.small dev host next to the live stack; the data set is under 1 MB
today. The decrypt stage caps at 1,000 rows so time stays bounded as data grows.

## Constitution Check

_GATE: Must pass before research. Re-check after design._

| Principle                               | How this plan meets it                                                                                                             | Violation and justification |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| I Spec before code                      | Docs only; no code until this spec and plan are Approved on `main`                                                                 | None                        |
| II Traceable criteria                   | EN-10.5 to EN-10.10, each with a named test                                                                                        | None                        |
| III Data protection                     | Restricted values read only to prove decryption and discarded; access audited; throwaway copies always dropped                     | None                        |
| IV Synthetic data, logs, secrets        | Synthetic dumps in tests; output, record and alert hold counts, stage, dump name and run ID only                                   | None                        |
| V Languages, accessibility, performance | No user-facing strings; bounded rows and time                                                                                      | None                        |
| VI Architecture, reuse, dependencies    | Reuses the field encryptor, `AuditService` system actor (spec 005), host and API roles as they are, alert topic; no new dependency | None                        |
| VII Evidence-based completion           | EN-10 stays Partial until four weekly host records exist (SC-001) and the off-account key decision is made                         | None                        |
| VIII Changes and exceptions             | EN-10.1 to EN-10.4 unchanged                                                                                                       | None                        |
| IX Humans approve                       | Owner approves the spec; enabling the timer on the host happens through the normal deploy after merge                              | None                        |

## Project Structure

### Documentation (this feature)

```text
specs/006-recurring-restore-check/
├── spec.md
├── plan.md              # This file
├── research.md          # Current behaviour, decisions D-1 to D-5, cost
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/api/src/jobs/restore-check.ts          # verify chain, decrypt up to 1,000 rows, counts, summary audit entry
apps/api/src/jobs/restore-check.spec.ts     # unit: stages, output has no IDs or values, exit codes
apps/api/test/restore-check.int-spec.ts     # integration: real dump, each failure stage, cleanup, live DB unchanged
deploy/dev/restore-check.sh                 # newest dump, freshness, restore, job, drop, alert
deploy/dev/heach-restore-check.{service,timer}
deploy/dev/deploy.sh                        # installs and enables the timer
scripts/deploy-script.test.mjs              # asserts the timer is installed
docs/runbooks/backup-restore.md             # schedule, failure handling, record table
```

## Data model and migrations

None. The throwaway database is restored from the dump, so it has the live schema. The job's
connection to it uses the API role after `GRANT CONNECT` (as `scripts/restore-check.sh` does); the
live database is reached only through `audit.append`.

## Encryption and keys

Unchanged. The job decrypts with the same field encryptor and KMS keys as the API; plaintext is
held for one row at a time and discarded. The S3 object is decrypted by S3 with the backup key on
GET (SSE-KMS), as the runbook restore does.

## API contracts

No HTTP contract. Command contract:

- `node dist/jobs/restore-check.js` with `RESTORE_DATABASE_URL` set: exit 0 on pass; exit 1 with
  stage `audit-chain` or `decrypt` on failure.
- Output: one JSON log line `{ runId, stage, outcome, tables: {name: count}, decrypted, failed }`.
- `deploy/dev/restore-check.sh`: stages `freshness`, `restore`, then the job's stages; exit 0 or 1;
  on 1, one SNS publish.

## Audit, logging and monitoring

- Audit: one `backup.restore_check` entry per run in the live log (D-3).
- Logging: the JSON line above; the host script logs stage transitions to the journal.
- Monitoring: SNS alert on failure (D-5); the operator copies a monthly record to the runbook.

## Threat model

Assets: Restricted health values in the dump; the live database; the audit trail; host disk and
KMS capacity.

| Threat                                                                         | Mitigation                                                                           | Criterion        |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------- |
| Information disclosure: throwaway copies of Restricted data left on disk       | Drop on exit; next run drops any copy older than a day                               | EN-10.8          |
| Information disclosure: values or IDs in logs, records or alert email          | Counts, stage, dump name and run ID only; test scans output and payload              | EN-10.10         |
| Tampering: the check restores over or writes to the live database              | New database name only; job holds no write path to live tables beyond `audit.append` | EN-10.9          |
| Repudiation: weekly decryption of all health values with no audit trail        | One summary entry per run as the system job                                          | EN-10.10         |
| Tampering (undetected): a backup with an edited or broken audit chain          | `audit.verify_chain()` on the restored copy                                          | EN-10.7          |
| Denial of service (silent): backups stop or stop restoring, found only in need | Weekly run; freshness, restore and decrypt stages each alert                         | EN-10.5, EN-10.6 |
| Denial of service: the check exhausts host disk or KMS                         | Bounded rows; dump under 1 MB today; restore failure alerts and cleans up            | EN-10.6, EN-10.8 |

## Rollout

After approval: implementation pull request; Deploy dev installs and enables the timer. The first
run is triggered once by hand on the host (`systemctl start heach-restore-check.service`) and its
record added to the runbook. Rollback: `systemctl disable --now heach-restore-check.timer` or
redeploy the previous bundle.

## Verification

| Criterion | Test or check                                                                                         | Where it runs      |
| --------- | ----------------------------------------------------------------------------------------------------- | ------------------ |
| EN-10.5   | Int: dump of a seeded local database restored and checked; counts match the seed                      | CI Checks          |
| EN-10.6   | Unit: freshness from object names; Int: truncated dump, corrupted tag, broken link each fail at stage | CI Checks          |
| EN-10.7   | Int: corrupted ciphertext and broken audit link                                                       | CI Checks          |
| EN-10.8   | Int: killed run leaves a database; next run drops it                                                  | CI Checks          |
| EN-10.9   | Int: checksums of live tables before and after equal; only the audit entry added                      | CI Checks          |
| EN-10.10  | Int: one entry per run; output and SNS fake payload contain no seeded value or ID                     | CI Checks          |
| SC-001    | Four weekly host records                                                                              | Dev host, operator |

## Complexity Tracking

None. No principle is violated.
