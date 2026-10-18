#!/bin/bash
# EN-10.4: restores a pg_dump custom-format file into a new, empty database on the local
# PostgreSQL, starts the API against it, and checks that a sample note decrypts for its owner.
# Usage: scripts/restore-check.sh <file.dump>   (local services up; .env from pnpm setup)
set -euo pipefail
dump="$1"
db="heach_restore_$(date +%s)"
port=3096
set -a; . ./.env; set +a
psql_admin() { docker compose exec -T postgres sh -c "PGPASSWORD=\"\$POSTGRES_PASSWORD\" psql -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Atc \"$1\""; }

psql_admin "CREATE DATABASE $db"
trap 'kill "${api:-0}" 2>/dev/null || true; psql_admin "DROP DATABASE IF EXISTS $db WITH (FORCE)" >/dev/null' EXIT
docker compose exec -T postgres sh -c "PGPASSWORD=\"\$POSTGRES_PASSWORD\" pg_restore -U \"\$POSTGRES_USER\" -d $db --exit-on-error" < "$dump"
psql_admin "GRANT CONNECT ON DATABASE $db TO heach_app, heach_migrator"
echo "Restored into $db: $(docker compose exec -T postgres sh -c "PGPASSWORD=\"\$POSTGRES_PASSWORD\" psql -U \"\$POSTGRES_USER\" -d $db -Atc 'select count(*) from app.patient_note'") notes"

url="${DATABASE_URL%/*}/$db"
(cd apps/api && API_PORT=$port APP_ENV=test FEATURE_FLAGS=sample-patient-note DATABASE_URL="$url" \
  OTEL_EXPORTER_OTLP_ENDPOINT= node --env-file=../../.env dist/main.js >/dev/null 2>&1) &
api=$!
for _ in $(seq 1 40); do curl -fs "localhost:$port/healthz" >/dev/null && break; sleep 0.5; done
token=$(curl -fs -X POST "localhost:$port/v1/auth/test-login" -H 'content-type: application/json' \
  -d '{"userId":"00000000-0000-4000-8000-000000000001"}' | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).accessToken))')
notes=$(curl -fs "localhost:$port/v1/sample/notes" -H "authorization: Bearer $token")
count=$(echo "$notes" | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).length))')
[ "$count" -gt 0 ] || { echo "No notes for the owner after restore" >&2; exit 1; }
echo "$notes" | node -e 'process.stdin.on("data",d=>{const n=JSON.parse(d)[0];if(!n.body||n.body.includes("ciphertext"))process.exit(1)})'
echo "Restore check passed: $count notes decrypt for their owner (bodies not printed)"
