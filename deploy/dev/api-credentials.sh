#!/bin/bash
# Gives the API container short-lived credentials of the API role (security review 2026-10-24,
# finding 7). The container cannot reach instance metadata (hop limit 1), so it never holds the
# host role, which can read the database administrator and migrator passwords. The SDK in the
# container reads this file through `credential_process` and re-reads it before it expires.
# Runs as root: from deploy.sh, and every 15 minutes from heach-api-credentials.timer.
# Usage: api-credentials.sh [directory]   (default /opt/heach/aws, mounted read-only at /aws)
set -euo pipefail
REGION="ap-south-1"
NODE_GID=1000 # the API image's `node` user
dir="${1:-/opt/heach/aws}"
account=$(aws sts get-caller-identity --region "$REGION" --query Account --output text)
role="arn:aws:iam::${account}:role/heach-dev-api"

umask 077
install -d -m 750 -g "$NODE_GID" "$dir"
tmp=$(mktemp "$dir/.credentials.XXXXXX")
trap 'rm -f "$tmp"' EXIT
# One hour, the most a role assumed by another role may have; refreshed every 15 minutes.
# shellcheck disable=SC2016 # the backticks are a JMESPath literal, not shell
aws sts assume-role --region "$REGION" --role-arn "$role" --role-session-name heach-api \
  --duration-seconds 3600 --output json \
  --query '{Version: `1`, AccessKeyId: Credentials.AccessKeyId, SecretAccessKey: Credentials.SecretAccessKey, SessionToken: Credentials.SessionToken, Expiration: Credentials.Expiration}' \
  > "$tmp"
chgrp "$NODE_GID" "$tmp" && chmod 640 "$tmp"
mv -f "$tmp" "$dir/credentials.json"
printf '[default]\ncredential_process = cat /aws/credentials.json\nregion = %s\n' "$REGION" \
  > "$dir/config"
chgrp "$NODE_GID" "$dir/config" && chmod 640 "$dir/config"
echo "API role credentials refreshed (values not printed)"
