#!/bin/bash
# Raises credit alerts from a credit-status result (playbook part B4). Run by credit-watch.
# Usage: credit-alert.sh <result.json | FAILED>
# Needs: gh (GH_TOKEN), aws credentials, CREDIT_ALERT_TOPIC_ARN.
# One open issue labelled credit-alert per mode (real or simulated) holds the current level in
# its title. A rise in level, any warning (plan not ACTIVE, burn rate), or a failed status call opens or
# updates that issue (GitHub emails watchers) and publishes to the SNS topic (email).
set -euo pipefail

source_file="$1"
order=(ok Watch Plan Act Emergency)
rank() { for i in "${!order[@]}"; do [ "${order[$i]}" = "$1" ] && echo "$i" && return; done; echo 0; }

if [ "$source_file" = FAILED ]; then
  simulated=false level=Failed summary="The credit-status check failed: the Free Tier API could not be read."
  body="$summary See the workflow run: ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
  urgent=true
else
  simulated=$(jq -r .simulated "$source_file")
  level=$(jq -r .level "$source_file")
  summary=$(jq -r '"Credits: $\(.remainingUsd) of $\(.creditsGrantedUsd) left (\(.percentLeft)%); plan \(.planStatus), ends \(.expiryDate) (\(.daysLeft) days); level \(.level)."' "$source_file")
  body=$(jq -r '"\(.action)\n\n- Remaining: $\(.remainingUsd) of $\(.creditsGrantedUsd) (\(.percentLeft)%)\n- Plan: \(.planType) \(.planStatus), ends \(.expiryDate) (\(.daysLeft) days)\n- Daily usage before credits: \(.dailySpendUsd // "no data yet")\n- Credits run out at this rate: \(.runOutDate // "not projected")\n" + ([.warnings[] | "- WARNING: \(.)"] | join("\n"))' "$source_file")
  urgent=$(jq -r '.warnings | length > 0' "$source_file")
fi

prefix="Credit alert"
[ "$simulated" = true ] && prefix="Credit alert (simulated)"
gh label create credit-alert --color B60205 --description "AWS credit-expiry alerts" --force >/dev/null

issue=$(gh issue list --label credit-alert --state open --json number,title \
  --jq "[.[] | select(.title | startswith(\"$prefix:\"))][0]")
previous=$(echo "${issue:-null}" | jq -r 'if . == null then "ok" else (.title | sub(".*: "; "")) end')
number=$(echo "${issue:-null}" | jq -r '.number // empty')

rose=false
[ "$level" = Failed ] || [ "$(rank "$level")" -gt "$(rank "$previous")" ] && rose=true
if [ "$rose" != true ] && [ "$urgent" != true ]; then
  echo "No alert: level $level (was $previous). $summary"
  exit 0
fi

title="$prefix: $level"
if [ -n "$number" ]; then
  gh issue edit "$number" --title "$title" >/dev/null
  gh issue comment "$number" --body "**$level** (was $previous)

$body" >/dev/null
else
  gh issue create --label credit-alert --title "$title" --body "$body" >/dev/null
fi

aws sns publish --region ap-south-1 --topic-arn "$CREDIT_ALERT_TOPIC_ARN" \
  --subject "HEACH $title" --message "$summary

$body" >/dev/null
echo "Alert raised: $title (was $previous)"
