#!/bin/bash
# Runs shell commands on an instance through SSM Run Command and waits for the result.
# `aws ssm wait command-executed` gives up after about 100 seconds; image pulls take longer.
# Usage: ssm-run.sh <instance-id> <comment> <commands-json>   (commands-json: {"commands":[...]})
# Prints the command output; exits 0 only when the command succeeded.
set -euo pipefail

instance="$1"
comment="$2"
params="$3"
timeout_seconds="${SSM_TIMEOUT_SECONDS:-900}"

id=$(aws ssm send-command --instance-ids "$instance" --document-name AWS-RunShellScript \
  --comment "$comment" --parameters "$params" --timeout-seconds 600 \
  --query Command.CommandId --output text)

status=Pending
for _ in $(seq 1 $((timeout_seconds / 5))); do
  status=$(aws ssm get-command-invocation --command-id "$id" --instance-id "$instance" \
    --query Status --output text 2>/dev/null || echo Pending)
  case "$status" in
    Pending | InProgress | Delayed) sleep 5 ;;
    *) break ;;
  esac
done

aws ssm get-command-invocation --command-id "$id" --instance-id "$instance" \
  --query '[StandardOutputContent, StandardErrorContent]' --output text
echo "SSM command $id: $status"
test "$status" = Success
