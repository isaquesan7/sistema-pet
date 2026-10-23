#!/bin/sh
# PointVet M.5.59 — full real Prisma schema, synthetic-only, isolated PG18.
# Fail closed: no staging/production and never overwrite an existing DB.
set -eu
umask 077
die() { printf 'POINTVET_M559_RESTORE_BLOCKED: %s\n' "$*" >&2; exit 1; }
expected='11a9be9f-7635-4e74-96f9-0c48d77242c9'
test "$RAILWAY_PROJECT_ID" = "$expected" || die 'wrong Railway project'
test "$POINTVET_M559_SCOPE" = 'full-schema-synthetic-only' || die 'wrong scope'
test "$PGDATABASE" = 'pointvet_unified_ci' || die 'not a disposable database'
case "$PGHOST" in *.railway.internal) ;; *) die 'not a private Railway host' ;; esac
test -n "$PGUSER" && test -n "$PGPASSWORD" && test -n "$PGPORT" ||
 die 'missing database credentials'
command -v pg_dump >/dev/null && command -v pg_restore >/dev/null ||
 die 'PostgreSQL client not installed'
command -v sha256sum >/dev/null || die 'sha256sum not installed'

source_db='pointvet_unified_ci'
restore_db='pointvet_m559_full_restore_v2'
scratch=$(mktemp -d /tmp/pointvet-m559.XXXXXXXX)
trap 'rm -rf "$scratch"' EXIT HUP INT TERM
sql() { psql -X -At -q -v ON_ERROR_STOP=1 -d "$1" -c "$2"; }
test "$(sql "$source_db" 'SELECT current_database()')" = "$source_db" ||
 die 'database identity mismatch'
existing=$(sql "$source_db" "SELECT count(*) FROM pg_database WHERE datname='$restore_db'")
test "$existing" = '0' || die 'restore target already exists'
printf 'POINTVET_M559_RESTORE_WAIT: pg_version='
sql "$source_db" 'SHOW server_version'

# Only seed success writes marker. Poll strictly within the isolated project.
ready=''
for attempt in $(seq 1 90); do
 ready=$(sql "$source_db" "SELECT CASE
  WHEN to_regclass('public.pointvet_m559_drill_control') IS NULL THEN 'WAIT'
  ELSE (SELECT marker FROM pointvet_m559_drill_control LIMIT 1)
  END" 2>/dev/null || true)
 test "$ready" = 'M559_READY' && break
 sleep 8
done
test "$ready" = 'M559_READY' || die 'synthetic seeder did not finish'
fixture=$(sql "$source_db" "
 SELECT CASE WHEN
  (SELECT count(*) FROM empresas)>=2 AND
  (SELECT count(*) FROM vendas)>=2 AND
  (SELECT count(*) FROM estornos_fechamento_manual_unificado)>0 AND
  (SELECT count(*) FROM fluxos_fiscais_unificados_ci)>=2 AND
  (SELECT count(*) FROM eventos_fluxo_fiscal_unificado_ci)>=5 AND
  (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL)>0 AND
  (SELECT count(*) FROM movimentacoes_estoque WHERE quantidade=0.333
   AND tipo IN ('VENDA','CANCELAMENTO'))>=2
 THEN 'READY' ELSE 'INVALID' END")
test "$fixture" = 'READY' || die 'missing complete PointVet business fixtures'

backup_started=$(date +%s)
pg_dump --format=custom --no-owner --no-acl -d "$source_db" \
 -f "$scratch/full.dump" || die 'pg_dump failed'
test -s "$scratch/full.dump" || die 'empty dump'
dump_bytes=$(wc -c < "$scratch/full.dump" | tr -d ' ')
test "$dump_bytes" -gt 10000 || die 'suspiciously small dump'
sha256sum "$scratch/full.dump" > "$scratch/full.sha256"
backup_finished=$(date +%s)

sql "$source_db" "CREATE DATABASE $restore_db" >/dev/null
test "$(sql "$restore_db" 'SELECT current_database()')" = "$restore_db" ||
 die 'restore database identity mismatch'
restore_started=$(date +%s)
pg_restore --format=custom --no-owner --no-acl --exit-on-error \
 -d "$restore_db" "$scratch/full.dump" > "$scratch/restore.log" 2>&1 ||
 die 'pg_restore failed'
restore_finished=$(date +%s)
sha256sum -c -s "$scratch/full.sha256" ||
 die 'backup checksum mismatch'

# Fingerprint every public table, index, constraint, sequence, view, trigger,
# and Prisma migrations (which are included as ordinary table records).
cat > "$scratch/fingerprint.sql" <<'SQL'
SELECT format(
 'SELECT %L,count(*)::bigint,md5(coalesce(string_agg(md5(to_jsonb(r)::text),chr(10) ORDER BY md5(to_jsonb(r)::text)),%L)) FROM %I.%I r;',
 'TABLE:'||schemaname||'.'||tablename,'',schemaname,tablename)
 FROM pg_tables WHERE schemaname='public' ORDER BY tablename
\gexec
SELECT 'SCHEMA:INDEX',count(*)::bigint,
 md5(coalesce(string_agg(indexname||':'||indexdef,chr(10)
 ORDER BY schemaname,tablename,indexname),''))
 FROM pg_indexes WHERE schemaname='public';
SELECT 'SCHEMA:CONSTRAINT_COUNT',count(*)::bigint
 FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
 WHERE n.nspname='public';
SELECT 'CONSTRAINT:'||c.conrelid::regclass::text||':'||c.conname,
 pg_get_constraintdef(c.oid) FROM pg_constraint c
 JOIN pg_namespace n ON n.oid=c.connamespace
 WHERE n.nspname='public'
 ORDER BY c.conrelid::regclass::text,c.conname;
SELECT 'SCHEMA:SEQUENCE',count(*)::bigint,
 md5(coalesce(string_agg(sequencename||':'||coalesce(last_value::text,'NULL')||
 ':'||start_value::text||':'||increment_by::text,chr(10)
 ORDER BY sequencename),''))
 FROM pg_sequences WHERE schemaname='public';
SELECT 'SCHEMA:VIEW',count(*)::bigint,
 md5(coalesce(string_agg(viewname||':'||definition,chr(10)
 ORDER BY viewname),''))
 FROM pg_views WHERE schemaname='public';
SELECT 'SCHEMA:TRIGGER',count(*)::bigint,
 md5(coalesce(string_agg(t.tgname||':'||pg_get_triggerdef(t.oid),chr(10)
 ORDER BY t.tgname),''))
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND NOT t.tgisinternal;
SQL
fingerprint() {
 psql -X -At -q -v ON_ERROR_STOP=1 -d "$1" -f "$scratch/fingerprint.sql" |
  sed -E "/^CONSTRAINT:/ {
   s/\('([^']+)'::character varying\)::text/'\1'::character varying/g;
   s/\(\(ARRAY\[([^]]+)\]\)::text\[\]\)/(ARRAY[\1])/g;
  }" > "$2"
}
fingerprint "$source_db" "$scratch/source.fp"
fingerprint "$restore_db" "$scratch/restore.fp"
test -s "$scratch/source.fp" || die 'empty metadata fingerprint'
if ! cmp -s "$scratch/source.fp" "$scratch/restore.fp"; then
 echo 'POINTVET_M559_DIFF: synthetic data/schema mismatch' >&2
 diff -u "$scratch/source.fp" "$scratch/restore.fp" | head -n 45 >&2 || true
 die 'restored schema or data differs'
fi

# Proven refund invariant: exact FEFO lot weights, company child sales and
# payment reversals, matching the existing GitHub Actions drill.
business=$(sql "$restore_db" "
 WITH original AS (
  SELECT e.id AS estorno,m.\"produtoId\" AS produto,m.\"loteId\" AS lote,
   sum(m.quantidade) AS peso
  FROM estornos_fechamento_manual_unificado e
  JOIN reservas_operacoes_unificadas op ON op.\"reservaId\"=e.\"reservaId\"
  JOIN movimentacoes_estoque m ON m.\"origemTipo\"='VENDA'
   AND m.\"origemId\"=op.\"vendaId\" AND m.tipo='VENDA'
  GROUP BY e.id,m.\"produtoId\",m.\"loteId\"
 ), reverted AS (
  SELECT e.id AS estorno,m.\"produtoId\" AS produto,m.\"loteId\" AS lote,
   sum(m.quantidade) AS peso
  FROM estornos_fechamento_manual_unificado e
  JOIN movimentacoes_estoque m ON m.\"origemTipo\"='ESTORNO_MANUAL_UNIFICADO'
   AND m.\"origemId\"=e.id AND m.tipo='CANCELAMENTO'
  GROUP BY e.id,m.\"produtoId\",m.\"loteId\"
 ), mismatch AS (
  SELECT 1 FROM original o FULL JOIN reverted r ON
   o.estorno=r.estorno AND o.produto=r.produto
   AND o.lote IS NOT DISTINCT FROM r.lote
  WHERE o.peso IS DISTINCT FROM r.peso
 )
 SELECT CASE WHEN
  (SELECT count(*) FROM estornos_fechamento_manual_unificado)>0 AND
  NOT EXISTS(SELECT 1 FROM mismatch) AND
  NOT EXISTS(
   SELECT 1 FROM estornos_fechamento_manual_unificado e
   JOIN reservas_fechamento_unificado r ON r.id=e.\"reservaId\"
   JOIN comandas c ON c.id=r.\"comandaId\"
   WHERE r.status<>'CANCELADA' OR c.status<>'CANCELADA'
    OR e.\"confirmouDevolucaoExterna\" IS NOT TRUE
  ) AND NOT EXISTS(
   SELECT 1 FROM estornos_fechamento_manual_unificado e
   JOIN reservas_operacoes_unificadas op ON op.\"reservaId\"=e.\"reservaId\"
   LEFT JOIN vendas v ON v.id=op.\"vendaId\"
   WHERE op.status<>'ESTORNADA' OR v.status IS DISTINCT FROM 'ESTORNADA'
    OR EXISTS(SELECT 1 FROM pagamentos p WHERE p.\"vendaId\"=v.id
     AND p.status<>'ESTORNADO')
  )
 THEN 'READY' ELSE 'DIVERGENT' END")
test "$business" = 'READY' || die 'restored refunds, payments or lot weights inconsistent'

sql "$restore_db" "
 BEGIN;
 UPDATE empresas SET \"nomeFantasia\"='M559_TEMP_ROLLBACK'
 WHERE id=(SELECT id FROM empresas ORDER BY id LIMIT 1);
 ROLLBACK;" >/dev/null
fingerprint "$restore_db" "$scratch/rollback.fp"
cmp -s "$scratch/source.fp" "$scratch/rollback.fp" ||
 die 'transaction rollback changed restored data'

table_count=$(grep -c '^TABLE:' "$scratch/source.fp")
migration_count=$(sql "$restore_db" 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL')
company_count=$(sql "$restore_db" 'SELECT count(*) FROM empresas')
refund_count=$(sql "$restore_db" 'SELECT count(*) FROM estornos_fechamento_manual_unificado')
test "$table_count" -gt 25 || die 'not full PointVet schema'
printf 'POINTVET_M559_FULL_SCHEMA_RESTORE_SUCCESS: project=%s pg=%s dump_bytes=%s tables=%s migrations=%s companies=%s refunds=%s backup_seconds=%s restore_seconds=%s sha256=%s\n' \
 "$RAILWAY_PROJECT_ID" "$(sql "$source_db" 'SHOW server_version')" \
 "$dump_bytes" "$table_count" "$migration_count" "$company_count" "$refund_count" \
 "$((backup_finished-backup_started))" "$((restore_finished-restore_started))" \
 "$(sha256sum "$scratch/full.dump" | cut -c 1-16)"
echo 'POINTVET_M559_ONLY_SYNTHETIC: no real Pet King data, banking or tax operations'
sleep 600
