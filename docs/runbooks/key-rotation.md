# Runbook: rotate a data key and re-encrypt a domain (EN-05)

Two layers of keys ([ADR 0010](../adr/0010-step-2-backups-secrets-waf.md), `@heach/crypto`):

- **KMS master keys** (`alias/heach-<env>-<domain>`): AWS rotates them every year automatically
  (EN-05.2). Nothing to do; old wrapped data keys still decrypt.
- **Data keys** (`app.data_key`, one current version per domain): rotate when a key may be
  exposed, or yearly. Old versions stay readable; re-encryption moves values to the new version.

## Rotate `health` and re-encrypt (EN-05.3)

Locally (`.env` from `pnpm setup`, services up):

```sh
pnpm --filter @heach/api build
pnpm --filter @heach/api job:reencrypt -- --rotate   # new version, then re-encrypt every value
pnpm --filter @heach/api job:reencrypt               # re-run safely; reports 0 when done
```

On the dev host (Session Manager, `cd /opt/heach`):

```sh
docker compose run --rm --no-deps api node dist/jobs/reencrypt.js --rotate
docker compose run --rm --no-deps api node dist/jobs/reencrypt.js
```

The job ([spec 005](../../specs/005-bounded-reencryption/spec.md)) walks the table once by ID and
moves only values below the version current when it starts, so it always finishes. It logs a start
line (`runId`, `domain`, `targetVersion`) and an end line with `reencrypted`, `skipped` and
`failed`. It never logs values, ciphertext or row IDs.

| Result | Meaning | Action |
| --- | --- | --- |
| Exit 0, `skipped` 0 | Done | None; a re-run reports `reencrypted` 0 |
| Exit 0, `skipped` above 0 | Rows changed while the job ran | Run it again |
| Exit 1, `failed` above 0 | Rows could not be decrypted or saved; each has a `sample_note.reencrypt.failed` audit entry | Investigate before retiring any key version; run again after the cause is fixed |

Checks, as the superuser:

- `SELECT body->>'keyVersion', count(*) FROM app.patient_note GROUP BY 1;` shows only the current
  version (or newer).
- `SELECT action, actor_role, actor_id, count(*) FROM audit.entry WHERE correlation_id = '<runId>' GROUP BY 1, 2, 3;`
  shows one `sample_note.reencrypt` entry per re-encrypted row, actor `system` / `job:reencrypt`
  (EN-05.7).

Proof: `apps/api/test/crypto.int-spec.ts` (EN-05.3), `apps/api/test/reencrypt.int-spec.ts` and
`apps/api/src/jobs/reencrypt.spec.ts` (EN-05.4 to EN-05.9).

### Record

| Date | Where | Result | By |
| --- | --- | --- | --- |
| 2026-10-23 | Local isolated stack | `--rotate` to version 40: 1,207 re-encrypted, 0 skipped, 0 failed, exit 0, 1.5 s; 1,207 audit entries for the run, actor `system` / `job:reencrypt`; re-run 0, no entries; `audit.verify_chain()` intact | Claude Code |

Today only `app.patient_note.body` holds `health` values. When a step adds Restricted columns,
extend `reencryptHealth` (or add a job per domain) in the same pull request.
