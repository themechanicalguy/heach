#!/bin/bash
# Nightly database dump to the backups bucket (EN-10.3), run by heach-backup.timer on the dev host.
# The bucket encrypts with the backup KMS key; Restricted fields inside the dump are already
# field-encrypted. Nothing is printed except the object name.
set -euo pipefail
REGION="ap-south-1"
cd /opt/heach
account=$(aws sts get-caller-identity --query Account --output text)
bucket="heach-dev-backups-${account}"
key="pg/$(date -u +%Y-%m-%dT%H%MZ).dump"
docker compose exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U heach -d heach -Fc' \
  | aws s3 cp - "s3://${bucket}/${key}" --region "$REGION" --sse aws:kms --sse-kms-key-id alias/heach-dev-backup --only-show-errors
echo "Backed up to ${key}"
