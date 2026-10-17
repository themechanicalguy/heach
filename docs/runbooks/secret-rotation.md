# Runbook: rotate the database passwords (EN-12.2)

Secrets live in SSM Parameter Store SecureString under `/heach/dev` (D2,
[ADR 0010](../adr/0010-step-2-backups-secrets-waf.md)); OpenTofu generates them. The API reads
`DB_APP_PASSWORD` at start-up; the deploy reads `DB_MIGRATOR_PASSWORD` and `POSTGRES_PASSWORD`.

## Rotate the API and migrations role passwords

1. New values: `tofu -chdir=infra/envs/dev plan -replace=random_password.db_app -replace=random_password.db_migrator -out plan.tfplan`,
   review (two parameters change, nothing else), then `tofu apply plan.tfplan`.
2. Apply them to PostgreSQL and restart the API: run **Deploy dev** (workflow_dispatch) or on the
   host `cd /opt/heach && bash deploy.sh <registry> <current tag>`. `db:bootstrap` sets each role's
   password from Parameter Store; the API restarts and reads the new one.
3. Check: `/api/readyz` answers `postgres: ok`; an old password no longer connects.

Downtime: seconds while the API restarts. Never print the values; `aws ssm get-parameter` without
`--with-decryption` shows only metadata.

## Record

| Date | Environment | Who | Result |
| --- | --- | --- | --- |
| _pending_ | dev | | Blocked until the Step 2 infra apply (AWS sign-in) |
