# Feature Specification: Transactional domain writes and their audit entries

**Status**: Draft

**Step**: [Step 2 spec](../../docs/specs/step-02-secure-foundation.md) of the [guideline](../../docs/mvp-v1-implementation-guideline.md) (audit log, SE-05.1 to SE-05.4)

**Requirements in scope**: SE-05 (audit of every read and write of Restricted data); SO-01 (threat model, in plan.md); LM-02 (no personal data in logs); TS-01, TS-03 (test evidence)

**Approval**:

**Created**: 2026-10-22

**Input**: User description: "Transactional domain writes and audit entries (SE-05; review S-2; backlog item 2)"

## Scope

Every write of Restricted data and its audit entry must succeed or fail together, and a read of
Restricted data must be audited as successful only when the data was actually returned. Today the
sample note's insert and its audit entry are two separate statements: if the audit call fails
(pool exhausted, audit lock wait, database error), the note is stored with no audit entry, which
breaks SE-05. A read is audited before the body is decrypted, so a decryption failure still leaves
a "read" entry for data nobody received (finding S-2 of the 18 October 2026 codebase review,
`docs/reviews/2026-10-18-codebase-review.md`, not committed). This feature makes the write and its
entry one unit, records reads only after they succeed (and records the failed attempt otherwise),
and gives the API one shared way to run several statements as a unit, so Step 3's repositories and
the session-rotation fix (backlog item 3) reuse it instead of writing their own.

**Out of scope** (tracked in the [backlog](../../docs/backlog.md) or a later step):

- Session rotation in one transaction, replay under concurrency and cookie handling on server
  errors (backlog item 3, its own spec; it reuses this feature's helper).
- Audit entries for the re-encryption job, and bounding it (backlog item 4, EN-05; review C-2).
  The job reads and rewrites Restricted ciphertext without audit entries today; item 4's spec
  decides how a system job is audited.
- The audit log's global lock as a throughput ceiling, lock and statement timeouts, and the
  verifier's full scan (review P-2; an ADR note, not this feature).
- The audit hash input format (review S-3).
- Audit of admin actions (no admin action exists yet; Step 3, AD-01 to AD-03).
- Step 3 repositories (accounts, consent, onboarding), bookings and payments. They adopt the
  helper when they are specified; none is built here.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - No Restricted write without its audit entry (Priority: P1)

**Journey and role**: patient saving a note (the Step 2 sample flow; later every Restricted write);
auditor reading the audit log

A patient saves a note. If the audit entry cannot be written, the note is not stored either, and
the patient sees the screen's error state and can try again. If the note cannot be stored, no
audit entry claims it was. The audit log and the data never disagree.

**Why this priority**: SE-05 is the evidence trail for health data; a write with no entry is a
compliance gap that cannot be repaired afterwards.

**Independent Test**: integration test that makes the audit step fail inside the real database
transaction and counts note rows and audit entries.

**Acceptance Scenarios**:

1. **Given** a patient saving a note, **When** its audit entry cannot be written, **Then** the request fails with the generic server error and no note row exists (SE-05.5)
2. **Given** a patient saving a note, **When** the note cannot be stored, **Then** no audit entry for that note's creation exists (SE-05.6)

---

### User Story 2 - Reads are audited as what actually happened (Priority: P1)

**Journey and role**: patient opening or listing notes; auditor

A successful read leaves a "read" entry. A read that fails after the row was found (for example
the ciphertext cannot be decrypted) leaves a "read failed" entry instead, and the patient gets the
generic error. If the read's audit entry cannot be written, the patient gets the generic error and
no Restricted data.

**Why this priority**: an entry saying data was read when it was not, or data returned with no
entry, both make the audit log untrustworthy.

**Independent Test**: integration tests with a corrupted ciphertext and with a failing audit step.

**Acceptance Scenarios**:

1. **Given** a note whose stored ciphertext cannot be decrypted, **When** its owner opens or lists it, **Then** the response is the generic server error with no body text, and the audit log holds a "read failed" entry and no successful "read" entry for it (SE-05.7)
2. **Given** a note the user owns, **When** the read's audit entry cannot be written, **Then** the response is the generic server error and contains no Restricted data (SE-05.8)

---

### User Story 3 - One shared way to write as a unit (Priority: P2)

**Journey and role**: developer writing a repository (Step 3 onwards)

A repository that changes several rows, or a row and its audit entry, runs them through one shared
helper that commits all or none and always gives the database connection back, even when the
rollback itself fails. The data-key store, which already writes two rows by hand, uses it too.

**Why this priority**: prevents each repository from writing its own transaction code with its
own mistakes; it is what backlog item 3 and Step 3 build on.

**Independent Test**: unit tests of the helper with a fake connection; an integration test that
repeated failures leave the connection pool usable.

**Acceptance Scenarios**:

1. **Given** a unit of work that succeeds, **When** it runs through the helper, **Then** all its statements are committed; **Given** one that throws, **Then** none are, the original error reaches the caller, and the connection is returned to the pool, also when the rollback fails (SE-05.9)
2. **Given** more failed units of work than the pool has connections, **When** the next request runs, **Then** it succeeds (no connection leaked) (SE-05.10)

---

### Edge Cases and failures

- The connection pool is exhausted when a write starts: the request fails with the generic error
  before anything is written; nothing to roll back (SE-05.5 holds trivially).
- The audit entry is written but the commit fails (connection lost at commit): PostgreSQL discards
  both; the client gets the generic error (SE-05.5).
- Encryption of the note body fails before the transaction opens: nothing is written, nothing is
  audited as created (SE-05.6).
- A read of a note the user does not own: unchanged; audited as `read.denied` and answered 404
  (SE-02.3).
- A list where one of several notes cannot be decrypted: the whole list fails with the generic
  error and one "list failed" entry is written; no partial list is returned (SE-05.7).
- If the "read failed" entry itself cannot be written, the request still fails with the generic
  error; the original failure is what is logged (error type only).
- The authorisation-failure entry (`access.denied.role`) has no paired data write; it stays a
  single statement, as today.
- Two notes saved at the same moment: each is its own unit; the audit chain orders them as today.

## Requirements _(mandatory)_

### Functional Requirements

These extend Step 2's SE-05.1 to SE-05.4, which stay in force.

| ID       | Given / when / then                                                                                                                                                                                                                                                                                                         | Proof                                                                                                            |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| SE-05.5  | Given a write of a Restricted field (note create), when its audit entry cannot be written, then the request returns the generic 500 error body and no row from that write exists afterwards                                                                                                                                 | Integration test `apps/api/test/audit-transaction.int-spec.ts`                                                   |
| SE-05.6  | Given a write of a Restricted field, when the data write itself fails (or encryption fails before it), then no audit entry recording that write as done exists                                                                                                                                                              | Integration test `audit-transaction.int-spec.ts`; unit test `apps/api/src/sample-notes/notes.repository.spec.ts` |
| SE-05.7  | Given a Restricted read (one note or a list) that fails after the rows were found, when the request ends, then the response is the generic 500 with no Restricted data, and the audit log holds one `<entity>.read.failed` or `<entity>.list.failed` entry and no `<entity>.read` or `<entity>.list` entry for that request | Integration test `audit-transaction.int-spec.ts` (corrupted ciphertext)                                          |
| SE-05.8  | Given a Restricted read, when its audit entry cannot be written, then the response is the generic 500 and contains no Restricted data                                                                                                                                                                                       | Integration test `audit-transaction.int-spec.ts`                                                                 |
| SE-05.9  | Given a unit of work run through the shared transaction helper, when it completes, then all its statements are committed; when it throws, none are, the caller receives the original error, and the connection is released, also when `ROLLBACK` fails                                                                      | Unit test `apps/api/src/data-stores/transaction.spec.ts`                                                         |
| SE-05.10 | Given more failed units of work in a row than the pool's size, when the next request runs, then it succeeds                                                                                                                                                                                                                 | Integration test `audit-transaction.int-spec.ts`                                                                 |

### Permissions

No new actions and no change to who may call what. The sample note stays owner-only (SE-02).

| Action                              | Patient            | Provider     | Admin                   | Other | Criterion                                      |
| ----------------------------------- | ------------------ | ------------ | ----------------------- | ----- | ---------------------------------------------- |
| Create, read, list own sample notes | Allowed (own only) | Denied (403) | Denied (no sign-in yet) | 401   | SE-05.5 to SE-05.8 (behaviour on failure only) |

### Key Entities and data classification

No new table, column or stored field. Two new audit `action` values, `sample_note.read.failed`
and `sample_note.list.failed` (class Internal, like every `action`; code constants, never user
input). The audit entry's other fields and their classes are unchanged (Step 2 spec data table).
Retention unchanged.

### Audit and consent

- **Audited**: unchanged events (`sample_note.create`, `.read`, `.read.denied`, `.list`) plus
  `.read.failed` and `.list.failed`. What changes is when they are written: a create's entry in
  the same transaction as the row; a read's entry after decryption succeeds.
- **Consent**: none; no new data or purpose.

## Screens, languages and accessibility

- **Screens**: none changed. A 500 already shows the screen's error state with a retry (UX-04).
- **States**: unchanged.
- **Viewports**: not applicable (API only).
- **Languages**: no new keys.
- **Accessibility**: not applicable.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Across 50 note saves with the audit step forced to fail, 0 notes are stored.
- **SC-002**: Across 50 successful note saves, the number of `sample_note.create` entries equals
  the number of notes stored (100%).
- **SC-003**: After 3 × the pool size of failed saves, a normal save succeeds within the usual
  response time (no exhausted pool).

## Clarifications

### Session 2026-10-22

Resolved by the author from the review, the approved Step 2 spec and the goal brief, without an
owner question round; the owner confirms or changes each at review (plan.md research D-1 to D-5).

- Q: Should a read and its audit entry be one transaction too? → A: No. A read changes no data, so
  there is nothing to roll back; what matters is the order: decrypt, then audit, then return. If
  the audit fails nothing is returned (SE-05.8). Decision D-2.
- Q: Record a failed read, or record nothing? → A: Record it as `read.failed` / `list.failed`. The
  row was looked up for that user, so the attempt belongs in the log (repudiation); calling it a
  read would be false (SE-05.7). Decision D-3.
- Q: What does the client see when the audit step fails? → A: The generic 500 (Step 2 error
  filter); no new error code, no detail.
- Q: Is the encryption (KMS) call inside the transaction? → A: No; the body is encrypted first and
  the transaction holds only the insert and the audit entry, so the audit log's global lock is
  held as briefly as possible (plan.md). Decision D-4.

## Assumptions

- **One database.** The note and the audit log are in the same PostgreSQL database (Step 2), so
  one transaction covers both. If the audit log ever moves to a separate store, this feature's
  guarantee needs a new design (outbox) in that change's spec.
- **Step 2 behaviour stays.** SE-05.1 to SE-05.4, the audit function's interface, the hash chain,
  owner-only access (SE-02.3) and the error filter are unchanged.
- **Sample notes stand in for Restricted data.** Today they are the only Restricted write path;
  the criteria are proven on them and apply to each later repository through the helper.

## Open questions

None.
