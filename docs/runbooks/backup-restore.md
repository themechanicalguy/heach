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
2. Locally: `scripts/restore-check.sh restore.dump` restores into a new, empty database, starts the
   API against it and checks that sample notes decrypt for their owner. Field decryption needs the
   same key provider: locally the same `LOCAL_KEY_SEED`, on hosts the same KMS keys.
3. On the dev host, restore into the running PostgreSQL only after a backup of the current state;
   run `db:bootstrap` afterwards so role passwords match Parameter Store.

## Restore records

| Date | Source | Target | Result | By |
| --- | --- | --- | --- | --- |
| 2026-10-18 | Local `pg_dump -Fc` (77 KB, synthetic) | New empty database on local PostgreSQL 18 | Restore check passed: 104 notes restored, 95 belong to synthetic patient A and all decrypt through the API (bodies not printed) | Claude Code |
| _pending_ | Dev host nightly dump from S3 | Local | Blocked until the Step 2 infra apply and first nightly run | Owner |
