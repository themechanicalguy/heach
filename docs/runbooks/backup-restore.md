# Runbook: database backups and restore (EN-10.3 to EN-10.10)

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

[ADR 0012](../adr/0012-off-account-recovery-of-restricted-fields.md) (accepted 25 October 2026):
the pull stays manual, prompted by a weekly calendar reminder (R2); the passphrase is also kept in
the owner's password manager and proven by the test decryption in the ADR, typed from the
password manager, not the Keychain (R3). Restricted fields in the copy still need the dev KMS keys
(R1, accepted for dev; escrow wrap before the pilot). Record each pull and the R3 test:

| Date | Action | Result | By |
| --- | --- | --- | --- |
| 2026-10-18 | Pull `pg/2026-10-18T1019Z.dump` | `shasum -c` OK; decrypted copy identical to S3 | Claude Code |
| 2026-10-24 | Pull `pg/2026-10-24T1609Z.dump` | `shasum -c` OK; identical (SHA-256 prefix `9813ed2e5d478b57`) | Claude Code |
| 2026-10-25 | R2: weekly calendar reminder for the pull | Added | Owner |
| 2026-10-25 | R3: test decryption of `2026-10-24T1609Z.dump.enc` with the passphrase pasted from the password manager | `shasum -c` OK; output starts `PGDMP`: the password-manager copy is correct | Owner |

## Weekly restore check (EN-10.5 to EN-10.10, spec 006)

`heach-restore-check.timer` runs `/opt/heach/restore-check.sh` every Sunday at 00:00 UTC (05:30
India time), three hours after Saturday's dump; `Persistent=true` catches up after `dev-sleep`.
`deploy.sh` installs and enables it. Each run:

1. **freshness**: the newest `pg/*.dump` by name must be under 26 hours old.
2. **restore**: drops any `heach_restorecheck_*` database older than a day (a killed run's), then
   restores the dump with `--exit-on-error` into a new `heach_restorecheck_<epoch>` database and
   grants the API role read access in that copy only.
3. **audit-chain** and **decrypt**: `node dist/jobs/restore-check.js` in a one-off API container
   (API role) counts every table, runs `audit.verify_chain()` and decrypts up to 1,000 note bodies
   with the data keys stored in the restored copy; the plaintext is discarded. It writes one
   `backup.restore_check` (or `.failed`) entry to the live audit log as `job:restore-check`, with
   the dump name and the run ID only, and logs one JSON line with the counts.
4. The throwaway database is always dropped (also on `systemctl stop`). Any failure publishes one
   alert, `[HEACH] Restore check failed: <stage>`, with the dump name and run ID, using the API
   role's credentials. Stage `job` means the job could not start.

Run it by hand: `sudo systemctl start heach-restore-check.service`; read the result:
`journalctl -u heach-restore-check.service -n 30`; next run: `systemctl list-timers heach-restore-check.timer`.
On an alert: read the journal for the run ID, fix the stage that failed (missing dump: check
`heach-backup.service`; restore: the dump or disk; audit-chain: treat as possible tampering, keep
the dump; decrypt: KMS access of the API role or a damaged value), then run it by hand.
Disable: `sudo systemctl disable --now heach-restore-check.timer`.

### Scheduled runs: where the evidence is and how to read it

The timer runs on the host under systemd. Nothing depends on a laptop, a terminal or a Claude
session being open. The host must be running at the time: `scripts/dev-sleep` is the only thing
that stops it, and only when someone runs it.

Each run leaves three traces:

| Evidence | Where | Kept |
| --- | --- | --- |
| Stage lines (`restore-check run=<id> stage=<stage> …`) and one JSON line with the counts | Host journal, `journalctl -u heach-restore-check.service` | Root volume; 63.6 MB used on 25 October 2026, reaching back to 17 October, under the default size cap |
| One `backup.restore_check` (pass) or `backup.restore_check.failed` entry, role `system` | Live audit log `audit.entry` (append-only, hash-chained) | Permanent |
| On failure only: email `[HEACH] Restore check failed: <stage>` with the dump name and run ID | SNS topic `heach-credit-reminders` to the owner's inbox (path proven 25 October 2026) | The inbox |

**Silence is not a pass.** No email arrives when the run never starts: host stopped, timer
disabled, systemd broken. After each scheduled Sunday, open a shell on the host
(`aws ssm start-session --profile saurav-heach-admin --region ap-south-1 --target <instance-id>`)
and run, read only:

```sh
systemctl show heach-restore-check.timer -p LastTriggerUSec -p NextElapseUSecRealtime
journalctl -u heach-restore-check.service --since -2days --no-pager -o short-iso \
  | grep -E 'Start|Finished|restore-check run=|tables|Deactivated|Failed'
```

The finished line lists row counts as `"tables":[["app.data_key",1],["app.patient_note",2],…]`
(pairs since 28 October 2026; earlier runs wrote an object). Table names are values, so the
logger's personal-word redaction never hides them.

**Scheduled or by hand?** A scheduled run starts within a minute of Sunday 00:00 UTC (05:30 India
time), and the timer's `LastTriggerUSec` equals that start. A run started with `systemctl start` at
any other time is a manual run: record it with Trigger "By hand", and it never counts towards
SC-001. Before 1 November `LastTriggerUSec` is empty, because the timer has not fired yet.

**After a failure email.** Read the journal for the run ID, fix the stage (see "On an alert"
above), run it by hand to confirm the fix, and record both rows. The failed scheduled run still
counts as a weekly record, because SC-001 accepts "a pass, or an alert for each failure". A week
with no scheduled run, for any reason, breaks the sequence. A by-hand run does not fill that week:
the four consecutive weeks start again from the next Sunday.

**Keep the host awake over the window.** Do not run `scripts/dev-sleep` between Saturday 21:00 UTC
(the dump) and Sunday 01:00 UTC. If the host was asleep, `Persistent=true` runs both timers on
wake, and the restore check can start before the new dump exists and fail at `freshness`. Such a
run alerts, so it counts, but it proves less than a normal run.

**SC-001 dates.** From `systemd-analyze calendar` on the host, 25 October 2026 (host timezone UTC).
A run gets its row in the records table below only after it has happened:

| # | Scheduled (UTC) | India time | Recorded by |
| --- | --- | --- | --- |
| 1 | Sunday 1 November 2026, 00:00 | 05:30 | The owner, or a session the owner starts, from the commands above |
| 2 | Sunday 8 November 2026, 00:00 | 05:30 | Same |
| 3 | Sunday 15 November 2026, 00:00 | 05:30 | Same |
| 4 | Sunday 22 November 2026, 00:00 | 05:30 | Same; then the owner's G4 review of spec 006 |

### Weekly restore check records (SC-001)

One row per scheduled run, copied from the journal (counts only).

| Run (UTC) | Trigger | Dump | Result | Counts | Run ID | By |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-25 03:44:57 to 03:45:03 | By hand (T017), `systemctl start`, deployed `a2cbf6f843db` | `pg/2026-10-24T2100Z.dump` | Passed: freshness, restore, audit chain, decrypt; copy dropped (none left); live database gained only its `backup.restore_check` entry (audit 34 to 35, chain intact, notes 2 before and after) | tables `app.data_key` 1, `app.patient_note` 2, `app.session` 33, `app.user_test` 4, `audit.entry` 34; decrypted 2, failed 0 | `restorecheck-54de7a36-566a-4340-905c-38fbb80a9315` | Claude Code |
| 2026-10-25 03:48 | By hand, synthetic failure (empty dump folder) to prove the host alert path | none | Failed at freshness as intended; one alert `[HEACH] Restore check failed: freshness` published with the API role's credentials; SNS delivered 1, failed 0 (03:48 UTC); **received** in the owner's inbox (owner confirmed 25 October) | none | `restorecheck-5c18fff6-967c-4b99-b8e8-e6908cc82e0f` | Claude Code |
| 2026-10-30 12:31:42 to 12:31:48 | By hand (Step 10 drill, owner approved), `systemctl start` through SSM Run Command | `pg/2026-10-29T2100Z.dump` | Passed: freshness, restore, audit chain, decrypt; service exit 0 | tables `app.account` 3, `app.patient_note` 2, `app.role_assignment` 3, `audit.entry` 35; decrypted 2, failed 0 | `restorecheck-1ba56d6c-8c64-4277-90eb-8d98e7110f3f` | Claude Code |

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
| 2026-10-24 | Off-account copy of `pg/2026-10-24T1609Z.dump` pulled by `scripts/backup-pull.sh` to `~/HEACH-backups` | Owner's computer, no AWS involved in decryption | Passed: `shasum -c` OK; decrypted with the Keychain passphrase, byte-identical to the S3 object (SHA-256 prefix `9813ed2e5d478b57` on both). Restricted fields inside still need the dev KMS keys ([ADR 0012](../adr/0012-off-account-recovery-of-restricted-fields.md), accepted 25 October: R1 for dev) | Claude Code |
