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
if [ "$MODE" = connection-check ]; then
  if [ -z "${BACKUP_DATABASE_URL:-}" ]; then echo "Backup database reference not configured" >&2; exit 2; fi
  export PGDATABASE="$BACKUP_DATABASE_URL"
  export PGCONNECT_TIMEOUT=8
  EXPECTED_ROLE=pointvet_backup
  ROLE=$(psql --dbname="$BACKUP_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -c 'SELECT current_user')
  if [ "$ROLE" != "$EXPECTED_ROLE" ]; then echo "Unexpected database role" >&2; exit 1; fi
  RESULT=$(psql --dbname="$BACKUP_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -c "SELECT current_database(), has_database_privilege(current_user, 'railway', 'CONNECT'), has_schema_privilege(current_user, 'public', 'USAGE'), rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user")
  if [ "$RESULT" != "railway|t|t|f|f|f" ]; then echo "Backup role verification failed" >&2; exit 1; fi
  psql --dbname="$BACKUP_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'" >/dev/null
  echo "Backup connection and restricted role verified; no backup performed"
  exit 0
fi
if [ "$MODE" = permissions-check ]; then
  if [ -z "${BACKUP_DATABASE_URL:-}" ]; then echo "Backup database reference not configured" >&2; exit 2; fi
  export PGCONNECT_TIMEOUT=8
  RESULT=$(psql --dbname="$BACKUP_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FILTER (WHERE NOT has_table_privilege(current_user, format('%I.%I', schemaname, tablename), 'SELECT'))::text || '|' || count(*)::text FROM pg_tables WHERE schemaname='public'")
  DENIED=${RESULT%%|*}
  TOTAL=${RESULT##*|}
  if [ "$DENIED" != 0 ] || [ "$TOTAL" -eq 0 ]; then echo "Table permissions incomplete: denied=$DENIED total=$TOTAL" >&2; exit 1; fi
  echo "All $TOTAL public tables have SELECT permission; no backup performed"
  exit 0
fi
if [ "$MODE" = probe ]; then
  if [ "${R2_PROBE_ENABLED:-}" != YES ]; then echo "R2 probe not authorized" >&2; exit 2; fi
  case "$R2_ENDPOINT" in https://*) ;; *) echo "R2 endpoint must use HTTPS" >&2; exit 2;; esac
  DIR=$(mktemp -d)
  trap 'rm -rf "$DIR"' EXIT HUP INT TERM
  export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto
  printf "PointVet encrypted synthetic test; no customer data.\n" | age -r "$BACKUP_AGE_RECIPIENT" > "$DIR/probe.age"
  KEY="checks/probe-$(date -u +%Y%m%dT%H%M%SZ)-${RANDOM}-${RANDOM}.age"
  aws --endpoint-url "$R2_ENDPOINT" s3api put-object --bucket "$R2_BUCKET" --key "$KEY" --body "$DIR/probe.age" --output json >/dev/null
  aws --endpoint-url "$R2_ENDPOINT" s3api head-object --bucket "$R2_BUCKET" --key "$KEY" --query ContentLength --output text > "$DIR/remote-size"
  test "$(cat "$DIR/remote-size")" = "$(wc -c < "$DIR/probe.age" | tr -d ' ')" || { echo "R2 size mismatch" >&2; exit 1; }
  echo "Encrypted synthetic R2 upload verified: $KEY"
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
if ! (pg_dump --dbname="$BACKUP_DATABASE_URL" --format=custom --no-owner --no-acl | age -r "$BACKUP_AGE_RECIPIENT" > "$FILE"); then
  echo "Encrypted dump failed" >&2; exit 1
fi
[ -s "$FILE" ] || { echo "Empty encrypted backup" >&2; exit 1; }
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OBJECT="postgres/daily/pointvet-$STAMP-${RANDOM}-${RANDOM}.dump.age"
aws --endpoint-url "$R2_ENDPOINT" s3api put-object --bucket "$R2_BUCKET" --key "$OBJECT" --body "$FILE" --output json >/dev/null
aws --endpoint-url "$R2_ENDPOINT" s3api head-object --bucket "$R2_BUCKET" --key "$OBJECT" --query ContentLength --output text > "$TMPDIR/remote-size"
test "$(cat "$TMPDIR/remote-size")" = "$(wc -c < "$FILE" | tr -d ' ')" || { echo "Encrypted backup upload size mismatch" >&2; exit 1; }
echo "Encrypted backup uploaded and size verified: $OBJECT"
