# Feature Specification: Recurring restore verification of the nightly backup

**Status**: Draft

**Step**: [Step 2 spec](../../docs/specs/step-02-secure-foundation.md) of the [guideline](../../docs/mvp-v1-implementation-guideline.md) (backups, EN-10.3 and EN-10.4)

**Requirements in scope**: EN-10 (backups encrypted, restore-tested); SE-05 (audit of Restricted-data access); SO-01 (threat model, in plan.md); LM-02 (no personal data in logs); LM-07 (alerts); TS-01, TS-03 (test evidence)

**Approval**: Not approved. Needs the owner's explicit approval of this spec and its plan, with decisions D-1 to D-5 in [research.md](research.md); takes effect when the approval pull request merges

**Created**: 2026-10-24

**Input**: Goal brief: "Complete operational engineering tasks, including recurring restore verification, only within approved scope" (backlog item 5; [Step 2 assessment](../../docs/step-2-assessment-2026-10-22.md#backups-and-recovery): "Recurring restore verification: none scheduled")

## Scope

EN-10 asks for backups that are "restore-tested quarterly". Today the dev host makes a nightly
encrypted dump (EN-10.3), and a restore was proven twice, by hand, on 18 October (EN-10.4). Nothing
repeats that proof. A dump that silently stops restoring, or whose Restricted fields stop
decrypting, would be found only when it is needed.

This feature runs the restore proof on a schedule on the dev host: take the newest dump, restore it
into a throwaway database, check the audit chain and that Restricted values decrypt, drop the
throwaway database, and alert on any failure. Each run leaves a record without any personal data.

**Out of scope** (tracked in the [backlog](../../docs/backlog.md) or a later step):

- Recovering Restricted fields from the off-account copy without the AWS account (the dev KMS keys
  wrap them). That needs an owner decision and an ADR before real data (backlog item 5, second half).
- Automating the weekly off-account pull to the owner's computer (EN-10.3; owner action).
- Staging and production schedules, a second Region, managed backups (D1; pilot and Step 10, SO-10
  drill).
- Restoring into the live `heach` database (disaster recovery; runbook step, unchanged).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - The newest backup is proven restorable on a schedule (Priority: P1)

**Journey and role**: owner relying on backups; operator reading the record

Every week the host restores the newest nightly dump into a new, empty database, checks it and
deletes it. If the dump is missing, too old, does not restore, has a broken audit chain or its
Restricted values do not decrypt, the owner gets an alert naming the failed stage. A run that passes
leaves a record of when it ran, which dump it used, and counts.

**Why this priority**: EN-10's "restore-tested" is the only proof that backups are usable; one-off
records from 18 October say nothing about tonight's dump.

**Independent Test**: integration test that runs the check against a local dump (passes), a
truncated dump, a dump with one corrupted ciphertext and a dump with a broken audit link (each
fails at the right stage), and confirms the throwaway database is gone afterwards.

**Acceptance Scenarios**:

1. **Given** a valid newest dump, **When** the check runs, **Then** it passes, records the dump name, row counts and decrypted count, and leaves no throwaway database (EN-10.5, EN-10.8)
2. **Given** no dump newer than 26 hours, **When** the check runs, **Then** it fails at stage `freshness` and alerts (EN-10.6)
3. **Given** a dump that does not restore, a broken audit link, or a Restricted value that does not decrypt, **When** the check runs, **Then** it fails at stage `restore`, `audit-chain` or `decrypt` respectively and alerts (EN-10.6, EN-10.7)
4. **Given** any run, **When** it ends, **Then** the live `heach` database is unchanged except for one audit entry for the check (EN-10.9)

### User Story 2 - Nothing personal leaves the check (Priority: P1)

**Journey and role**: auditor; owner reading alerts

The check reads Restricted values only to prove they decrypt and discards them. Its log lines,
record and alert hold stage names, the dump's object name, counts and a run ID, never a value,
ciphertext, user ID or note ID. The access is audited as the system job.

**Independent Test**: the integration test captures the check's output and alert payload and fails
if a synthetic note body, user ID or note ID appears; and counts the audit entry.

**Acceptance Scenarios**:

1. **Given** a run, **When** it decrypts Restricted values, **Then** one `backup.restore_check` audit entry (actor `job:restore-check`) is written to the live database with the run ID and counts only (EN-10.10)
2. **Given** a run that fails, **When** it alerts, **Then** the alert text holds the stage, dump name and run ID only (EN-10.6, LM-02)

### Edge Cases and failures

- Host asleep at the scheduled time (`dev-sleep`): the timer catches up on wake (`Persistent=true`),
  as the backup timer does.
- The nightly dump and the check overlap: the check starts 3 hours after the dump's slot and uses
  the newest object that is complete (S3 objects appear only when fully written).
- The check is killed part-way: the next run first drops any throwaway database older than one day
  (prefix `heach_restorecheck_`), so none accumulates (EN-10.8).
- Disk too small for a restore: the restore fails, the check alerts at stage `restore`, and the
  throwaway database is dropped.
- SNS publish fails: the run still exits non-zero and the journal holds the failure; publication
  is not delivery (the email subscription is confirmed in AWS; inbox receipt is confirmed only by the owner).
- KMS unavailable: fails at stage `decrypt`; nothing is retried within the run.

## Requirements _(mandatory)_

### Functional Requirements

These extend Step 2's EN-10.1 to EN-10.4, which stay in force.

| ID       | Given / when / then                                                                                                                                                                                                                                                                                                         | Proof                                                                                      |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| EN-10.5  | Given the schedule, when it fires, then the newest dump is restored into a new database named `heach_restorecheck_<time>` with stop-on-error, and the run records the dump's object name, the row count of each application table and the number of Restricted values decrypted                                             | Integration test `apps/api/test/restore-check.int-spec.ts`; host record in the runbook     |
| EN-10.6  | Given a missing dump or a newest dump older than 26 hours, a failed restore, a broken audit chain or a failed decryption, when the check runs, then it stops at that stage, exits non-zero and publishes one alert naming the stage, the dump name and the run ID                                                           | Integration test `restore-check.int-spec.ts` (one case per stage); unit test for freshness |
| EN-10.7  | Given a restored database, when the check runs, then `audit.verify_chain()` reports no broken link and every Restricted value of the sample-note table decrypts with authentication (up to 1,000 rows, newest first)                                                                                                        | Integration test `restore-check.int-spec.ts` (corrupted ciphertext, broken link)           |
| EN-10.8  | Given any run, passed, failed or killed, when it ends or the next run starts, then no `heach_restorecheck_*` database older than one day exists                                                                                                                                                                             | Integration test `restore-check.int-spec.ts`                                               |
| EN-10.9  | Given any run, when it ends, then the live `heach` database has no change except the one audit entry of EN-10.10, and the check never connects to it with a role that can write application tables                                                                                                                          | Integration test `restore-check.int-spec.ts` (table checksums before and after)            |
| EN-10.10 | Given a run that decrypts Restricted values, when it ends, then one `backup.restore_check` audit entry (actor role `system`, actor `job:restore-check`, run ID as correlation ID, outcome and counts, no IDs or values) is in the live database; the check's output and alert hold no value, ciphertext, user ID or note ID | Integration test `restore-check.int-spec.ts` (output and payload scanned)                  |

### Permissions

No HTTP endpoint and no user role. The check runs as a systemd timer on the dev host with the roles
as they are since spec 007: the host role reads `pg/*` from S3; the one-off API container
decrypts with the API role; the failure alert is published with the API role's credentials
(research D-5). No IAM change. It also runs locally or in CI against local services.

| Action                | Patient | Provider | Admin | Other                                          | Criterion           |
| --------------------- | ------- | -------- | ----- | ---------------------------------------------- | ------------------- |
| Run the restore check | No      | No       | No    | Host timer; operator on the host shell (SO-06) | EN-10.5 to EN-10.10 |

### Key Entities and data classification

No new table or column. Throwaway databases hold a copy of production-shaped data (today synthetic)
for minutes and are dropped. New audit and record values:

| Entity             | Field                                                                   | Class    | Retention                        | Notes                                          |
| ------------------ | ----------------------------------------------------------------------- | -------- | -------------------------------- | ---------------------------------------------- |
| audit.entry        | action `backup.restore_check`, actor `job:restore-check`, role `system` | Internal | As the audit log (PR-05 pending) | Code constants                                 |
| audit.entry        | correlation_id `restorecheck-<uuid>`; detail: outcome, stage, counts    | Internal | As the audit log                 | No IDs or values                               |
| Journal and record | dump object name, table row counts, decrypted count, stage, run ID      | Internal | Journal default; runbook table   | Object names are timestamps (`pg/<time>.dump`) |

### Audit and consent

- **Audited**: each run that reaches the decrypt stage writes one `backup.restore_check` entry to
  the live database as the system job, with outcome and counts (decision D-3). Per-row entries are
  not written: the rows read are copies in a database dropped minutes later, and the entry's purpose
  is to show who accessed Restricted data, when and how much.
- **Consent**: none; verifying backups is a security operation on data already held, no new purpose.

## Screens, languages and accessibility

None. Host job only; English log lines and alert text, no user-facing strings.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: On the dev host, the check runs every week without manual action; four consecutive
  weekly records show a pass, or an alert for each failure.
- **SC-002**: Each of the four failure stages (freshness, restore, audit chain, decrypt) produces
  exactly one alert naming that stage in the integration test (100%).
- **SC-003**: After 10 runs, including 3 killed part-way, no `heach_restorecheck_*` database older
  than one day exists.
- **SC-004**: A run on the dev-host data set (under 1 MB today) completes in under 2 minutes.

## Assumptions

- **Specs 003 and 005 are on `main`**: `withTransaction`, the system audit actor (spec 005) and the
  field decryptor are reused unchanged.
- **The existing roles suffice** (`infra/modules/app-host/main.tf`, as applied for spec 007 and
  checked live on 24 October 2026): the host role has S3 Get and List on `pg/*` and the backup key;
  the API role has the data-domain keys and SNS publish on the alert topic. No infrastructure
  change. (Amended 24 October 2026: the first draft assumed the host role still held data keys and
  SNS publish, which spec 007 removed.)
- **One Restricted column** (`app.patient_note.body`) holds data today; each step that adds one
  extends the decrypt stage in the same pull request (as the re-encryption runbook rule).
- **Cost**: within free usage (a few S3 GETs and KMS decrypts a week, minutes of the existing host).

## Open questions

None. Decisions D-1 to D-5 in [research.md](research.md) are for the owner to confirm at approval.
