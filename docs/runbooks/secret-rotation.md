# Runbook: rotate the database passwords (EN-12.2)

Secrets live in SSM Parameter Store SecureString under `/heach/dev` (D2,
[ADR 0010](../adr/0010-step-2-backups-secrets-waf.md)); OpenTofu generates them. The API reads
`DB_APP_PASSWORD` at start-up; the deploy reads `DB_MIGRATOR_PASSWORD` and `POSTGRES_PASSWORD`.

## Rotate the API and migrations role passwords

1. New values: `tofu -chdir=infra/envs/dev plan -replace=random_password.db_app -replace=random_password.db_migrator -out plan.tfplan`,
   review (two parameters change, nothing else), then `tofu apply plan.tfplan`.
2. Apply them to PostgreSQL and restart the API: run **Deploy dev** (workflow_dispatch) or on the
   host `cd /opt/heach && bash deploy.sh <registry> <current tag>`. `db:bootstrap` sets each role's
   password from Parameter Store, then `deploy.sh` recreates the API container so it reads the new
   one. This happens even when the image tag is unchanged.
   If an older deploy left the API running with the old password (`/api/readyz` shows
   `postgres: down`), recover with `cd /opt/heach && docker compose up -d --no-deps --force-recreate --wait api`.
3. Check: `/api/readyz` answers `postgres: ok`; an old password no longer connects.

Downtime: seconds while the API restarts. Never print the values; `aws ssm get-parameter` without
`--with-decryption` shows only metadata.

## Record

| Date | Environment | Who | Result |
| --- | --- | --- | --- |
| 2026-10-18 | dev | Claude Code | `tofu plan -replace` showed 2 passwords replaced and 2 parameters updated in place, nothing else; applied, and both parameters went from version 1 to 2. [Deploy dev run 39118146170](https://github.com/themechanicalguy/heach/actions/runs/39118146170): bootstrap set the new role passwords, but the same-tag deploy did not restart the API. Its new connections then failed (`/api/readyz` showed `postgres: down`), which proves the old password no longer connects. Recovered in about 3 minutes by recreating the API container: readyz ok and the smoke test passed. `deploy.sh` now always recreates the API after bootstrap. Values never printed |
