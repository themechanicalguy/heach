# Contract: the re-encryption job command

```sh
node dist/jobs/reencrypt.js [--rotate]     # in the API image; locally: pnpm --filter @heach/api job:reencrypt
```

| Option     | Effect                                              |
| ---------- | --------------------------------------------------- |
| (none)     | Re-encrypt `health` rows below the current version  |
| `--rotate` | Rotate the `health` data key first, then re-encrypt |

## Output (structured log lines, `@heach/logger`)

| Line      | Fields                                                                 |
| --------- | ---------------------------------------------------------------------- |
| Start     | `runId`, `domain`, `targetVersion`                                     |
| Row error | `runId`, `error` (error type only)                                     |
| End       | `runId`, `domain`, `targetVersion`, `reencrypted`, `skipped`, `failed` |

Never: row IDs, owner IDs, ciphertext, plaintext.

## Exit code

| Code | Meaning                                                    |
| ---- | ---------------------------------------------------------- |
| 0    | Finished; `failed` is 0 (`skipped` may be above 0: re-run) |
| 1    | Finished with `failed` above 0, or could not start         |

## Function result

`reencryptHealth(pool, encryptor, audit): Promise<{ reencrypted: number; skipped: number; failed: number }>`
(previously `Promise<number>`; the only caller is the job entry point and `crypto.int-spec.ts`).
