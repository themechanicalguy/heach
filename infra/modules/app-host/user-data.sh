#!/bin/bash
# First boot of the dev host (Amazon Linux 2023, ARM). Installs Docker and Compose only;
# deployments arrive later through SSM from GitHub Actions (deploy/dev/deploy.sh).
set -euo pipefail

dnf upgrade -y --security
dnf install -y docker
systemctl enable --now docker

# Docker Compose v2 plugin, pinned and checksum-verified.
COMPOSE_VERSION="v5.6.0"
PLUGIN_DIR=/usr/local/lib/docker/cli-plugins
mkdir -p "$PLUGIN_DIR"
BASE="https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}"
curl -fsSL -o "$PLUGIN_DIR/docker-compose" "$BASE/docker-compose-linux-aarch64"
curl -fsSL -o /tmp/compose.sha256 "$BASE/docker-compose-linux-aarch64.sha256"
(cd "$PLUGIN_DIR" && sed 's#\*.*#docker-compose#' /tmp/compose.sha256 | sha256sum -c -)
chmod 0755 "$PLUGIN_DIR/docker-compose"

install -d -m 0750 /opt/heach
