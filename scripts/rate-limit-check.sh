#!/bin/bash
# Deploy-bundle check for the API rate limit (SO-08.10): 150 requests through the proxy, each
# with a new random bearer token and a random X-Forwarded-For, must still reach the API's own 429.
# Usage: rate-limit-check.sh <base-url>   (for example https://127.0.0.1; -k: self-signed)
# Uses up the caller's allowance for /api/v1/auth/refresh for one window. Tokens are generated
# at run time and never printed.
set -euo pipefail
base="${1:?usage: rate-limit-check.sh <base-url>}"
total=150
early=100
body="$(mktemp)"
trap 'rm -f "$body"' EXIT
api_429=0
early_429=0
for i in $(seq 1 "$total"); do
  code=$(curl -sk -o "$body" -w '%{http_code}' -X POST \
    -H "Authorization: Bearer $(openssl rand -hex 16)" \
    -H "X-Forwarded-For: 10.$((RANDOM % 256)).$((RANDOM % 256)).$((RANDOM % 256))" \
    "$base/api/v1/auth/refresh")
  if [ "$code" = 429 ]; then
    if [ "$i" -le "$early" ]; then
      early_429=$((early_429 + 1))
    fi
    # The API's error body, not the proxy's empty 429.
    if grep -q 'ThrottlerException' "$body"; then
      api_429=$((api_429 + 1))
    fi
  fi
done
echo "requests=$total api_429=$api_429 early_429=$early_429"
if [ "$early_429" -gt 0 ]; then
  echo "Rate limit check failed: refused within the first $early requests" >&2
  exit 1
fi
if [ "$api_429" -lt 1 ]; then
  echo "Rate limit check failed: no 429 from the API despite $total requests with fake tokens" >&2
  exit 1
fi
echo "Rate limit check passed"
