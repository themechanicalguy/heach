#!/bin/bash
# Prints the SSM Run Command parameters that unpack deploy/dev on the host and deploy one tag.
# Usage: deploy-params.sh <registry> <image-tag>
set -euo pipefail
bundle=$(tar -C deploy/dev -czf - . | base64 -w0)
jq -n --arg b "$bundle" --arg r "$1" --arg t "$2" '{commands: [
  "set -euo pipefail",
  "cd /opt/heach",
  ("echo " + $b + " | base64 -d | tar -xzf -"),
  ("bash deploy.sh " + $r + " " + $t)
]}'
