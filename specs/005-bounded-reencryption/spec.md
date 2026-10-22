# Feature Specification: Bounded, audited re-encryption after a key rotation

**Status**: Approved

**Step**: [Step 2 spec](../../docs/specs/step-02-secure-foundation.md) of the [guideline](../../docs/mvp-v1-implementation-guideline.md) (key rotation, EN-05.1 to EN-05.3)

**Requirements in scope**: EN-05 (key rotation, old data readable, re-encryption); SE-05 (audit of every read and write of Restricted data); SO-01 (threat model, in plan.md); LM-02 (no personal data in logs); TS-01, TS-03 (test evidence)

**Approval**: Owner (Saurav Rath), 2026-10-22, explicit approval of this spec and its plan as drafted ("Approve 003, 004, 005 as drafted"), with decisions D-1 to D-5 as written, including the per-row audit entry with the `system` actor (D-4); takes effect when this docs-only pull request merges

**Created**: 2026-10-22

**Input**: User description: "Bounded re-encryption with keyset progress, appropriate version selection, actual update counts, and required audit coverage (EN-05, SE-05; review C-2; backlog item 4)"

## Scope

After a data key is rotated, an operator runs the re-encryption job so stored health values move to
the new key version (EN-05.3, [key-rotation runbook](../../docs/runbooks/key-rotation.md)). Today
the job can run forever: it repeatedly selects every row whose version is "not equal" to the
version it read at the start, so a row it could not update (changed meanwhile) or a row written
under a newer key (a second rotation during the run) is selected again on every pass. It also
counts a row as done even when its update changed nothing, and it reads and rewrites Restricted
data without any audit entry, which SE-05 requires (review C-2; spec 003 out of scope).

This feature makes one run visit each row at most once and always finish, move only rows older than
the target version, report what actually happened, and audit every row it re-encrypts or fails to,
with the data change and its entry committed together.

**Out of scope** (tracked in the [backlog](../../docs/backlog.md) or a later step):

- Scheduling rotation or re-encryption automatically (the runbook stays operator-run; EN-05's
  schedule is decided with production, Step 10).
- Other domains and columns (identity, payments, documents): none hold data yet. Each step that
  adds a Restricted column extends the job in the same pull request (runbook rule, unchanged).
- Retiring or deleting old key versions after re-encryption (needs its own decision; old versions
  stay readable per EN-05.1).
- The audit log's global lock as a throughput ceiling (review P-2): a large re-encryption is slow
  but correct; revisit with the ADR note P-2 asks for.
- The shared transaction helper ([spec 003](../003-transactional-audit-writes/spec.md), SE-05.9),
  which this feature reuses and so cannot start before spec 003 is implemented.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - The job always finishes and only moves old data (Priority: P1)

**Journey and role**: operator rotating the `health` data key (dev today; production later)

The operator rotates the key and runs the job. It works through the stored values in order, once
each, and stops. Values changed by someone else while it ran are left alone and counted as
skipped; values that cannot be decrypted are counted as failed and the job still finishes. If a
second rotation happens during the run, values already on the newer key are not touched. Running
the job again picks up whatever was skipped and reports nothing left when done.

**Why this priority**: a job that never ends during a key rotation, the moment when a key may be
compromised, blocks the rotation runbook and burns database and KMS capacity.

**Independent Test**: integration test with rows on old, current and newer versions, a row changed
during the run and a row with a corrupted ciphertext.

**Acceptance Scenarios**:

1. **Given** rows that cannot be updated or decrypted, **When** the job runs, **Then** it finishes after one pass (EN-05.4)
2. **Given** rows on versions older than, equal to and newer than the target, **When** the job runs, **Then** only the older ones are re-encrypted (EN-05.5)
3. **Given** a finished run, **When** the operator reads its result, **Then** the counts match what was actually updated, skipped and failed, and a run with failures exits non-zero (EN-05.6)
4. **Given** a run that completed with nothing skipped or failed, **When** the job runs again, **Then** it reports 0 and changes and audits nothing (EN-05.9)

---

### User Story 2 - Every re-encrypted value is audited (Priority: P1)

**Journey and role**: auditor reviewing who read and changed health data

Each value the job re-encrypts leaves one audit entry naming the system job (not a person), the
record and the run, committed together with the change. A value the job could not re-encrypt leaves
a "failed" entry. No health value appears in the audit log or the job's output.

**Why this priority**: SE-05 applies to every read and write of Restricted data; a system job is
not exempt.

**Independent Test**: integration test counting audit entries per action and run ID, and forcing
the audit step to fail for one row.

**Acceptance Scenarios**:

1. **Given** a run that re-encrypts N rows, **When** it finishes, **Then** the audit log holds exactly N re-encryption entries for that run, each naming the job as actor and the row's opaque ID (EN-05.7)
2. **Given** a row whose audit entry cannot be written, **When** the job processes it, **Then** that row keeps its old ciphertext and is counted as failed (EN-05.7)
3. **Given** a row that cannot be decrypted, **When** the job processes it, **Then** one "re-encryption failed" entry is written for it and its stored value is unchanged (EN-05.8)

---

### Edge Cases and failures

- KMS unavailable for the whole run: every row fails, the job finishes with all rows counted
  failed, exits non-zero and changes nothing (EN-05.4, EN-05.6).
- A row deleted during the run: its update matches nothing; counted skipped, no entry (EN-05.6).
- A note written by the API during the run: it is already on the current or a newer version, so it
  is not selected (EN-05.5).
- A rotation started during the run: rows already re-encrypted under the old target stay on it and
  are moved by the next run; rows on the newer version are never touched (EN-05.5).
- The job is stopped part-way (process killed): rows done so far are committed with their entries;
  the rest stay on the old version and are picked up by the next run (EN-05.4, EN-05.9).
- Two copies of the job run at once: each row's update is conditional on its old value, so one
  copy updates it and the other counts it skipped; entries are written only for actual updates
  (EN-05.6, EN-05.7).
- Output: counts, run ID and versions only; never IDs of failed rows' owners, ciphertext or
  plaintext (LM-02).

## Requirements _(mandatory)_

### Functional Requirements

These extend Step 2's EN-05.1 to EN-05.3 and spec 003's SE-05.5 to SE-05.10, which stay in force.

| ID      | Given / when / then                                                                                                                                                                                                                                                                                                           | Proof                                                                                                                        |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| EN-05.4 | Given stored values that cannot be updated (changed or deleted meanwhile) or cannot be decrypted, when the job runs, then it visits each stored row at most once and finishes; the number of rows it reads is at most the number of rows in the table when it started                                                         | Unit test `apps/api/src/jobs/reencrypt.spec.ts` (fake pool, bounded); integration test `apps/api/test/reencrypt.int-spec.ts` |
| EN-05.5 | Given rows on key versions below, equal to and above the target version (the current version when the run starts), when the job runs, then only rows below the target are re-encrypted, and rows equal to or above it are neither selected nor changed                                                                        | Integration test `reencrypt.int-spec.ts`; unit test `reencrypt.spec.ts`                                                      |
| EN-05.6 | Given a finished run, when it reports, then `reencrypted` equals the number of rows whose stored value actually changed, `skipped` and `failed` are reported separately, the output holds only counts, versions and the run ID, and the process exits non-zero when `failed` is above 0                                       | Unit test `reencrypt.spec.ts`; integration test `reencrypt.int-spec.ts`                                                      |
| EN-05.7 | Given a row re-encrypted by the job, when the change commits, then one `<entity>.reencrypt` audit entry (actor role `system`, actor `job:reencrypt`, the row's opaque ID, the run ID as correlation ID) commits in the same transaction; when that entry cannot be written, the row keeps its old value and is counted failed | Integration test `reencrypt.int-spec.ts`                                                                                     |
| EN-05.8 | Given a row that cannot be decrypted or re-encrypted, when the job processes it, then its stored value is unchanged and one `<entity>.reencrypt.failed` entry is written for it (best effort), with no Restricted value in any field                                                                                          | Integration test `reencrypt.int-spec.ts`                                                                                     |
| EN-05.9 | Given a run that ended with nothing skipped or failed, when the job runs again with no rotation in between, then it reports `reencrypted` 0 and writes no audit entry                                                                                                                                                         | Integration test `reencrypt.int-spec.ts`                                                                                     |

### Permissions

No HTTP endpoint. The job runs only from the operator's shell on the host (Session Manager, IAM
with MFA; SO-06) or locally, as the API database role, which may call `audit.append` and update
`app.patient_note` (Step 2 roles). No user role can start it.

| Action            | Patient | Provider | Admin | Other                                   | Criterion          |
| ----------------- | ------- | -------- | ----- | --------------------------------------- | ------------------ |
| Run re-encryption | No      | No       | No    | Operator on the host shell only (SO-06) | EN-05.4 to EN-05.9 |

### Key Entities and data classification

No new table or column. `app.patient_note.body` (Restricted, field-encrypted) is rewritten under the
new key version, as today. New audit values:

| Entity      | Field                                                          | Class    | Retention                        | Notes                                    |
| ----------- | -------------------------------------------------------------- | -------- | -------------------------------- | ---------------------------------------- |
| audit.entry | action `sample_note.reencrypt`, `sample_note.reencrypt.failed` | Internal | As the audit log (PR-05 pending) | Code constants                           |
| audit.entry | actor_role `system`, actor_id `job:reencrypt`                  | Internal | As the audit log                 | Identifies the job, never a person       |
| audit.entry | correlation_id `reencrypt-<uuid>`                              | Internal | As the audit log                 | One per run; printed in the job's output |

### Audit and consent

- **Audited**: each re-encrypted row (`sample_note.reencrypt`) in the same transaction as its
  update; each failed row (`sample_note.reencrypt.failed`), best effort. Actor is the system job;
  object is the row's opaque ID; never the value.
- **Consent**: none; re-encryption is a security operation on data already held, no new purpose.

## Screens, languages and accessibility

None. Operator command only; its output is English log lines (no user-facing strings).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: With 1,000 rows of which 50 are made un-updatable and 10 undecryptable, a run
  finishes in one pass: 940 re-encrypted, 50 skipped, 10 failed, exit code non-zero.
- **SC-002**: For every run, re-encryption audit entries for its run ID equal the reported
  `reencrypted` count (100%).
- **SC-003**: A second run straight after a clean run reports 0 and adds 0 audit entries.

## Clarifications

### Session 2026-10-22

Resolved by the author from review C-2, spec 003 and the goal brief, without an owner question
round; the owner confirms or changes each at review (research D-1 to D-5).

- Q: One audit entry per row or per batch? → A: Per row, in the row's transaction. SE-05 asks for
  an entry per Restricted read and write, and a per-row entry is what an auditor can trace to one
  record. Decision D-4 (cost: the audit lock per row; acceptable at today's volume).
- Q: Which actor? → A: Role `system`, actor `job:reencrypt`; never a person's ID. Decision D-4.
- Q: What is the target version if a rotation happens mid-run? → A: The version current when the run
  started; newer rows are left alone and the next run moves anything still below. Decision D-2.
- Q: Stop on the first failure? → A: No; finish, count failures, exit non-zero, so one bad row
  does not block the rest of a rotation. Decision D-3.

## Assumptions

- **Spec 003 lands first.** Its `withTransaction` helper and the "encrypt outside the transaction,
  audit last" pattern (spec 003 D-4) are reused unchanged.
- **Key versions are whole numbers** stored as text in each encrypted value (`@heach/crypto`
  writes `String(version)`); the comparison is numeric.
- **Row IDs are UUIDs**; the job walks them in ascending order, which is stable for the run even
  though IDs are random.
- **One domain, one column** (`health`, `app.patient_note.body`) today.

## Open questions

None.
