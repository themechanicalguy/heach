# Implementation Plan: Bounded, audited re-encryption after a key rotation

**Status**: Draft

**Spec**: [spec.md](spec.md) | **Date**: 2026-10-22 | **Approval**:

**Input**: Feature specification from `specs/005-bounded-reencryption/spec.md`

## Summary

Fix review C-2 and the SE-05 gap in the re-encryption job (backlog item 4). `reencryptHealth` walks
`app.patient_note` once by ascending ID (keyset cursor), selecting only rows whose key version is
numerically below the target read at the start. For each row it decrypts and re-encrypts outside
any transaction, then in spec 003's `withTransaction` runs the conditional update and, when it
changed the row, appends `sample_note.reencrypt` as the system job. It returns `{ reencrypted,
skipped, failed }` from real row counts, logs counts only, and exits non-zero on failures. The
runbook is updated. No schema, endpoint or dependency change. Decisions: [research.md](research.md).

## Technical Context

**Apps and packages touched**: `apps/api` only: `src/jobs/reencrypt.ts`, new
`src/jobs/reencrypt.spec.ts`; `src/common/request-context.ts` (optional `system` field);
`src/audit/audit.service.ts` (system actor) and its unit test; new
`test/reencrypt.int-spec.ts`; `test/crypto.int-spec.ts` EN-05.3 adapted to the new return shape.
Docs: `docs/runbooks/key-rotation.md`.

**New dependencies**: None.

**Storage**: None added.

**Third parties**: KMS through the existing key provider (unchanged).

**Constraints**: depends on spec 003 (helper, SE-05.9). Each row's transaction holds the audit lock
(review P-2) for one update plus the append; KMS calls run before `BEGIN`. Throughput is bounded by
the audit lock; fine for dev and pilot volumes (one row per few milliseconds).

## Constitution Check

_GATE: Must pass before research. Re-check after design._ Re-checked after design: unchanged.

| Principle                               | How this plan meets it                                                                                                            | Violation and justification |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| I Spec before code                      | Docs only; no code until Approved and spec 003 is implemented                                                                     | None                        |
| II Traceable criteria                   | EN-05.4 to EN-05.9, each with a named test                                                                                        | None                        |
| III Data protection                     | Closes an SE-05 gap (system job rewrites Restricted data unaudited); encryption unchanged; job reachable only from the host shell | None                        |
| IV Synthetic data, logs, secrets        | Synthetic rows in tests; job output holds counts, versions and run ID only                                                        | None                        |
| V Languages, accessibility, performance | No user-facing strings; batch of 100 bounds memory                                                                                | None                        |
| VI Architecture, reuse, dependencies    | Reuses spec 003's helper and `AuditService`; no new dependency                                                                    | None                        |
| VII Evidence-based completion           | Status page updated in the implementation PR; EN-05 stays Partial until production schedules exist                                | None                        |
| VIII Changes and exceptions             | EN-05.1 to EN-05.3 unchanged; EN-05.3's integration test adapted to the new return value only                                     | None                        |
| IX Humans approve                       | Owner approves by merging; the agent runs the job only locally and in CI; a dev-host run is an operator action                    | None                        |

## Project Structure

### Documentation (this feature)

```text
specs/005-bounded-reencryption/
├── spec.md
├── plan.md              # This file
├── research.md          # Current behaviour, decisions D-1 to D-5
├── data-model.md        # New audit values; transaction scope
├── quickstart.md
├── contracts/
│   └── reencrypt-job.md # Command, output and exit code
├── checklists/
│   └── requirements.md
├── analysis.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/api/src/jobs/reencrypt.ts             # keyset walk, numeric < target, counts, per-row transaction and audit
apps/api/src/jobs/reencrypt.spec.ts        # new: EN-05.4 to EN-05.6 with a fake pool (bounded)
apps/api/src/common/request-context.ts     # optional `system` actor
apps/api/src/audit/audit.service.ts        # role `system` and actor from context when no principal
apps/api/test/reencrypt.int-spec.ts        # new: EN-05.4 to EN-05.9
apps/api/test/crypto.int-spec.ts           # EN-05.3 reads `reencrypted` from the new result
docs/runbooks/key-rotation.md              # output, exit code, audit check
```

## Data model and migrations

None. New audit values and transaction scope in [data-model.md](data-model.md).

## Encryption and keys

Unchanged design (envelope encryption, `health` domain). Decrypt and encrypt happen before the
transaction; the plaintext lives only in the job's memory for one row at a time. Target version is
read once (research D-2).

## API contracts

No HTTP contract. The command's options, output and exit code are in
[contracts/reencrypt-job.md](contracts/reencrypt-job.md).

## Audit, logging and monitoring

- Audit: spec "Audit and consent"; actor role `system`, actor `job:reencrypt`, correlation
  `reencrypt-<uuid>`.
- Logging: one start line (run ID, domain, target version) and one end line (counts); per failed
  row, a warn line with the error type only (no row ID, which an attacker could correlate, and no
  values).
- Monitoring: exit code; the operator records the end line in the runbook's record table.

## Threat model

Assets: Restricted health values; the audit trail; database and KMS capacity during a rotation.
Entry point: the job command on the host (operator, Session Manager) or locally.

| Threat                                                                           | Mitigation                                                                | Criterion        |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------- |
| Denial of service: the job never finishes and keeps calling KMS and the database | Keyset walk visits each row once; strict `<` target                       | EN-05.4, EN-05.5 |
| Tampering: rows on a newer key are rewritten back or churned                     | Only rows below the start target are selected                             | EN-05.5          |
| Repudiation: Restricted data read and rewritten with no audit entry              | Per-row entry in the update's transaction; failure leaves the old value   | EN-05.7          |
| Repudiation (false record): an entry for a row that was not changed              | Entry only when `rowCount` is 1; failed rows get `.reencrypt.failed`      | EN-05.6, EN-05.8 |
| Information disclosure: values, ciphertext or row IDs in job output              | Counts, versions and run ID only; error type only                         | EN-05.6          |
| Elevation of privilege: a caller sets an arbitrary audit actor                   | System actor comes only from the job's own context, not from `AuditEvent` | EN-05.7          |
| Denial of service: the audit lock held during KMS calls                          | KMS before `BEGIN`; update and append only inside                         | EN-05.7          |

## Rollout

Code release with the next API image; no migration, no flag. Nothing runs automatically. The
next operator rotation follows the updated runbook. Rollback: redeploy the previous image (the old
job is still correct when nothing fails, but unbounded).

## Verification

| Criterion        | Test or check                                                                                                                                                     | Where it runs |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| EN-05.4          | Unit: fake pool whose updates always match 0 rows; the job ends after one pass (test fails if the select runs more than rows/100 + 1 times). Int: SC-001 data set | CI Checks     |
| EN-05.5          | Int: rows on versions 1, 2 (target) and 3 (written after a second rotation mid-run via a spy); only version 1 rows change                                         | CI Checks     |
| EN-05.6          | Unit: counts from `rowCount`; exit code set when failed. Int: SC-001 counts                                                                                       | CI Checks     |
| EN-05.7          | Int: entries per run ID equal `reencrypted` (SC-002); audit spy failing for one row → row unchanged, counted failed                                               | CI Checks     |
| EN-05.8          | Int: corrupted tag → value unchanged, one `.reencrypt.failed` entry                                                                                               | CI Checks     |
| EN-05.9          | Int: second clean run → 0 and no new entries (SC-003)                                                                                                             | CI Checks     |
| EN-05.3          | Existing `crypto.int-spec.ts` still passes                                                                                                                        | CI Checks     |
| Regression proof | EN-05.4 unit test against current `main` hits its loop bound (recorded in tasks.md Evidence)                                                                      | Local, once   |

## Complexity Tracking

None. No principle is violated.
