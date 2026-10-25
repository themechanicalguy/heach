# Research: Recurring restore verification of the nightly backup

Inputs: Step 2 spec EN-10.3 and EN-10.4; requirement EN-10 ("restore-tested quarterly");
[Step 2 assessment](https://github.com/themechanicalguy/heach/blob/338943c/docs/step-2-assessment-2026-10-22.md#backups-and-recovery);
[backup runbook](../../docs/runbooks/backup-restore.md) and its two restore records; backlog item 5;
code on `main` at 491f5a0.

## Current behaviour (read 2026-10-24, `main` 491f5a0)

- `deploy/dev/backup.sh` pipes `pg_dump -Fc` of `heach` to `s3://heach-dev-backups-<account>/pg/<UTC time>.dump`
  (SSE-KMS, `alias/heach-dev-backup`), run by `heach-backup.timer` at 21:00 UTC; `deploy.sh`
  installs and enables the timer.
- `scripts/restore-check.sh` restores a given file into `heach_restore_<epoch>` on local services,
  starts the API against it, signs in as a synthetic user through the test identity adapter and
  checks the notes decrypt. It is local only (needs `.env`, the test sign-in and `dist/main.js`).
- The dev-host proof on 18 October was manual: restore, a one-off API container, read, drop.
- No timer, workflow or calendar entry repeats either check.
- Roles since [spec 007](../007-security-review-fixes/spec.md) (EN-12.4; applied and verified live
  24 October 2026). Host role `heach-dev-host`: `s3:GetObject`/`PutObject` on `pg/*`,
  `s3:ListBucket` with prefix `pg/*`, KMS `GenerateDataKey`/`Decrypt` on the backup key only,
  parameters under `/heach/dev/`, and `sts:AssumeRole` on the API role. It has **no** data-domain
  KMS keys and **no** `sns:Publish`. API role `heach-dev-api`: its four parameters, KMS
  `GenerateDataKey`/`Decrypt` on the four data-domain keys, the uploads bucket and `sns:Publish`
  on the alert topic. Containers run by `docker compose run … api` get API-role credentials from
  `/opt/heach/aws` (refreshed every 15 minutes by `heach-api-credentials.timer`); the metadata hop
  limit 1 keeps the host role out of every container.
- Proven on 24 October 2026 on the dev host, by hand: a one-off API container on the API role
  decrypted a note restored from `pg/2026-10-24T1609Z.dump` (runbook restore record). So D-2 works
  unchanged under the new roles; D-5 did not (see its amendment).
- `audit.verify_chain()` exists (`apps/api/sql/bootstrap.sql`) and returns the first broken link.

## Decisions

### D-1 Weekly on the dev host (confirmed by the owner 2026-10-25)

- **Decision**: a `heach-restore-check.timer` on Sundays at 00:00 UTC (05:30 IST), three hours after
  the Saturday dump, `Persistent=true`.
- **Why**: EN-10 asks for quarterly at least; weekly costs nothing extra and finds a broken dump
  within days, not months. Sunday morning IST is the quietest time.
- **Alternatives**: (a) quarterly, the minimum: a dump could be broken for three months unnoticed;
  (b) nightly after every dump: more KMS calls and host load for little gain on dev; (c) a GitHub
  Actions schedule: the runner cannot read the host's database or use its role without new IAM.

### D-2 Decrypt in a one-off API container; no test sign-in

- **Decision**: a new job `apps/api/src/jobs/restore-check.ts` (`node dist/jobs/restore-check.js`),
  run by the host script as `docker compose run --rm --no-deps api …` with `RESTORE_DATABASE_URL`
  pointing at the throwaway database. It reads up to 1,000 sample-note bodies (newest first),
  decrypts each with the field encryptor, discards the plaintext and counts.
- **Why**: proves the same code and KMS keys the API uses can read the restored values, without the
  test identity adapter (not available on the host) or an HTTP server.
- **Alternatives**: (a) reuse `scripts/restore-check.sh`: needs the test sign-in and `.env`;
  rejected for the host. (b) only `pg_restore --list`: proves the archive, not that values decrypt;
  rejected.

### D-3 One summary audit entry in the live database (confirmed by the owner 2026-10-25)

- **Decision**: one `backup.restore_check` entry per run in the live `heach` audit log, as the
  system job, with outcome, stage and counts; written after the decrypt stage, best effort when it
  fails.
- **Why**: SE-05 asks that access to Restricted data is audited; the live log is the one that
  survives. A per-row entry would name rows of a copy that is dropped minutes later and would flood
  the log weekly.
- **Alternatives**: (a) per-row entries like spec 005: much noise, no extra accountability;
  (b) no entry: leaves weekly decryption of all health values unaudited; rejected.

### D-4 Throwaway database lifecycle

- **Decision**: name `heach_restorecheck_<UTC time>`; `DROP DATABASE … WITH (FORCE)` on exit (trap)
  and, at the start of each run, drop any `heach_restorecheck_*` older than one day. The live
  database is never a restore target.
- **Why**: a killed run must not leave copies of Restricted data on disk (EN-10.8).

### D-5 Alerts through the existing topic; publication is not delivery

- **Decision**: on failure the host script publishes one message to the existing alert topic with
  subject `[HEACH] Restore check failed: <stage>`; the body holds the stage, dump name and run ID.
  Passing runs publish nothing; the record is the journal plus a runbook row added by the operator
  monthly.
- **Amended 24 October 2026 (spec 007 role split)**: the host role can no longer publish. The host
  script publishes with the API role's short-lived credentials, the role that already publishes the
  API's alerts: `aws sns publish` run with `AWS_CONFIG_FILE` pointing at a host-side copy of the
  `credential_process` profile that reads `/opt/heach/aws/credentials.json`. No infrastructure
  change. Rejected: giving `sns:Publish` back to the host role (reverses the spec 007 narrowing and
  needs an apply); publishing from inside the job only (misses the `freshness` and `restore`
  stages, which fail before any container runs).
- **Why**: no new resource or cost. Publication is not delivery: the email subscription was
  confirmed in AWS on 24 October 2026 (one confirmed, none pending) and SNS reported both synthetic
  alerts of that day as delivered; receipt in the inbox is confirmed only by the owner.
- **Alternatives**: an S3 success marker (needs a new `PutObject` prefix, an infra change) or a
  heartbeat from GitHub Actions (cannot see the host); deferred.

## Cost

S3: about 5 GETs and LISTs a week. KMS: one `Decrypt` per wrapped data-key version read (envelope
encryption unwraps a data key once, not per row), so a handful a week; both within free usage. Host: one container run of under 2 minutes a week. No new resource.
