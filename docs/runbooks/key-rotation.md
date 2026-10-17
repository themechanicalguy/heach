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

Check: `SELECT body->>'keyVersion', count(*) FROM app.patient_note GROUP BY 1;` as the superuser
shows only the current version. The job logs counts only, never values. Proof:
`apps/api/test/crypto.int-spec.ts` (EN-05.3).

Today only `app.patient_note.body` holds `health` values. When a step adds Restricted columns,
extend `reencryptHealth` (or add a job per domain) in the same pull request.
