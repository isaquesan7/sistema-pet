#!/bin/sh
# PointVet M.5.60 — volumes representativos 100% ficticios, so Railway isolado.
# Espelha relacionamentos reais de tutor/pet/venda/item/pagamento; jamais Pet King.
set -eu
umask 077
die() { echo "POINTVET_M560_VOLUME_BLOCKED: $*" >&2; exit 1; }
test "$RAILWAY_PROJECT_ID" = '11a9be9f-7635-4e74-96f9-0c48d77242c9' ||
 die 'outro projeto Railway'
test "$POINTVET_M560_SCOPE" = 'volume-synthetic-only' || die 'scope invalido'
test "$PGDATABASE" = 'pointvet_unified_ci' || die 'banco incorreto'
case "$PGHOST" in *.railway.internal) ;; *) die 'host nao privado' ;; esac
test -n "$PGUSER" && test -n "$PGPASSWORD" && test -n "$PGPORT" ||
 die 'credenciais ausentes'
sql() { psql -X -At -q -v ON_ERROR_STOP=1 -d "$PGDATABASE" -c "$1"; }
test "$(sql 'SELECT current_database()')" = 'pointvet_unified_ci' ||
 die 'identidade do banco divergente'

# Aguarda o sucesso das quatro suites de integracao M559. Falha fechada.
ready=''
for attempt in $(seq 1 90); do
 ready=$(sql "SELECT CASE WHEN to_regclass('public.pointvet_m559_drill_control')
  IS NULL THEN 'WAIT' ELSE
  (SELECT marker FROM pointvet_m559_drill_control LIMIT 1) END" 2>/dev/null || true)
 test "$ready" = 'M559_READY' && break
 sleep 8
done
test "$ready" = 'M559_READY' || die 'suite M559 nao aprovou fixtures'
test "$(sql "SELECT count(*) FROM pg_database
 WHERE datname='pointvet_m560_full_restore'")" = '0' ||
 die 'destino de restore preexistente'
test "$(sql "SELECT to_regclass('public.pointvet_m560_drill_control')
 IS NULL")" = 't' || die 'carga ja executada'
echo 'POINTVET_M560_VOLUME_START: 50k clientes + 50k pets + 150k vendas + 150k itens + 150k pagamentos'
start=$(date +%s)

# Um unico commit atomico. Todos os IDs e documentos sao ficticios; nenhuma
# sessao de caixa, baixa de estoque, PSP ou emissao fiscal e acionada.
psql -X -q -v ON_ERROR_STOP=1 -d "$PGDATABASE" <<'SQL'
BEGIN;
CREATE TEMP TABLE m560_ctx ON COMMIT DROP AS
SELECT a."organizacaoId" AS org, a.id AS loja, b.id AS banho,
 ua."usuarioId" AS usuario, ia.id AS produto, ib.id AS servico
FROM empresas a JOIN empresas b ON b."organizacaoId"=a."organizacaoId"
JOIN usuario_empresas ua ON ua."empresaId"=a.id
JOIN usuario_empresas ub ON ub."empresaId"=b.id AND ub."usuarioId"=ua."usuarioId"
JOIN itens_catalogo ia ON ia."empresaId"=a.id
JOIN itens_catalogo ib ON ib."empresaId"=b.id
WHERE a.id LIKE 'c1%' AND b.id LIKE 'c2%'
ORDER BY ia.id,ib.id LIMIT 1;
DO $$ BEGIN
 IF (SELECT count(*) FROM m560_ctx)<>1 THEN
  RAISE EXCEPTION 'M560_SEM_ANCHOR_DE_DOIS_CNPJS';
 END IF;
END $$;

INSERT INTO clientes(id,"organizacaoId",nome,telefone,"updatedAt")
SELECT 'm560-client-'||lpad(g::text,6,'0'),c.org,
 'Tutor inteiramente ficticio '||g||' '||md5(g::text),
 '00000'||lpad((g % 100000)::text,5,'0'),now()
FROM generate_series(1,50000) g CROSS JOIN m560_ctx c;
INSERT INTO especies(id,"organizacaoId",nome,"updatedAt")
SELECT 'm560-species',org,'Especie Sintetica M560',now() FROM m560_ctx;
INSERT INTO pets(id,"clienteId","especieId",nome,"updatedAt")
SELECT 'm560-pet-'||lpad(g::text,6,'0'),
 'm560-client-'||lpad(g::text,6,'0'),'m560-species',
 'Pet de teste '||g||' '||md5(('pet'||g)::text),now()
FROM generate_series(1,50000) g;

INSERT INTO vendas(id,"empresaId","clienteId","usuarioId",status,
 subtotal,"valorTotal",observacoes,"updatedAt","finalizadaEm")
SELECT 'm560-sale-'||lpad(g::text,6,'0'),
 CASE WHEN g%2=0 THEN c.loja ELSE c.banho END,
 'm560-client-'||lpad((1+(g-1)%50000)::text,6,'0'),
 c.usuario,'FINALIZADA',
 (10+(g%9900)::numeric/100)::numeric(12,2),
 (10+(g%9900)::numeric/100)::numeric(12,2),
 'M560_FICTICIO_NAO_BANCARIO '||md5(('venda'||g)::text),
 now(),now()-(g||' seconds')::interval
FROM generate_series(1,150000) g CROSS JOIN m560_ctx c;
INSERT INTO venda_itens(id,"vendaId","itemCatalogoId",descricao,
 quantidade,"valorUnitario","valorTotal")
SELECT 'm560-line-'||lpad(g::text,6,'0'),
 'm560-sale-'||lpad(g::text,6,'0'),
 CASE WHEN g%2=0 THEN c.produto ELSE c.servico END,
 'Item ficticio '||g||' '||md5(('item'||g)::text),
 1,(10+(g%9900)::numeric/100)::numeric(12,2),
 (10+(g%9900)::numeric/100)::numeric(12,2)
FROM generate_series(1,150000) g CROSS JOIN m560_ctx c;
INSERT INTO pagamentos(id,"vendaId",forma,status,valor,
 observacoes,"pagoEm")
SELECT 'm560-pay-'||lpad(g::text,6,'0'),
 'm560-sale-'||lpad(g::text,6,'0'),
 (CASE WHEN g%3=0 THEN 'PIX' WHEN g%3=1 THEN 'DINHEIRO'
 ELSE 'CARTAO_CREDITO' END)::"FormaPagamento",
 'APROVADO',(10+(g%9900)::numeric/100)::numeric(12,2),
 'M560_REGISTRO_SINTETICO_SEM_TRANSACAO_EXTERNA '||md5(('pago'||g)::text),
 now()-(g||' seconds')::interval
FROM generate_series(1,150000) g;

CREATE TABLE pointvet_m560_drill_control (
 marker text PRIMARY KEY CHECK (marker='M560_READY'),
 clients integer NOT NULL, pets integer NOT NULL,
 sales integer NOT NULL, items integer NOT NULL,payments integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO pointvet_m560_drill_control(marker,clients,pets,sales,items,payments)
VALUES('M560_READY',50000,50000,150000,150000,150000);
COMMIT;
SQL

# Fresh bulk inserts need real planner statistics before multi-table
# integrity checks; otherwise PostgreSQL can choose pathological joins.
psql -X -q -v ON_ERROR_STOP=1 -d "$PGDATABASE" -c \
 'ANALYZE clientes; ANALYZE pets; ANALYZE vendas; ANALYZE venda_itens; ANALYZE pagamentos;'

verified=$(sql "SELECT CASE WHEN
 (SELECT count(*) FROM clientes WHERE id LIKE 'm560-client-%')=50000 AND
 (SELECT count(*) FROM pets WHERE id LIKE 'm560-pet-%')=50000 AND
 (SELECT count(*) FROM vendas WHERE id LIKE 'm560-sale-%')=150000 AND
 (SELECT count(*) FROM venda_itens WHERE id LIKE 'm560-line-%')=150000 AND
 (SELECT count(*) FROM pagamentos WHERE id LIKE 'm560-pay-%')=150000 AND
 (SELECT count(DISTINCT \"empresaId\") FROM vendas WHERE id LIKE 'm560-sale-%')=2
 THEN 'READY' ELSE 'INVALID' END")
test "$verified" = 'READY' || die 'contagens ou CNPJs da carga divergentes'
size=$(sql "SELECT pg_database_size(current_database())")
test "$size" -gt 50000000 || die 'banco ainda abaixo de 50MB'
elapsed=$(($(date +%s)-start))
printf 'POINTVET_M560_VOLUME_SUCCESS: new_clients=50000 new_pets=50000 new_sales=150000 new_items=150000 new_payments=150000 two_issuers=true rows=550000 database_bytes=%s load_seconds=%s\n' "$size" "$elapsed"
echo 'POINTVET_M560_SYNTHETIC_ONLY: nenhuma transacao bancaria, fiscal ou Pet King'
sleep 600
