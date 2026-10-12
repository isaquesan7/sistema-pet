#!/usr/bin/env bash
# PointVet 17.1 - encrypted R2 backup worker. No plaintext uploads.
set -euo pipefail
umask 077
for var in R2_BUCKET R2_ENDPOINT R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY BACKUP_AGE_RECIPIENT; do
  eval 'val=${'"$var"'-}'
  if [ -z "$val" ]; then echo "Missing required backup setting: $var" >&2; exit 2; fi
done
case "$BACKUP_AGE_RECIPIENT" in age1*) ;; *) echo "Invalid age recipient" >&2; exit 2;; esac
MODE=${BACKUP_MODE:-check}
if [ "$MODE" = check ]; then
  command -v pg_dump >/dev/null
  command -v age >/dev/null
  command -v aws >/dev/null
  echo "Backup worker prerequisites validated; no database accessed"
  exit 0
fi
if [ "$MODE" != run ]; then echo "Unknown BACKUP_MODE" >&2; exit 2; fi
if [ "${BACKUP_EXECUTION_ENABLED:-}" != YES ]; then echo "Backup run not authorized" >&2; exit 2; fi
if [ -z "${BACKUP_DATABASE_URL:-}" ]; then echo "Backup database reference not configured" >&2; exit 2; fi
case "$R2_ENDPOINT" in https://*) ;; *) echo "R2 endpoint must use HTTPS" >&2; exit 2;; esac
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT HUP INT TERM
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto
FILE="$TMPDIR/backup.dump.age"
export PGDATABASE="$BACKUP_DATABASE_URL"
if ! (pg_dump --format=custom --no-owner --no-acl | age -r "$BACKUP_AGE_RECIPIENT" > "$FILE"); then
  echo "Encrypted dump failed" >&2; exit 1
fi
[ -s "$FILE" ] || { echo "Empty encrypted backup" >&2; exit 1; }
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OBJECT="postgres/daily/pointvet-$STAMP.dump.age"
aws --endpoint-url "$R2_ENDPOINT" s3api put-object --bucket "$R2_BUCKET" --key "$OBJECT" --body "$FILE" --output none
echo "Encrypted backup uploaded: $OBJECT"
