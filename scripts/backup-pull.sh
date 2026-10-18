#!/bin/bash
# Weekly off-account copy (EN-10.3, D1): run on the owner's computer. Downloads the newest dump,
# encrypts it with a passphrase kept in the macOS Keychain (AES-256, PBKDF2), and keeps a SHA-256
# of the encrypted file. The copy decrypts without AWS, so it survives losing the account.
# Usage: AWS_PROFILE=<profile> scripts/backup-pull.sh [destination folder]
set -euo pipefail
dest="${1:-$HOME/HEACH-backups}"
service="heach-backup-passphrase"
umask 077
mkdir -p "$dest"

if ! security find-generic-password -s "$service" -w >/dev/null 2>&1; then
  security add-generic-password -s "$service" -a heach -w "$(openssl rand -base64 32)"
  echo "Created a backup passphrase in your Keychain ($service). Copy it to your password manager now."
fi

account=$(aws sts get-caller-identity --query Account --output text)
bucket="heach-dev-backups-${account}"
latest=$(aws s3api list-objects-v2 --bucket "$bucket" --prefix pg/ --region ap-south-1 \
  --query 'sort_by(Contents, &LastModified)[-1].Key' --output text)
[ "$latest" != None ] || { echo "No backups in $bucket yet" >&2; exit 1; }

name="$(basename "$latest" .dump).dump.enc"
# The passphrase goes through the environment, never on a command line.
HEACH_BACKUP_PASS="$(security find-generic-password -s "$service" -w)"
export HEACH_BACKUP_PASS
aws s3 cp "s3://${bucket}/${latest}" - --region ap-south-1 --only-show-errors \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass env:HEACH_BACKUP_PASS -out "$dest/$name"
(cd "$dest" && shasum -a 256 "$name" > "$name.sha256")
echo "Saved $dest/$name"
# Restore: see docs/runbooks/backup-restore.md.
