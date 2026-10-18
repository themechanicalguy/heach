#!/bin/sh
# Redis entrypoint: TLS port only, plaintext port disabled (EN-01.1). Copies the key and
# certificate so the redis user can read them whatever the owner and mode of the mounted
# directory (root-only 700 on the dev host).
set -eu
install -d -o redis -g redis -m 700 /tls
install -o redis -g redis -m 600 /certs/server.key /tls/server.key
install -o redis -g redis -m 644 /certs/server.crt /tls/server.crt
install -o redis -g redis -m 644 /certs/ca.crt /tls/ca.crt
exec docker-entrypoint.sh redis-server \
  --port 0 --tls-port 6379 \
  --tls-cert-file /tls/server.crt --tls-key-file /tls/server.key \
  --tls-ca-cert-file /tls/ca.crt --tls-auth-clients no \
  --tls-protocols "TLSv1.2 TLSv1.3" \
  "$@"
