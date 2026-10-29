#!/usr/bin/env bash
# M.5.73 - synthetic legacy upgrade rehearsal on DISPOSABLE CI PostgreSQL 18 ONLY.
# Never read/download commercial data, run Railway, or use production URLs.
set -Eeuo pipefail
umask 077
die(){ printf 'POINTVET_M573_CI_BLOCKED: %s\n' "$*" >&2; exit 1; }
EXPECTED_URL="postgresql://pointvet_upgrade_ci:pointvet_upgrade_ci_only@localhost:5434/pointvet_upgrade_ci"
[[ "${GITHUB_ACTIONS:-}" == "true" ]] || die "GitHub Actions only"
[[ "${NODE_ENV:-}" == "test" ]] || die "NODE_ENV must equal test"
[[ "${DATABASE_URL:-}" == "$EXPECTED_URL" ]] || die "non-disposable database URL refused"
[[ "${POINTVET_M573_SYNTHETIC_ONLY:-}" == "YES" ]] || die "synthetic-only opt-in required"
[[ -n "${GITHUB_WORKSPACE:-}" && -n "${RUNNER_TEMP:-}" ]] || die "CI runner directories required"
command -v docker >/dev/null || die "Docker missing"
command -v npx >/dev/null || die "npx missing"
BASE="$GITHUB_WORKSPACE/main-baseline/api/prisma/migrations"
FULL="$GITHUB_WORKSPACE/api/prisma/migrations"
[[ -f "$BASE/migration_lock.toml" && -f "$FULL/migration_lock.toml" ]] ||
 die "missing isolated baseline/candidate migrations"
[[ "$(pwd)" == "$GITHUB_WORKSPACE/api" ]] || die "run only from CI api checkout"
count_dirs(){ find "$1" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' '; }
[[ "$(count_dirs "$BASE")" == "22" ]] || die "main baseline is not 22 migrations"
[[ "$(count_dirs "$FULL")" == "48" ]] || die "candidate is not 48 migrations"
SCRATCH="$(mktemp -d "$RUNNER_TEMP/m573-upgrade.XXXXXXXX")"
[[ -d "$SCRATCH" ]] || die "scratch unavailable"
cp -a "$FULL" "$SCRATCH/full"
restore_checkout(){
 if [[ -d "$SCRATCH/full" ]]; then
  rm -rf -- "$FULL"
  cp -a "$SCRATCH/full" "$FULL"
 fi
 rm -rf -- "$SCRATCH"
}
trap restore_checkout EXIT
psql_ci(){
 docker run --rm -i --network host \
  -e PGPASSWORD=pointvet_upgrade_ci_only postgres:18 \
  psql -X -q -A -t -v ON_ERROR_STOP=1 \
  -h 127.0.0.1 -p 5434 -U pointvet_upgrade_ci -d pointvet_upgrade_ci "$@"
}
actual="$(psql_ci -c "SELECT current_database() || ':' || current_user;" 2>/dev/null || true)"
# Identity verification without exposing names/connection info in logs.
[[ "$actual" == "pointvet_upgrade_ci:pointvet_upgrade_ci" ]] ||
 die "disposable database identity mismatch"
rm -rf -- "$FULL"
cp -a "$BASE" "$FULL"
npm run db:deploy
before="$(psql_ci -c "SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;")"
[[ "$before" == "22" ]] || die "baseline migration count mismatch"
# Insert only synthetic legacy rows. Prisma @updatedAt is required by PostgreSQL.
psql_ci <<'SQL'
BEGIN;
INSERT INTO public.organizacoes(id,slug,nome,"updatedAt")
 VALUES ('m573-org','m573-only-synthetic','M573 Synthetic',now());
INSERT INTO public.empresas(id,"organizacaoId",tipo,"razaoSocial","nomeFantasia",cnpj,"updatedAt")
 VALUES
 ('m573-co1','m573-org','LOJA_CONSULTORIO','Synthetic A','Synthetic A','98765000000001',now()),
 ('m573-co2','m573-org','BANHO_TOSA','Synthetic B','Synthetic B','98765000000002',now());
INSERT INTO public.clientes(id,"organizacaoId",nome,"updatedAt")
 VALUES ('m573-cli','m573-org','Synthetic Client',now());
INSERT INTO public.especies(id,"organizacaoId",nome,"updatedAt")
 VALUES ('m573-esp','m573-org','Synthetic Species',now());
INSERT INTO public.pets(id,"clienteId","especieId",nome,"updatedAt")
 VALUES ('m573-pet','m573-cli','m573-esp','Synthetic Pet',now());
INSERT INTO public.itens_catalogo(id,"empresaId",tipo,nome,"precoVenda","updatedAt")
 VALUES
 ('m573-cat1','m573-co1','PRODUTO','Synthetic A Item',10.00,now()),
 ('m573-cat2','m573-co2','PRODUTO','Synthetic B Item',20.00,now());
INSERT INTO public.comandas(id,"clienteId",status,"updatedAt")
 VALUES ('m573-mixed','m573-cli','ABERTA',now()),
        ('m573-single','m573-cli','ABERTA',now());
INSERT INTO public.comanda_itens(id,"comandaId","empresaId","itemCatalogoId",descricao,quantidade,"valorUnitario","valorTotal",status,"updatedAt")
 VALUES
 ('m573-line1','m573-mixed','m573-co1','m573-cat1','Synthetic A Item',1,10.00,10.00,'ATIVO',now()),
 ('m573-line2','m573-mixed','m573-co2','m573-cat2','Synthetic B Item',1,20.00,20.00,'ATIVO',now()),
 ('m573-line3','m573-single','m573-co1','m573-cat1','Synthetic A Item',1,10.00,10.00,'ATIVO',now());
INSERT INTO public.atendimentos_clinicos(id,"empresaId","clienteId","petId","comandaId","updatedAt")
 VALUES ('m573-clinical','m573-co1','m573-cli','m573-pet','m573-mixed',now());
INSERT INTO public.ordens_servico_banho_tosa(id,"empresaId","clienteId","petId","comandaId","updatedAt")
 VALUES ('m573-bath','m573-co2','m573-cli','m573-pet','m573-mixed',now());
COMMIT;
SQL
# Preserve only the fingerprints of synthetic links; no real data exists in CI.
read -r fingerprint_before < <(psql_ci -c "
 SELECT md5(string_agg(id || ':' || \"comandaId\" || ':' || \"empresaId\" || ':' || status::text, ',' ORDER BY id))
 FROM public.comanda_itens WHERE id LIKE 'm573-%';")
[[ -n "$fingerprint_before" ]] || die "synthetic item fingerprints missing"
[[ "$(psql_ci -c "SELECT count(*) FROM public.comandas WHERE id IN ('m573-mixed','m573-single');")" == "2" ]] ||
 die "synthetic comanda fixture failed"
[[ "$(psql_ci -c "SELECT count(DISTINCT \"empresaId\") FROM public.comanda_itens WHERE \"comandaId\"='m573-mixed';")" == "2" ]] ||
 die "synthetic two-company fixture failed"
rm -rf -- "$FULL"
cp -a "$SCRATCH/full" "$FULL"
npm run db:deploy
after="$(psql_ci -c "SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;")"
[[ "$after" == "48" ]] || die "26 candidate migrations did not complete"
failures="$(psql_ci -c "SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;")"
[[ "$failures" == "0" ]] || die "unfinished migrations"
read -r fingerprint_after < <(psql_ci -c "
 SELECT md5(string_agg(id || ':' || \"comandaId\" || ':' || \"empresaId\" || ':' || status::text, ',' ORDER BY id))
 FROM public.comanda_itens WHERE id LIKE 'm573-%';")
[[ "$fingerprint_before" == "$fingerprint_after" ]] || die "item CNPJ links/status changed"
result="$(psql_ci -c "
SELECT CASE WHEN
 (SELECT count(*) FROM public.comandas WHERE id IN ('m573-mixed','m573-single') AND \"organizacaoId\"='m573-org')=2
 AND (SELECT count(*) FROM public.comandas WHERE \"clienteId\"='m573-cli')=2
 AND (SELECT count(*) FROM public.comanda_itens WHERE \"comandaId\" IN ('m573-mixed','m573-single'))=3
 AND (SELECT count(*) FROM public.atendimentos_clinicos WHERE id='m573-clinical' AND \"empresaId\"='m573-co1' AND \"comandaId\"='m573-mixed')=1
 AND (SELECT count(*) FROM public.ordens_servico_banho_tosa WHERE id='m573-bath' AND \"empresaId\"='m573-co2' AND \"comandaId\"='m573-mixed')=1
 AND (SELECT count(*) FROM public.vendas WHERE \"comandaId\" IN ('m573-mixed','m573-single'))=0
 AND (SELECT count(*) FROM public.comandas WHERE id='m573-mixed' AND status='ABERTA' AND \"empresaOrigemId\" IN ('m573-co1','m573-co2'))=1
 AND (SELECT count(*) FROM public.comandas WHERE id='m573-single' AND \"empresaOrigemId\"='m573-co1')=1
 AND (SELECT count(DISTINCT \"empresaId\") FROM public.comanda_itens WHERE \"comandaId\"='m573-mixed')=2
 THEN 'CONSISTENT' ELSE 'BLOCKED' END;")"
[[ "$result" == "CONSISTENT" ]] || die "legacy multi-CNPJ invariant mismatch"
printf 'POINTVET_M573_SYNTHETIC_UPGRADE_CONSISTENT baselineMigrations=%s candidateMigrations=%s appliedNew=%s legacyComandas=2 mixedComandas=1 retainedItems=3 clinical=1 bath=1 sales=0 productionAuthorized=false\n' "$before" "$after" "$((after-before))"
