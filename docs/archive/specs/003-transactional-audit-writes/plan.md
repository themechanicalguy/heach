# Implementation Plan: Transactional domain writes and their audit entries

**Status**: Approved

**Spec**: [spec.md](spec.md) | **Date**: 2026-10-22 | **Approval**: Owner (Saurav Rath), 2026-10-22, explicit approval of this plan and its spec as drafted, with decisions D-1 to D-6 as written; takes effect when this docs-only pull request merges

**Input**: Feature specification from `specs/003-transactional-audit-writes/spec.md`

## Summary

Fix review finding S-2. Add one shared helper, `withTransaction(pool, work)`, in
`apps/api/src/data-stores/transaction.ts`: it takes a pool connection, runs `BEGIN`, the caller's
work and `COMMIT`, rolls back on any error, always releases the connection (destroying it when the
rollback fails) and rethrows the original error. `NotesRepository.create` encrypts the body
first, then inserts the row and appends its audit entry inside one `withTransaction`, with the
audit append as the last statement. `findOwned` and `listOwned` decrypt before they audit; a
decryption failure appends `.read.failed` or `.list.failed` and rethrows. `PgDataKeyStore.add`
replaces its hand-written transaction with the helper. No schema, endpoint or dependency change.
Decisions and rejected alternatives: [research.md](research.md).

## Technical Context

**Apps and packages touched**: `apps/api` only: `src/data-stores/transaction.ts` (new) and its
unit test; `src/sample-notes/notes.repository.ts` and its unit test; `src/crypto/pg-data-key-store.ts`;
`test/audit-transaction.int-spec.ts` (new).

**New dependencies**: None. Uses `pg` (`Pool.connect`, `PoolClient.release`) already in the stack.

**Storage**: None added. The `app.patient_note` insert and `audit.append` run on the same
connection inside one PostgreSQL transaction.

**Third parties**: None.

**Constraints**: `audit.append` takes a transaction-scoped advisory lock (`pg_advisory_xact_lock`)
that serialises every audited request (review P-2). Inside a transaction that lock is held until
`COMMIT`, so the append must be the last statement and no KMS or other network call may run while
the transaction is open. Pool size 10, connection timeout 1 second (unchanged).

## Constitution Check

_GATE: Must pass before research. Re-check after design._ Re-checked after design: unchanged.

| Principle                               | How this plan meets it                                                                                                        | Violation and justification |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| I Spec before code                      | No application code until this spec and plan merge as Approved; this pull request is docs only                                | None                        |
| II Traceable criteria                   | SE-05.5 to SE-05.10, each with a named test (Verification below)                                                              | None                        |
| III Data protection                     | Closes an SE-05 gap; owner-only access (SE-02.3) and encryption (EN-03) unchanged; no new data                                | None                        |
| IV Synthetic data, logs, secrets        | Seeded synthetic users and generated note text; error type only in logs; no Restricted value in any audit field               | None                        |
| V Languages, accessibility, performance | No strings or screens; the audit lock is held for one statement plus commit, as before                                        | None                        |
| VI Architecture, reuse, dependencies    | One plain function in the existing data-stores module, reused by notes and the data-key store; no new dependency or framework | None                        |
| VII Evidence-based completion           | Implementation status updated with test evidence in the implementation pull request; SE-05 stays Partial until then           | None                        |
| VIII Changes and exceptions             | Extends SE-05.1 to SE-05.4 without changing them; out-of-scope gaps (re-encryption job, P-2) listed with their backlog items  | None                        |
| IX Humans approve                       | Owner approves by merging; agent leaves Status Draft                                                                          | None                        |

## Project Structure

### Documentation (this feature)

```text
specs/003-transactional-audit-writes/
├── spec.md              # Behaviour
├── plan.md              # This file
├── research.md          # Decisions D-1 to D-6 and rejected alternatives
├── data-model.md        # No stored data; new audit action values
├── quickstart.md        # How to run the proofs
├── contracts/
│   └── transaction-helper.md   # Helper contract; HTTP behaviour on failure
├── checklists/
│   └── requirements.md
├── analysis.md          # Consistency analysis
└── tasks.md
```

### Source Code (repository root)

```text
apps/api/src/data-stores/transaction.ts            # new: withTransaction
apps/api/src/data-stores/transaction.spec.ts       # new: SE-05.9
apps/api/src/sample-notes/notes.repository.ts      # create in one transaction; reads audit after decrypt
apps/api/src/sample-notes/notes.repository.spec.ts # SE-05.1 kept; SE-05.6 insert failure
apps/api/src/crypto/pg-data-key-store.ts           # add() uses withTransaction (no behaviour change)
apps/api/test/audit-transaction.int-spec.ts        # new: SE-05.5 to SE-05.8, SE-05.10
```

## Data model and migrations

None. No table, column, index or function changes; `audit.append` is unchanged. New `action`
values are listed in [data-model.md](data-model.md).

## Encryption and keys

Unchanged. The note body is encrypted (`health` domain) before the transaction opens, so a KMS
call never runs while the audit lock could be held. Decryption failures (EN-03.2) are now audited
as `.read.failed` / `.list.failed`.

## API contracts

No endpoint, DTO or OpenAPI change; the generated client is unchanged. The helper's contract and
the HTTP behaviour on failure are in [contracts/transaction-helper.md](contracts/transaction-helper.md).

## Audit, logging and monitoring

- Audit: see spec "Audit and consent". Entries are written through `AuditService.record(event,
client)`, which already accepts a client.
- Logging: no new request-level lines. The helper logs `Rollback failed: <error name>` at warn
  through the Nest logger when `ROLLBACK` itself fails; never the SQL, parameters or values. The
  error filter logs the original error's type as today.
- Monitoring: a failed audit append returns 500 and so counts in the LM-07.1 5xx error-rate
  monitor, which is the signal an operator needs.

## Threat model

Assets: the audit log as evidence of every access to Restricted data; the note bodies; API
availability. Entry points: `POST /v1/sample/notes`, `GET /v1/sample/notes`,
`GET /v1/sample/notes/:id`; and every future repository that uses the helper.

| Threat                                                                            | Mitigation                                                                                       | Criterion                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Repudiation: a Restricted write is stored with no audit entry (S-2)               | Row and entry in one transaction; the entry is required for commit                               | SE-05.5                                      |
| Repudiation (false record): an entry says data was created when the write failed  | Entry appended after the insert, in the same transaction; encryption failure stops before either | SE-05.6                                      |
| Repudiation (false record): an entry says data was read when it was not delivered | Decrypt before auditing; failure recorded as `.read.failed` / `.list.failed`                     | SE-05.7                                      |
| Information disclosure: Restricted data returned without an audit entry           | Audit before return; an audit error returns 500 and no data                                      | SE-05.8                                      |
| Denial of service: connections leaked by failed transactions exhaust the pool     | Helper releases in `finally`; destroys the connection when `ROLLBACK` fails                      | SE-05.9, SE-05.10                            |
| Denial of service: the audit log's global lock held longer inside a transaction   | Audit append is the last statement; encryption and KMS before `BEGIN`; one insert in between     | SE-05.5 (ordering asserted in its unit test) |
| Information disclosure: failure details in responses or logs                      | Generic 500 body (Step 2 filter); error type only in logs; no values in audit fields             | SE-05.5, SE-05.7                             |
| Tampering: a caller passes free text into an audit action                         | New actions are code constants built from the repository's entity name (S-3 out of scope)        | SE-05.7                                      |

## Rollout

One API release; no flag (a correctness fix invisible to users when nothing fails). No migration.
Rollback is a redeploy of the previous image. No data repair is needed: entries already written
stay valid; this changes only future writes.

## Verification

| Criterion          | Test or check                                                                                                                                                                                                                                                                                                 | Where it runs                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| SE-05.5            | `audit-transaction.int-spec.ts` "SE-05.5 …": the `AuditService` spy sends a failing `audit.append` through the transaction's own client; 500, no note row; repeated 50 times (SC-001). Unit: `notes.repository.spec.ts` asserts order `BEGIN`, insert, audit, `COMMIT` and that encryption ran before `BEGIN` | CI Checks job (unit and integration) |
| SE-05.6            | `audit-transaction.int-spec.ts` "SE-05.6 …": encryptor spy throws; no row, no `sample_note.create` entry. Unit: insert fails → `audit.record` not called, `ROLLBACK` sent. SC-002 count check over 50 saves                                                                                                   | CI Checks job                        |
| SE-05.7            | `audit-transaction.int-spec.ts` "SE-05.7 …": test alters a stored ciphertext's tag; open and list return 500 with no body text; one `.read.failed` / `.list.failed` entry, no `.read` / `.list` for that correlation ID                                                                                       | CI Checks job                        |
| SE-05.8            | `audit-transaction.int-spec.ts` "SE-05.8 …": audit spy throws on read; 500; response contains no note text                                                                                                                                                                                                    | CI Checks job                        |
| SE-05.9            | `transaction.spec.ts` "SE-05.9 …": fake pool client; commit path, rollback path, original error rethrown, `release` called once, `release(error)` when `ROLLBACK` throws                                                                                                                                      | CI Checks job (unit)                 |
| SE-05.10           | `audit-transaction.int-spec.ts` "SE-05.10 …": 30 failed saves (3 × pool size 10, SC-003), then a save succeeds                                                                                                                                                                                                | CI Checks job                        |
| SE-05.1 to SE-05.4 | Existing tests, `SE-05.1` adapted to the new fake pool only                                                                                                                                                                                                                                                   | CI Checks job                        |
| Regression proof   | With the current repository, SE-05.5 and SE-05.7 fail (recorded in tasks.md evidence)                                                                                                                                                                                                                         | Local, once                          |

## Complexity Tracking

None. No principle is violated.
