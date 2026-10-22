# Data model: Bounded, audited re-encryption after a key rotation

No table, column, index, function, Redis key or browser storage is added or changed.

## New audit values

Written by the job through `AuditService.record` into existing `audit.entry` columns (class
Internal, Step 2 data table). Code constants; never input.

| Column           | Value                          | When                                                         |
| ---------------- | ------------------------------ | ------------------------------------------------------------ |
| `action`         | `sample_note.reencrypt`        | A row's ciphertext was replaced under a newer key version    |
| `action`         | `sample_note.reencrypt.failed` | A selected row could not be decrypted, re-encrypted or saved |
| `actor_role`     | `system`                       | Any entry written by a system job (no person)                |
| `actor_id`       | `job:reencrypt`                | Identifies the job                                           |
| `entity_id`      | The note's opaque UUID         | Per row                                                      |
| `correlation_id` | `reencrypt-<uuid>`             | One per run                                                  |

`RequestContext` gains an optional in-memory `system` field (not stored anywhere except as
`actor_id` above).

## Transaction scope per row

| Step                                       | Inside `withTransaction` |
| ------------------------------------------ | ------------------------ |
| Select batch (keyset)                      | No (pool)                |
| Decrypt, encrypt (KMS)                     | No                       |
| `UPDATE app.patient_note … AND body = old` | Yes                      |
| `audit.append` (`.reencrypt`) if updated   | Yes, last statement      |
| `audit.append` (`.reencrypt.failed`)       | No (pool, best effort)   |
