# Runbook: database backups and restore (EN-10.3, EN-10.4)

Decision D1 and [ADR 0010](../adr/0010-step-2-backups-secrets-waf.md): one Region, its own key,
plus a weekly encrypted copy outside the AWS account.

| Copy | Where | Encryption | Kept |
| --- | --- | --- | --- |
| Nightly `pg_dump` | `s3://heach-dev-backups-<account>/pg/` (ap-south-1, private, versioned) | SSE-KMS, `alias/heach-dev-backup`; Restricted fields are also field-encrypted inside | 35 days, replaced versions 7 days |
| Nightly EBS snapshot | Same Region (existing DLM policy) | EBS default KMS key | 7 days |
| Weekly off-account copy | Owner's computer, `~/HEACH-backups` | AES-256 (PBKDF2, 600,000 rounds) with a passphrase in the macOS Keychain | Owner's choice |

## Nightly backup

`heach-backup.timer` on the dev host runs `/opt/heach/backup.sh` at 02:30 India time; `deploy.sh`
installs it. The host role may write and read `pg/*` but not delete. Check:
`aws s3 ls s3://heach-dev-backups-<account>/pg/ --region ap-south-1` (proof for EN-10.3), or on the
host `systemctl list-timers heach-backup.timer`.

## Weekly off-account copy (owner)

```sh
export AWS_PROFILE=saurav-heach-admin
scripts/backup-pull.sh            # first run creates the Keychain passphrase: store it in your password manager
```

Without the passphrase the copy cannot be decrypted; losing it loses the copy.

## Restore (EN-10.4)

1. Get a dump: from S3 (`aws s3 cp s3://…/pg/<name>.dump .`) or from the off-account copy
   (`HEACH_BACKUP_PASS=… openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:HEACH_BACKUP_PASS -in <file>.dump.enc -out restore.dump`
   after checking `shasum -a 256 -c <file>.dump.enc.sha256`).
2. Locally (dumps made with `LOCAL_KEY_SEED` only; dev dumps need the dev KMS keys, see step 4): `scripts/restore-check.sh restore.dump` restores into a new, empty database, starts the
   API against it and checks that sample notes decrypt for their owner. Field decryption needs the
   same key provider: locally the same `LOCAL_KEY_SEED`, on hosts the same KMS keys.
3. To prove a dev dump decrypts, restore it on the dev host into a new `heach_restore_<time>` database. Then run a one-off API container (`docker compose run -d --no-deps -e DATABASE_URL=…/heach_restore_<time> api`), read the owner's notes, and drop the database afterwards. Never touch `heach`. Since spec 007 the container runs on the API role (it decrypts with the data keys; the host role cannot), and test sign-in on dev needs the `x-test-login-key` header: read `/heach/dev/TEST_LOGIN_KEY` into a shell variable on the host and pass it to the container's own `127.0.0.1:3001`, never print it. Every `psql` and `pg_restore` in the PostgreSQL container needs `PGPASSWORD="$POSTGRES_PASSWORD"` (scram on the socket too); without it the command waits for a password and hangs.
4. On the dev host, restore into the running PostgreSQL only after a backup of the current state;
   run `db:bootstrap` afterwards so role passwords match Parameter Store.

## Restore records

| Date | Source | Target | Result | By |
| --- | --- | --- | --- | --- |
| 2026-10-18 | Local `pg_dump -Fc` (77 KB, synthetic) | New empty database on local PostgreSQL 18 | Restore check passed: 104 notes restored, 95 belong to synthetic patient A and all decrypt through the API (bodies not printed) | Claude Code |
| 2026-10-18 | Dev host dump `pg/2026-10-18T1019Z.dump` (S3, SSE-KMS); off-account copy verified byte-identical after decryption without AWS | New database `heach_restore_1792318811` on the dev host's PostgreSQL; the active `heach` database untouched (note count 1 before and after) | Passed: 1 synthetic note restored as AES-256-GCM ciphertext and decrypted through KMS by a separate API container for its owner; restore database and container removed | Claude Code |
| 2026-10-24 | Dev host dump `pg/2026-10-24T1609Z.dump` (S3, SSE-KMS with the backup key), made by `heach-backup.service` under the host role as narrowed by spec 007 | New database `heach_restore_1792858593` on the dev host's PostgreSQL | Passed: `pg_restore --exit-on-error` ok; 2 notes and 34 audit entries restored; `audit.verify_chain()` reports no broken link; 2 of 2 bodies are ciphertext; a one-off API container on the API role decrypted the synthetic owner's note (1 of 1). Live `heach`: notes 2 and audit entries 34 before and after. Restore database and container removed (0 left) | Claude Code |
| 2026-10-24 | Off-account copy of `pg/2026-10-24T1609Z.dump` pulled by `scripts/backup-pull.sh` to `~/HEACH-backups` | Owner's computer, no AWS involved in decryption | Passed: `shasum -c` OK; decrypted with the Keychain passphrase, byte-identical to the S3 object (SHA-256 prefix `9813ed2e5d478b57` on both). Restricted fields inside still need the dev KMS keys ([ADR 0012](../adr/0012-off-account-recovery-of-restricted-fields.md), proposed) | Claude Code |
