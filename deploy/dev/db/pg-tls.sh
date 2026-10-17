#!/bin/sh
# PostgreSQL entrypoint: copies the mounted key with the owner and mode PostgreSQL insists on,
# then starts the server with TLS on and plaintext TCP refused by pg_hba.conf (EN-01.1).
set -eu
install -d -o postgres -g postgres -m 700 /etc/postgresql/tls
install -o postgres -g postgres -m 600 /certs/server.key /etc/postgresql/tls/server.key
install -o postgres -g postgres -m 644 /certs/server.crt /etc/postgresql/tls/server.crt
exec docker-entrypoint.sh postgres \
  -c ssl=on \
  -c ssl_cert_file=/etc/postgresql/tls/server.crt \
  -c ssl_key_file=/etc/postgresql/tls/server.key \
  -c ssl_min_protocol_version=TLSv1.2 \
  -c hba_file=/etc/postgresql/pg_hba.conf \
  "$@"
