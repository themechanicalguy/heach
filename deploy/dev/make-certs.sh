#!/bin/bash
# Creates a private CA and one server certificate for PostgreSQL and Redis (EN-01.1), if absent.
# Usage: make-certs.sh <dir>. Used locally (pnpm setup), in CI and on the dev host. The keys
# never leave the machine that made them; the API trusts only this CA.
set -euo pipefail
dir="$1"
[ -f "$dir/server.crt" ] && exit 0
mkdir -p "$dir"
cd "$dir"
umask 077
openssl req -x509 -newkey rsa:3072 -nodes -days 825 -subj "/CN=heach-data-ca" \
  -keyout ca.key -out ca.crt 2>/dev/null
openssl req -newkey rsa:3072 -nodes -subj "/CN=heach-data" -keyout server.key -out server.csr 2>/dev/null
printf 'subjectAltName=DNS:localhost,DNS:postgres,DNS:redis,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n' > ext.cnf
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 825 \
  -extfile ext.cnf -out server.crt 2>/dev/null
rm -f server.csr ext.cnf ca.srl
chmod 644 ca.crt server.crt
echo "Created TLS certificates for PostgreSQL and Redis in $dir"
