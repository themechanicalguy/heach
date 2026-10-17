#!/bin/bash
# Smoke test against a deployed host: web health, API health, and PostgreSQL and Redis ready.
# Usage: smoke-test.sh <host>   (-k: the dev certificate comes from Caddy's internal CA)
set -euo pipefail
host="$1"
for _ in $(seq 1 30); do
  if curl -fsSk "https://$host/healthz" | grep -q '"status":"ok"' &&
    curl -fsSk "https://$host/api/healthz" | grep -q '"status":"ok"' &&
    curl -fsSk "https://$host/api/readyz" | grep -q '"postgres":"ok","redis":"ok"'; then
    echo "Smoke test passed on $host"
    exit 0
  fi
  sleep 5
done
echo "Smoke test failed on $host" >&2
exit 1
