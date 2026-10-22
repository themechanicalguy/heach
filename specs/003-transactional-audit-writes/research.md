# Research: Transactional domain writes and their audit entries

Inputs: review S-2, S-3 and P-2 (`docs/reviews/2026-10-18-codebase-review.md`, not committed);
Step 2 spec SE-05.1 to SE-05.4 and its data table; backlog items 2 to 4; current code on `main`
at 7fd1ba7.

## Current behaviour (read 2026-10-22)

- `NotesRepository.create` encrypts the body, runs `INSERT INTO app.patient_note` on the pool, then
  calls `AuditService.record` as a second, separate pool statement. A failure in the second leaves
  the row without an entry.
- `findOwned` and `listOwned` select, audit (`read` / `list`), then decrypt. A decryption failure
  (EN-03.2) leaves a `read` entry for data that was never returned. An audit failure already stops
  the response (the audit call is awaited before decryption), so data is not returned unaudited.
- `AuditService.record(event, client = pool)` already takes a client, so it can run inside a
  transaction without change.
- `audit.append` (SECURITY DEFINER) takes `pg_advisory_xact_lock(hashtext('audit.entry'))`, reads
  the last hash and inserts. Called on the pool, the lock lasts one statement; inside a
  transaction, until `COMMIT`.
- `PgDataKeyStore.add` is the only hand-written transaction (`connect`, `BEGIN`, two statements,
  `COMMIT` / `ROLLBACK`, `release`). It does not destroy the connection when `ROLLBACK` fails.
- `jobs/reencrypt.ts` reads and rewrites `patient_note.body` with no audit entries (out of scope:
  backlog item 4).
- `PG_POOL` is a `pg.Pool` (max 10, connection timeout 1 second); `createApp` has no provider
  override hook, so integration tests inject faults with `vi.spyOn` on the app's singletons.

## Decisions

### D-1 Helper shape: a plain function (owner to confirm)

- **Decision**: `withTransaction<T>(pool, work: (client) => Promise<T>): Promise<T>` in
  `apps/api/src/data-stores/transaction.ts`. Repositories pass the client to their own queries and
  to `AuditService.record`.
- **Why**: the plainest thing that works; explicit about which statements share the transaction;
  no new dependency; testable with a fake pool.
- **Alternatives**: (a) ambient transactions through `AsyncLocalStorage` (the request context
  already uses it): no client passing, but any query can silently join or miss the transaction;
  rejected. (b) a transactional library or decorator: new dependency; rejected under the working
  rules. (c) a Nest provider class: adds injection for no gain over a function; rejected.

### D-2 Reads are not wrapped in a transaction

- **Decision**: reads keep using the pool. Order: select, decrypt, audit, return.
- **Why**: a read changes no data, so a transaction has nothing to roll back; it would only hold
  a connection and the audit lock longer. The order alone gives SE-05.7 and SE-05.8.

### D-3 Failed reads are audited as failed

- **Decision**: a decryption (or other) failure after the rows were found appends
  `<entity>.read.failed` or `<entity>.list.failed`, best effort, then rethrows the original error.
- **Why**: the lookup for that user happened, so the attempt belongs in the evidence trail; calling
  it a read would be false. Best effort, because a broken audit path must not hide the original
  error; the request fails either way.
- **Alternative**: audit nothing on failure. Simpler, but an attacker probing tampered rows would
  leave no trace; rejected.

### D-4 Encrypt before the transaction; audit last

- **Decision**: `create` encrypts first, then opens the transaction for the insert and the append,
  in that order.
- **Why**: P-2: the global advisory lock is held from the append to `COMMIT`. Putting the append
  last keeps that to one statement, as today; a KMS call inside the transaction would hold a pool
  connection during a network call.

### D-5 Connection handling on rollback failure

- **Decision**: if `ROLLBACK` throws, call `client.release(error)` so `pg` destroys that
  connection instead of returning one in an unknown state, log `Rollback failed: <error name>` at
  warn, and rethrow the original error, not the rollback error.
- **Why**: a connection left mid-transaction would make the next borrower's statements fail or,
  worse, join a broken transaction (SE-05.9, SE-05.10).

### D-6 Reuse in the data-key store

- **Decision**: `PgDataKeyStore.add` uses `withTransaction`; same statements, same order.
- **Why**: one transaction implementation in the API (CLAUDE.md "Keep it DRY"); gains D-5.

## Not changed

- `audit.append`, the hash chain and its verifier, the audit role grants, the authorisation-failure
  entry (single statement, no paired write), the error filter, routes and DTOs, the re-encryption
  job, lock and statement timeouts.
