# Research: Bounded, audited re-encryption after a key rotation

Inputs: review C-2 and T-3 (`docs/reviews/2026-10-18-codebase-review.md`, not committed); Step 2
spec EN-05.1 to EN-05.3 and SE-05.1; spec 003 (helper, D-4 ordering); backlog item 4; key-rotation
runbook; code on `main` at 7c8c1c9.

## Current behaviour (read 2026-10-22, `main` 7c8c1c9)

- `reencryptHealth` (`apps/api/src/jobs/reencrypt.ts:19-43`) reads `current` once, then loops:
  `SELECT id, body FROM app.patient_note WHERE body ->> 'keyVersion' <> $1 LIMIT 100`; for each row
  decrypt, encrypt, `UPDATE … WHERE id = $1 AND body = $3`, `done += 1`; it stops only when the
  select returns no rows.
- Never-ending cases: (1) the conditional update matches 0 rows (row changed or deleted) and the
  row still has an old version → selected again forever; (2) a rotation during the run → rows
  written under the newer version are `<> current`, re-encrypted with the newer key (still
  `<> current`) and selected forever; (3) more than 100 rows that keep failing (1) fill every batch.
- A decrypt or encrypt error throws and aborts the whole run (no count, no partial report).
- `done` counts attempts, not updates (`rowCount` ignored).
- No audit entry for the read or the rewrite of Restricted data (SE-05.1 gap; spec 003 out of
  scope).
- No request context: `AuditService.record` would write role `anonymous`, correlation `none`.
- `keyVersion` is `String(version)`; `'10' <> '9'` works, but text ordering (`'10' < '9'`) would
  not, so any ordering must cast to integer.
- The runbook runs the job as the API container (`docker compose run … node dist/jobs/reencrypt.js`),
  so it uses the API role, which may call `audit.append`.

## Decisions

### D-1 Keyset walk by ID, one pass (owner to confirm)

- **Decision**: `SELECT id, body … WHERE id > $cursor AND (body->>'keyVersion')::int < $target
ORDER BY id LIMIT $batch`; the cursor moves to the last ID of each batch whatever happened to
  the rows. The run ends when a batch is empty.
- **Why**: each row is read at most once per run, so the run is bounded by the table size at
  start (EN-05.4), without a progress table.
- **Alternatives**: (a) a progress table for resumable runs: more schema for no gain (a re-run is
  already cheap and idempotent); rejected. (b) `OFFSET` paging: rows shift as they are updated;
  rejected.

### D-2 Target = version current at start; select strictly older

- **Decision**: `target = currentKeyVersion('health')` read once; select `::int < target`.
  Encryption uses whatever version is current at that moment (target or newer).
- **Why**: never touches rows on newer versions (EN-05.5); a mid-run rotation is finished by the
  next run.

### D-3 Count outcomes, finish, exit non-zero on failure

- **Decision**: per row: `reencrypted` when the update's `rowCount` is 1; `skipped` when 0;
  `failed` when decrypt, encrypt, update or audit throws. The job logs the three counts, run ID and
  versions and sets `process.exitCode = 1` when `failed > 0`.
- **Why**: truthful counts (EN-05.6); one bad row does not block the rotation; the operator sees
  failure in the exit status.

### D-4 Per-row audit in the row's transaction, as the system job

- **Decision**: decrypt and encrypt outside any transaction (KMS calls; spec 003 D-4); then
  `withTransaction`: conditional `UPDATE`, and if `rowCount` is 1, `audit.record({ action:
'sample_note.reencrypt', … }, client)` as the last statement. On failure after lookup, append
  `sample_note.reencrypt.failed` best effort. The run executes inside `runWithContext` with
  correlation ID `reencrypt-<uuid>` and a system actor: `RequestContext` gains an optional
  `system` field (`'job:reencrypt'`), and `AuditService.record` writes actor ID from it and role
  `system` when there is no principal.
- **Why**: SE-05 per record; atomic with the change (EN-05.7); identifies the job, not a person.
- **Alternatives**: (a) one entry per batch or per run: cannot trace a single record; rejected.
  (b) pass actor and role in `AuditEvent`: lets any caller claim any actor; rejected in favour of
  the context, which only the job's entry point sets.

### D-5 Batch size stays 100

- **Decision**: keep `BATCH = 100`; memory and per-statement time are bounded by it. No new flag.

## Rejected for this feature

- Parallel workers or `SKIP LOCKED` queues: unnecessary at today's volume; revisit with P-2.
- Retiring old key versions: separate decision (spec Out of scope).
