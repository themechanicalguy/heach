#!/bin/sh
# Redis entrypoint: TLS port only, plaintext port disabled (EN-01.1). Copies the key so the
# redis user can read it whatever the owner of the mounted file.
set -eu
install -d -o redis -g redis -m 700 /tls
install -o redis -g redis -m 600 /certs/server.key /tls/server.key
exec docker-entrypoint.sh redis-server \
  --port 0 --tls-port 6379 \
  --tls-cert-file /certs/server.crt --tls-key-file /tls/server.key \
  --tls-ca-cert-file /certs/ca.crt --tls-auth-clients no \
  --tls-protocols "TLSv1.2 TLSv1.3" \
  "$@"
