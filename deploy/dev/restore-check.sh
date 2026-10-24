#!/bin/bash
# Weekly restore check of the newest nightly dump (spec 006, EN-10.5 to EN-10.10), run by
# heach-restore-check.timer on the dev host. Stages: freshness (a dump newer than 26 hours),
# restore (into a new heach_restorecheck_<epoch> database, never the live one), then the job's
# audit-chain and decrypt stages in a one-off API container on the API role. The throwaway
# database is always dropped; a failure publishes one alert naming the stage, the dump and the
# run ID, never a value or an ID. Runbook: docs/runbooks/backup-restore.md.
#
# Test seams (local and CI only; the host uses the defaults): RESTORE_CHECK_DIR (Compose folder),
# RESTORE_CHECK_DUMPS (a folder laid out like the bucket), RESTORE_CHECK_JOB (job command),
# RESTORE_CHECK_ALERT (command called with subject and message).
set -euo pipefail
REGION="ap-south-1"
MAX_AGE_SECONDS=$((26 * 3600))
STALE_SECONDS=86400
cd "${RESTORE_CHECK_DIR:-/opt/heach}"

uuid() { (cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen) | tr 'A-Z' 'a-z'; }
run_id="restorecheck-$(uuid)"
stage="freshness"
dump="none"
db=""
log() { echo "restore-check run=${run_id} stage=${stage} $*"; }

# psql as the database administrator inside the postgres container; $2 picks the database.
psql_admin() {
  docker compose exec -T postgres sh -c \
    'PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "${2:-$POSTGRES_DB}" -Atc "$1"' \
    sh "$1" "${2:-}"
}

bucket() { echo "heach-dev-backups-$(aws sts get-caller-identity --query Account --output text)"; }

list_dumps() {
  if [ -n "${RESTORE_CHECK_DUMPS:-}" ]; then
    (cd "$RESTORE_CHECK_DUMPS" && find pg -maxdepth 1 -name '*.dump') || true
  else
    aws s3 ls "s3://$(bucket)/pg/" --region "$REGION" | awk '{print "pg/" $4}'
  fi
}

fetch_dump() {
  if [ -n "${RESTORE_CHECK_DUMPS:-}" ]; then
    cat "$RESTORE_CHECK_DUMPS/$1"
  else
    aws s3 cp "s3://$(bucket)/$1" - --region "$REGION" --only-show-errors
  fi
}

run_job() {
  if [ -n "${RESTORE_CHECK_JOB:-}" ]; then
    bash -c "$RESTORE_CHECK_JOB"
  else
    docker compose run --rm --no-deps -T -e RESTORE_DATABASE_NAME -e RESTORE_RUN_ID \
      -e RESTORE_DUMP_NAME api node dist/jobs/restore-check.js
  fi
}

# The host role cannot publish (spec 007); the alert goes out with the API role's short-lived
# credentials, which heach-api-credentials.timer keeps fresh (research D-5).
publish_alert() {
  if [ -n "${RESTORE_CHECK_ALERT:-}" ]; then
    "$RESTORE_CHECK_ALERT" "$1" "$2"
    return
  fi
  local config topic
  config=$(mktemp)
  printf '[default]\ncredential_process = cat %s/aws/credentials.json\nregion = %s\n' "$PWD" "$REGION" > "$config"
  topic=$(grep '^ALERT_TOPIC_ARN=' .env | cut -d= -f2-)
  AWS_CONFIG_FILE="$config" AWS_PROFILE=default aws sns publish --region "$REGION" \
    --topic-arn "$topic" --subject "$1" --message "$2" --output text >/dev/null
  rm -f "$config"
}

finish() {
  local code=$?
  trap - EXIT INT TERM
  if [ -n "$db" ]; then
    psql_admin "DROP DATABASE IF EXISTS ${db} WITH (FORCE)" >/dev/null || log "could not drop ${db}"
  fi
  if [ "$code" -ne 0 ]; then
    log "failed"
    publish_alert "[HEACH] Restore check failed: ${stage}" \
      "Restore check failed at stage ${stage} for dump ${dump}, run ${run_id}. Runbook: docs/runbooks/backup-restore.md" \
      || log "alert not published"
  fi
  exit "$code"
}
trap finish EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

# Object names are UTC times (pg/2026-10-25T2100Z.dump), so the newest sorts last.
dump=$(list_dumps | grep -E '^pg/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{4}Z\.dump$' | sort | tail -1 || true)
[ -n "$dump" ] || { dump="none"; log "no dump found"; exit 1; }
oldest=$(($(date +%s) - MAX_AGE_SECONDS))
oldest_name="pg/$(date -u -d "@${oldest}" +%Y-%m-%dT%H%MZ 2>/dev/null || date -u -r "$oldest" +%Y-%m-%dT%H%MZ).dump"
[[ ! "$dump" < "$oldest_name" ]] || { log "dump=${dump} is older than 26 hours"; exit 1; }
log "ok dump=${dump}"

stage="restore"
now=$(date +%s)
# A killed run leaves its copy behind; drop any older than a day (D-4, EN-10.8).
stale_dbs=$(psql_admin "SELECT datname FROM pg_database WHERE datname ~ '^heach_restorecheck_[0-9]+\$'
  AND substring(datname FROM 20)::bigint < ${now} - ${STALE_SECONDS}")
for stale in $stale_dbs; do
  psql_admin "DROP DATABASE IF EXISTS ${stale} WITH (FORCE)" >/dev/null
  log "dropped stale ${stale}"
done
db="heach_restorecheck_${now}"
psql_admin "CREATE DATABASE ${db}" >/dev/null
fetch_dump "$dump" | docker compose exec -T postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -U "$POSTGRES_USER" -d "$1" --exit-on-error' sh "$db"
# Read grants for the API role in this copy only; the live database keeps its grants (plan).
psql_admin "GRANT CONNECT ON DATABASE ${db} TO heach_app" >/dev/null
psql_admin "GRANT SELECT ON ALL TABLES IN SCHEMA app, audit TO heach_app;
  GRANT EXECUTE ON FUNCTION audit.verify_chain() TO heach_app" "$db" >/dev/null
log "ok database=${db}"

stage="job"
export RESTORE_DATABASE_NAME="$db" RESTORE_RUN_ID="$run_id" RESTORE_DUMP_NAME="$dump"
set +e
output=$(run_job 2>&1)
job_code=$?
set -e
echo "$output"
reported=$(echo "$output" | grep -oE '"stage":"(audit-chain|decrypt)"' | tail -1 | cut -d'"' -f4 || true)
stage="${reported:-job}"
[ "$job_code" -eq 0 ] || exit 1
log "passed"
