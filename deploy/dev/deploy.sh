#!/bin/bash
# Runs on the dev host, sent by GitHub Actions through SSM with the files in this folder.
# Usage: deploy.sh <registry> <image-tag>
# Reads secrets from SSM Parameter Store, writes /opt/heach/.env (mode 600), pulls and starts
# the new images, and waits until the API reports ready. Secrets are never printed.
set -euo pipefail

REGISTRY="$1"
IMAGE_TAG="$2"
REGION="ap-south-1"
cd /opt/heach

param() {
  aws ssm get-parameter --region "$REGION" --with-decryption --name "/heach/dev/$1" \
    --query Parameter.Value --output text
}

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
  echo "POSTGRES_PASSWORD=$(param POSTGRES_PASSWORD)"
  echo "REDIS_PASSWORD=$(param REDIS_PASSWORD)"
} > .env

aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null

docker compose pull --quiet
docker compose up -d --remove-orphans

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
