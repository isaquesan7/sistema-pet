#!/bin/sh
# PointVet M.5.60 — volumetric full-schema backup/restore (synthetic Railway only).
# Refuses existing destination; neither staging nor commercial Pet King is touched.
set -eu
umask 077
die() { printf 'POINTVET_M560_RESTORE_BLOCKED: %s\n' "$*" >&2; exit 1; }
test "$RAILWAY_PROJECT_ID" = '11a9be9f-7635-4e74-96f9-0c48d77242c9' ||
 die 'wrong Railway project'
test "$POINTVET_M560_SCOPE" = 'volume-synthetic-only' || die 'wrong scope'
test "$PGDATABASE" = 'pointvet_unified_ci' || die 'not a disposable database'
case "$PGHOST" in *.railway.internal) ;; *) die 'not a private Railway host' ;; esac
test -n "$PGUSER" && test -n "$PGPASSWORD" && test -n "$PGPORT" ||
 die 'missing database credentials'
command -v pg_dump >/dev/null && command -v pg_restore >/dev/null ||
 die 'PostgreSQL client not installed'
command -v sha256sum >/dev/null || die 'sha256sum not installed'

source_db='pointvet_unified_ci'
restore_db='pointvet_m560_full_restore'
scratch=$(mktemp -d /tmp/pointvet-m560.XXXXXXXX)
trap 'rm -rf "$scratch"' EXIT HUP INT TERM
sql() { psql -X -At -q -v ON_ERROR_STOP=1 -d "$1" -c "$2"; }
test "$(sql "$source_db" 'SELECT current_database()')" = "$source_db" ||
 die 'database identity mismatch'
test "$(sql "$source_db" "SELECT count(*) FROM pg_database WHERE datname='$restore_db'")" = '0' ||
 die 'restore target already exists'
echo "POINTVET_M560_RESTORE_WAIT: pg=$(sql "$source_db" 'SHOW server_version')"

# Wait until the bulk loader commits all 550,000 rows atomically.
ready=''
for attempt in $(seq 1 120); do
 ready=$(sql "$source_db" "SELECT CASE
  WHEN to_regclass('public.pointvet_m560_drill_control') IS NULL THEN 'WAIT'
  ELSE (SELECT marker FROM pointvet_m560_drill_control LIMIT 1)
  END" 2>/dev/null || true)
 test "$ready" = 'M560_READY' && break
 sleep 8
done
test "$ready" = 'M560_READY' || die 'synthetic volume load not complete'

# Bulk-loaded PostgreSQL tables might not yet have usable planner stats.
# Ensure both fixture verification and post-restore joins are planned safely.
echo 'POINTVET_M560_ANALYZE_START: synthetic relational fixtures'
psql -X -q -v ON_ERROR_STOP=1 -d "$source_db" -c \
 'ANALYZE clientes; ANALYZE pets; ANALYZE vendas; ANALYZE venda_itens; ANALYZE pagamentos;'

check_volume() {
 sql "$1" "
  SELECT CASE WHEN
   (SELECT count(*) FROM clientes WHERE id LIKE 'm560-client-%')=50000 AND
   (SELECT count(*) FROM pets WHERE id LIKE 'm560-pet-%')=50000 AND
   (SELECT count(*) FROM vendas WHERE id LIKE 'm560-sale-%')=150000 AND
   (SELECT count(*) FROM venda_itens WHERE id LIKE 'm560-line-%')=150000 AND
   (SELECT count(*) FROM pagamentos WHERE id LIKE 'm560-pay-%')=150000 AND
   (SELECT count(DISTINCT \"empresaId\") FROM vendas
    WHERE id LIKE 'm560-sale-%')=2 AND
   (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL)>=46 AND
   (SELECT count(*) FROM estornos_fechamento_manual_unificado)>0 AND
   (SELECT count(*) FROM movimentacoes_estoque
    WHERE quantidade=0.333 AND tipo IN ('VENDA','CANCELAMENTO'))>=2 AND
   (SELECT count(*) FROM pointvet_m560_drill_control
    WHERE marker='M560_READY' AND clients=50000 AND pets=50000
     AND sales=150000 AND items=150000 AND payments=150000)=1 AND
   (SELECT count(*) FROM vendas v JOIN pagamentos p ON p.\"vendaId\"=v.id
    WHERE v.id LIKE 'm560-sale-%' AND v.\"valorTotal\"=p.valor
     AND v.status='FINALIZADA' AND p.status='APROVADO')=150000 AND
   (SELECT count(*) FROM venda_itens vi JOIN vendas v ON vi.\"vendaId\"=v.id
    WHERE vi.id LIKE 'm560-line-%' AND vi.\"valorTotal\"=v.\"valorTotal\")=150000
   THEN 'READY' ELSE 'INVALID' END"
}
test "$(check_volume "$source_db")" = 'READY' ||
 die 'synthetic source counts, payments or multi-company mappings invalid'
source_bytes=$(sql "$source_db" "SELECT pg_database_size(current_database())")
test "$source_bytes" -gt 50000000 || die 'source database below 50 MB'
echo "POINTVET_M560_BACKUP_START: database_bytes=$source_bytes rows_added=550000"
backup_started=$(date +%s)
pg_dump --format=custom --no-owner --no-acl -d "$source_db" \
 -f "$scratch/full.dump" || die 'pg_dump failed'
backup_finished=$(date +%s)
test -s "$scratch/full.dump" || die 'empty dump'
dump_bytes=$(wc -c < "$scratch/full.dump" | tr -d ' ')
test "$dump_bytes" -gt 1000000 || die 'suspiciously small dump'
sha256sum "$scratch/full.dump" > "$scratch/full.sha256"

sql "$source_db" "CREATE DATABASE $restore_db" >/dev/null
test "$(sql "$restore_db" 'SELECT current_database()')" = "$restore_db" ||
 die 'restore identity mismatch'
echo "POINTVET_M560_RESTORE_START: dump_bytes=$dump_bytes"
restore_started=$(date +%s)
pg_restore --format=custom --no-owner --no-acl --exit-on-error \
 -d "$restore_db" "$scratch/full.dump" > "$scratch/restore.log" 2>&1 || {
  tail -n 30 "$scratch/restore.log" >&2
  die 'pg_restore failed'
 }
restore_finished=$(date +%s)
sha256sum -c -s "$scratch/full.sha256" || die 'backup checksum mismatch'
psql -X -q -v ON_ERROR_STOP=1 -d "$restore_db" -c \
 'ANALYZE clientes; ANALYZE pets; ANALYZE vendas; ANALYZE venda_itens; ANALYZE pagamentos;'
test "$(check_volume "$restore_db")" = 'READY' ||
 die 'restored synthetic rows or financial amounts invalid'
echo 'POINTVET_M560_RESTORE_ROW_CHECK_SUCCESS'

# Reproducible content fingerprints for every table and its DDL features.
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
echo 'POINTVET_M560_FINGERPRINT_START: every public table, index, constraint, sequence, view and trigger'
fingerprint "$source_db" "$scratch/source.fp"
fingerprint "$restore_db" "$scratch/restore.fp"
test -s "$scratch/source.fp" || die 'empty schema fingerprint'
if ! cmp -s "$scratch/source.fp" "$scratch/restore.fp"; then
 echo 'POINTVET_M560_DIFF: synthetic data/schema mismatch' >&2
 diff -u "$scratch/source.fp" "$scratch/restore.fp" | head -n 45 >&2 || true
 die 'restored schema or data differs'
fi

# Preserve M559's exact inventory-lot reverse operations under the larger load.
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
 )
 SELECT CASE WHEN
  (SELECT count(*) FROM estornos_fechamento_manual_unificado)>0 AND
  NOT EXISTS(
   SELECT 1 FROM original o FULL JOIN reverted r ON
    o.estorno=r.estorno AND o.produto=r.produto
    AND o.lote IS NOT DISTINCT FROM r.lote
   WHERE o.peso IS DISTINCT FROM r.peso
  ) AND NOT EXISTS(
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
test "$business" = 'READY' || die 'restored 333 g lots, refunds or payments differ'

sql "$restore_db" "
 BEGIN;
 UPDATE empresas SET \"nomeFantasia\"='M560_TEMP_ROLLBACK'
 WHERE id=(SELECT id FROM empresas ORDER BY id LIMIT 1);
 ROLLBACK;" >/dev/null
fingerprint "$restore_db" "$scratch/rollback.fp"
cmp -s "$scratch/source.fp" "$scratch/rollback.fp" ||
 die 'transaction rollback changed restored data'

table_count=$(grep -c '^TABLE:' "$scratch/source.fp")
migrations=$(sql "$restore_db" 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL')
refunds=$(sql "$restore_db" 'SELECT count(*) FROM estornos_fechamento_manual_unificado')
restored_bytes=$(sql "$restore_db" "SELECT pg_database_size(current_database())")
test "$table_count" -ge 120 || die 'not the full PointVet + M559 + M560 schema'
printf 'POINTVET_M560_LARGE_RESTORE_SUCCESS: rows_added=550000 tables=%s migrations=%s refunds=%s source_database_bytes=%s restored_database_bytes=%s dump_bytes=%s backup_seconds=%s restore_seconds=%s sha256_prefix=%s\n' \
 "$table_count" "$migrations" "$refunds" "$source_bytes" "$restored_bytes" \
 "$dump_bytes" "$((backup_finished-backup_started))" \
 "$((restore_finished-restore_started))" \
 "$(sha256sum "$scratch/full.dump" | cut -c 1-16)"
echo 'POINTVET_M560_SYNTHETIC_ONLY: zero real Pet King records, no banks or fiscal provider'
sleep 600
