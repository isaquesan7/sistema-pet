#!/usr/bin/env bash
# PointVet M.5.1 — backup/restore rehearsal on SYNTHETIC DISPOSABLE CI PG16 ONLY.
# Refuses Railway, staging and production databases. Never publishes a dump.
set -Eeuo pipefail
umask 077
SOURCE="pointvet_unified_ci"
RESTORE="pointvet_restore_ci"
EXPECTED_URL="postgresql://pointvet_ci:pointvet_ci_only@localhost:5432/$SOURCE"
die() { echo "POINTVET_M5_CI_RESTORE_BLOCKED: $*" >&2; exit 1; }
[[ "$GITHUB_ACTIONS" == "true" ]] || die "GitHub Actions only"
[[ "$NODE_ENV" == "test" ]] || die "NODE_ENV must be test"
[[ "$POINTVET_UNIFIED_SALES_SANDBOX" == "1" ]] || die "sandbox required"
[[ "$DATABASE_URL" == "$EXPECTED_URL" ]] || die "exact disposable CI URL required"
command -v docker >/dev/null || die "Docker missing"
command -v sha256sum >/dev/null || die "sha256sum missing"
pg() {
 docker run --rm -i --network host --env "PGPASSWORD=pointvet_ci_only" postgres:16 "$@"
}
psql_ci() {
 local database="$1"; shift
 [[ "$database" == "$SOURCE" || "$database" == "$RESTORE" ]] ||
  die "other DB forbidden"
 pg psql --host=127.0.0.1 --port=5432 --username=pointvet_ci \
  --dbname="$database" --no-psqlrc --set=ON_ERROR_STOP=1 "$@"
}
scratch="$(mktemp -d "$RUNNER_TEMP/pointvet-restore-ci.XXXXXXXX")"
trap 'rm -rf -- "$scratch"' EXIT
identity="$(psql_ci "$SOURCE" --tuples-only --no-align \
 --command="SELECT current_database() || ':' || current_user")"
[[ "$identity" == "$SOURCE:pointvet_ci" ]] || die "source identity mismatch"
fixture="$(psql_ci "$SOURCE" --tuples-only --no-align --command="
 SELECT CASE WHEN
  (SELECT count(*) FROM empresas)>=2 AND
  (SELECT count(*) FROM vendas)>=2 AND
  (SELECT count(*) FROM fluxos_fiscais_unificados_ci)>=2 AND
  (SELECT count(*) FROM eventos_fluxo_fiscal_unificado_ci)>=5
 THEN 'READY' ELSE 'EMPTY' END;")"
[[ "$fixture" == "READY" ]] || die "fixture lacks sales and fiscal events"
echo "POINTVET_M5: verified synthetic CI source with two issuers and fiscal events"
# Binary dump stays on the CI runner, never uploaded nor copied from production.
pg pg_dump --host=127.0.0.1 --port=5432 --username=pointvet_ci \
 --dbname="$SOURCE" --format=custom --no-owner --no-acl > "$scratch/backup.dump"
[[ -s "$scratch/backup.dump" ]] || die "backup empty"
dump_bytes="$(wc -c < "$scratch/backup.dump")"
[[ "$dump_bytes" -gt 10000 ]] || die "suspiciously small backup"
(cd "$scratch" && sha256sum backup.dump > backup.sha256)
existing="$(psql_ci "$SOURCE" --tuples-only --no-align --command="
 SELECT count(*) FROM pg_database WHERE datname='$RESTORE';")"
[[ "$existing" == "0" ]] || die "restore target must be new"
psql_ci "$SOURCE" --quiet --command="CREATE DATABASE $RESTORE;" > /dev/null
target="$(psql_ci "$RESTORE" --tuples-only --no-align \
 --command="SELECT current_database() || ':' || current_user")"
[[ "$target" == "$RESTORE:pointvet_ci" ]] || die "restore target mismatch"
pg pg_restore --host=127.0.0.1 --port=5432 --username=pointvet_ci \
 --dbname="$RESTORE" --format=custom --no-owner --no-acl \
 --exit-on-error < "$scratch/backup.dump"
(cd "$scratch" && sha256sum --check --status backup.sha256) ||
 die "dump checksum changed"
# Deterministic data fingerprint for EVERY public table, plus indexes,
# constraints and sequence position. Only counts/hashes reach the CI log.
cat > "$scratch/fingerprints.sql" <<'SQL'
SELECT format(
 'SELECT %L, count(*)::bigint, md5(coalesce(string_agg(to_jsonb(r)::text, chr(10) ORDER BY to_jsonb(r)::text),%L)) FROM %I.%I r;',
 'TABLE:'||schemaname||'.'||tablename, '', schemaname,tablename
) FROM pg_tables WHERE schemaname='public' ORDER BY tablename
\gexec
SELECT 'SCHEMA:INDEX',count(*)::bigint,
 md5(coalesce(string_agg(indexname||':'||indexdef,chr(10)
 ORDER BY schemaname,tablename,indexname),''))
 FROM pg_indexes WHERE schemaname='public';
-- Count ALL constraints; each definition is also hashed separately below.
SELECT 'SCHEMA:CONSTRAINT_COUNT',count(*)::bigint
 FROM pg_constraint c
 JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public';
-- Exact per-constraint fingerprints so semantic differences are never hidden
-- by a combined checksum. This also identifies which definition differs.
SELECT 'CONSTRAINT:'||c.conrelid::regclass::text||':'||c.conname,
 pg_get_constraintdef(c.oid)
 FROM pg_constraint c
 JOIN pg_namespace n ON n.oid=c.connamespace
 WHERE n.nspname='public'
 ORDER BY c.conrelid::regclass::text,c.conname;
SELECT 'SCHEMA:SEQUENCE',count(*)::bigint,
 md5(coalesce(string_agg(sequencename||':'||coalesce(last_value::text,'NULL')||
 ':'||start_value::text||':'||increment_by::text,chr(10)
 ORDER BY sequencename),''))
 FROM pg_sequences WHERE schemaname='public';
SQL
fingerprint() {
 psql_ci "$1" --quiet --tuples-only --no-align --file=/dev/stdin \
  < "$scratch/fingerprints.sql" > "$scratch/schema-raw.fp"
 node scripts/ci-pointvet-canonical-schema.mjs "$scratch/schema-raw.fp" "$2"
}
fingerprint "$SOURCE" "$scratch/source.fp"
fingerprint "$RESTORE" "$scratch/restore.fp"
[[ -s "$scratch/source.fp" ]] || die "empty fingerprint list"
if ! cmp -s "$scratch/source.fp" "$scratch/restore.fp"; then
 echo "POINTVET_M5: SAFE comparison diagnostic (table names, counts and fingerprints only)" >&2
 diff -u "$scratch/source.fp" "$scratch/restore.fp" | head -n 80 >&2 || true
 # Check definitions contain schema only, never client data; print only the
 # four documented CHECK constraints whose pg_dump round-trip altered text.
 for db in "$SOURCE" "$RESTORE"; do
  echo "POINTVET_M5_CONSTRAINT_DEF $db" >&2
  psql_ci "$db" --quiet --tuples-only --no-align --command="
   SELECT c.conname || ' : ' || pg_get_constraintdef(c.oid)
   FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
   WHERE n.nspname='public' AND c.conname IN
    ('fluxos_fiscais_unificados_ci_classe_check',
     'fluxos_fiscais_unificados_ci_estado_check',
     'fluxos_fiscais_unificados_ci_tipo_check',
     'platform_support_tickets_status_check')
   ORDER BY c.conname;" >&2
 done
 die "data / schema / sequence mismatch after restore"
fi
DATABASE_URL="postgresql://pointvet_ci:pointvet_ci_only@localhost:5432/$RESTORE" \
 npm run db:status > "$scratch/prisma.log" 2>&1 ||
 die "restored migration history is not compatible with Prisma"
# Test transaction rollback on restored fixture ONLY, not schema migration rollback.
psql_ci "$RESTORE" --quiet --command="
 BEGIN;
 UPDATE empresas SET \"nomeFantasia\"='M5_TRANSIENT_ROLLBACK'
 WHERE id=(SELECT id FROM empresas ORDER BY id LIMIT 1);
 ROLLBACK;" > /dev/null
fingerprint "$RESTORE" "$scratch/restore-after-rollback.fp"
cmp -s "$scratch/source.fp" "$scratch/restore-after-rollback.fp" ||
 die "restored fixture mismatch after transactional rollback"
echo "POINTVET_M5_CI_RESTORE_SUCCESS: backup, new-db restore, ALL table records, indexes, constraints, sequences, Prisma migrations and transactional rollback verified"
echo "POINTVET_M5: backup bytes=$dump_bytes; verified tables=$(grep -c '^TABLE:' "$scratch/source.fp")"
echo "POINTVET_M5: staging/production restore NOT performed; synthetic ephemeral data only"
