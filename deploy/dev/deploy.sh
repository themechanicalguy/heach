#!/bin/bash
# Runs on the dev host, sent by GitHub Actions through SSM with the files in this folder.
# Usage: deploy.sh <registry> <image-tag>
# Writes /opt/heach/.env (mode 600) with the data stores' own passwords from Parameter Store,
# makes the data TLS certificates once, bootstraps database roles, runs migrations, starts the
# new images and waits until the API reports ready. The API reads its own secrets from Parameter
# Store at start-up (EN-12.1) with the API role, which cannot read the administrator or migrator
# password; only this script, as the host, hands those to the one-off bootstrap and migration
# containers (security review 2026-10-24, finding 7). Secrets are never printed.
set -euo pipefail

REGISTRY="$1"
IMAGE_TAG="$2"
REGION="ap-south-1"
cd /opt/heach

param() {
  aws ssm get-parameter --region "$REGION" --with-decryption --name "/heach/dev/$1" \
    --query Parameter.Value --output text
}

# Preflight: stop before changing anything if a parameter this bundle needs is missing (for
# example, infra not yet applied). The running version stays up; the workflow reports failure.
for name in POSTGRES_PASSWORD REDIS_PASSWORD DB_APP_PASSWORD DB_MIGRATOR_PASSWORD BLIND_INDEX_KEY \
  TEST_LOGIN_KEY; do
  if ! aws ssm get-parameter --region "$REGION" --name "/heach/dev/$name" --query Parameter.Name \
      --output text >/dev/null 2>&1; then
    echo "Parameter /heach/dev/$name is missing: apply infra/envs/dev first. Nothing changed." >&2
    exit 1
  fi
done
# The API container's credentials come from the API role; without it (infra not yet applied) the
# new API could not start, so stop here too.
if ! bash api-credentials.sh >/dev/null; then
  echo "Cannot assume the API role heach-dev-api: apply infra/envs/dev first. Nothing changed." >&2
  exit 1
fi

# The host's public IP, from instance metadata (IMDSv2), for Caddy's certificate.
TOKEN=$(curl -fsS -X PUT http://169.254.169.254/latest/api/token \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 60")
PUBLIC_HOST=$(curl -fsS -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/public-ipv4)

umask 077
{
  echo "REGISTRY=$REGISTRY"
  echo "IMAGE_TAG=$IMAGE_TAG"
  echo "PUBLIC_HOST=$PUBLIC_HOST"
  echo "ALERT_TOPIC_ARN=arn:aws:sns:$REGION:$(aws sts get-caller-identity --query Account --output text):heach-credit-reminders"
  echo "POSTGRES_PASSWORD=$(param POSTGRES_PASSWORD)"
  echo "REDIS_PASSWORD=$(param REDIS_PASSWORD)"
  # For Caddy's loopback-only entry, which adds it to test sign-in requests (SE-07.23).
  echo "TEST_LOGIN_KEY=$(param TEST_LOGIN_KEY)"
} > .env

aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null

bash make-certs.sh certs

docker compose pull --quiet
docker compose up -d --wait postgres redis
# One-off containers get only the passwords their step needs, from this shell's environment; the
# long-running API never has them (its Compose variables are empty in .env).
DB_ADMIN_PASSWORD="$(param POSTGRES_PASSWORD)" DB_MIGRATOR_PASSWORD="$(param DB_MIGRATOR_PASSWORD)" \
  DB_APP_PASSWORD="$(param DB_APP_PASSWORD)" \
  docker compose run --rm --no-deps -e SECRETS_SOURCE=env api node dist/db/bootstrap.js
DB_MIGRATOR_PASSWORD="$(param DB_MIGRATOR_PASSWORD)" \
  docker compose run --rm --no-deps -e SECRETS_SOURCE=env api node dist/db/migrate.js
docker compose up -d --remove-orphans
# The API reads its secrets only at start-up and bootstrap may have just changed the role
# passwords (EN-12.2 rotation); a same-tag deploy would otherwise keep the old API running.
docker compose up -d --no-deps --force-recreate api

# Nightly backup timer (EN-10.3) and weekly restore check (EN-10.5); Persistent=true catches up
# after the host sleeps. API role credentials every 15 minutes (finding 7).
install -m 644 heach-backup.service heach-backup.timer heach-api-credentials.service \
  heach-api-credentials.timer heach-restore-check.service heach-restore-check.timer \
  /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now heach-backup.timer heach-api-credentials.timer \
  heach-restore-check.timer >/dev/null

for _ in $(seq 1 60); do
  if docker compose exec -T api wget -qO- http://127.0.0.1:3001/readyz >/dev/null 2>&1; then
    echo "$IMAGE_TAG" > DEPLOYED_TAG # read by the workflow to roll back; not a secret
    echo "Deployed $IMAGE_TAG: API ready"
    docker image prune -af --filter "until=168h" >/dev/null
    exit 0
  fi
  sleep 2
done
echo "API did not become ready" >&2
docker compose ps >&2
exit 1
