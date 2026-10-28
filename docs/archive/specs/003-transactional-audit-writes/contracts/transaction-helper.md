# Contract: transaction helper and failure behaviour

Internal contract (no endpoint, DTO or OpenAPI change).

## `withTransaction`

```ts
// apps/api/src/data-stores/transaction.ts
export type TransactionClient = Pick<pg.PoolClient, 'query'>;
export function withTransaction<T>(
  pool: Pick<pg.Pool, 'connect'>,
  work: (client: TransactionClient) => Promise<T>,
): Promise<T>;
```

1. Borrows one connection (`pool.connect()`); if that fails, the error propagates and nothing runs.
2. Sends `BEGIN`, awaits `work(client)`, sends `COMMIT`, releases the connection, returns `work`'s
   result.
3. If `work` or `COMMIT` throws: sends `ROLLBACK`, releases the connection, rethrows the original
   error.
4. If `ROLLBACK` throws: releases with that error (the connection is destroyed), logs
   `Rollback failed: <error name>` at warn, rethrows the original error.
5. The connection is released exactly once on every path.

Callers must run every statement of the unit on `client`, never on the pool, and must not call
network services (KMS, SMS, payments) inside `work`.

## HTTP behaviour on failure

| Route                      | Failure                                          | Response                                       | Audit                                   |
| -------------------------- | ------------------------------------------------ | ---------------------------------------------- | --------------------------------------- |
| `POST /v1/sample/notes`    | Encryption, insert, audit append or commit fails | 500, standard `ErrorResponse`, generic message | Nothing for this request (rolled back)  |
| `GET /v1/sample/notes/:id` | Decryption fails                                 | 500, generic                                   | `sample_note.read.failed` (best effort) |
| `GET /v1/sample/notes/:id` | Audit append fails                               | 500, generic, no note data                     | None                                    |
| `GET /v1/sample/notes`     | Any note fails to decrypt                        | 500, generic, no partial list                  | `sample_note.list.failed` (best effort) |
| `GET /v1/sample/notes`     | Audit append fails                               | 500, generic, no note data                     | None                                    |

Not found or not owned is unchanged: 404, `sample_note.read.denied` (SE-02.3).
