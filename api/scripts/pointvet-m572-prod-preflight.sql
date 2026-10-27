-- PointVet M.5.72 — auditoria SOMENTE LEITURA antes de migrations comerciais.
-- Executada via psql com default_transaction_read_only=on, nunca automaticamente.
-- Retorna exclusivamente metricas agregadas. Sem identificadores de tutor/pet.
WITH refs AS (
  SELECT "comandaId", "empresaId" FROM "comanda_itens"
  UNION ALL
  SELECT "comandaId", "empresaId" FROM "vendas" WHERE "comandaId" IS NOT NULL
  UNION ALL
  SELECT "comandaId", "empresaId" FROM "atendimentos_clinicos" WHERE "comandaId" IS NOT NULL
  UNION ALL
  SELECT "comandaId", "empresaId" FROM "ordens_servico_banho_tosa" WHERE "comandaId" IS NOT NULL
)
SELECT json_build_object(
  'readOnly', current_setting('default_transaction_read_only')='on',
  'totalComandas', (SELECT count(*) FROM "comandas"),
  'orphanComandas', (
    SELECT count(*) FROM "comandas" c
    LEFT JOIN "clientes" cl ON cl.id=c."clienteId"
    WHERE cl.id IS NULL OR cl."organizacaoId" IS NULL
  ),
  'crossTenantItems', (
    SELECT count(*) FROM "comanda_itens" i
    JOIN "comandas" c ON c.id=i."comandaId"
    JOIN "clientes" cl ON cl.id=c."clienteId"
    JOIN "empresas" e ON e.id=i."empresaId"
    WHERE cl."organizacaoId" IS DISTINCT FROM e."organizacaoId"
  ),
  'crossTenantSales', (
    SELECT count(*) FROM "vendas" v
    JOIN "comandas" c ON c.id=v."comandaId"
    JOIN "clientes" cl ON cl.id=c."clienteId"
    JOIN "empresas" e ON e.id=v."empresaId"
    WHERE cl."organizacaoId" IS DISTINCT FROM e."organizacaoId"
  ),
  'crossTenantClinical', (
    SELECT count(*) FROM "atendimentos_clinicos" a
    JOIN "comandas" c ON c.id=a."comandaId"
    JOIN "clientes" cl ON cl.id=c."clienteId"
    JOIN "empresas" e ON e.id=a."empresaId"
    WHERE cl."organizacaoId" IS DISTINCT FROM e."organizacaoId"
  ),
  'crossTenantBath', (
    SELECT count(*) FROM "ordens_servico_banho_tosa" o
    JOIN "comandas" c ON c.id=o."comandaId"
    JOIN "clientes" cl ON cl.id=c."clienteId"
    JOIN "empresas" e ON e.id=o."empresaId"
    WHERE cl."organizacaoId" IS DISTINCT FROM e."organizacaoId"
  ),
  'multiCompanyComandas', (
    SELECT count(*) FROM (
      SELECT "comandaId" FROM refs GROUP BY "comandaId"
      HAVING count(DISTINCT "empresaId")>1
    ) conflicts
  ),
  'openComandasWithoutCompanyReference', (
    SELECT count(*) FROM "comandas" c
    WHERE c.status='ABERTA'
      AND NOT EXISTS (SELECT 1 FROM refs r WHERE r."comandaId"=c.id)
  ),
  'unfinishedMigrations', (
    SELECT count(*) FROM "public"."_prisma_migrations"
    WHERE finished_at IS NULL AND rolled_back_at IS NULL
  ),
  'completedMigrations', (
    SELECT count(*) FROM "public"."_prisma_migrations"
    WHERE finished_at IS NOT NULL
  ),
  'alreadyHasComandaOrganizacao', (
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='comandas' AND column_name='organizacaoId')
  ),
  'alreadyHasComandaEmpresaOrigem', (
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='comandas' AND column_name='empresaOrigemId')
  )
)::text;
