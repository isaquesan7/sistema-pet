-- PointVet M.5.72: diagnostic ONLY, aggregated, read-only, no IDs or CNPJ numbers.
-- Multi-company comandas can be intentional. Identify sources and tenant boundaries.
WITH refs AS (
 SELECT "comandaId", "empresaId", 'ITEM' AS kind FROM "comanda_itens"
 UNION ALL SELECT "comandaId", "empresaId", 'SALE' AS kind FROM "vendas" WHERE "comandaId" IS NOT NULL
 UNION ALL SELECT "comandaId", "empresaId", 'CLINICAL' AS kind FROM "atendimentos_clinicos" WHERE "comandaId" IS NOT NULL
 UNION ALL SELECT "comandaId", "empresaId", 'BATH' AS kind FROM "ordens_servico_banho_tosa" WHERE "comandaId" IS NOT NULL
),
company_sources AS (
 SELECT "comandaId", "empresaId",
  bool_or(kind='ITEM') AS has_item,
  bool_or(kind='SALE') AS has_sale,
  bool_or(kind='CLINICAL') AS has_clinical,
  bool_or(kind='BATH') AS has_bath
 FROM refs GROUP BY "comandaId","empresaId"
),
by_comanda AS (
 SELECT c.id, c.status,
  count(*) AS companies,
  bool_and(e."organizacaoId" = cl."organizacaoId") AS all_in_client_tenant,
  count(DISTINCT e."organizacaoId") AS distinct_orgs,
  bool_or(cs.has_item) AS has_items,
  bool_or(cs.has_sale) AS has_sales,
  bool_or(cs.has_clinical) AS has_clinical,
  bool_or(cs.has_bath) AS has_bath,
  bool_or((cs.has_clinical OR cs.has_bath) AND NOT (cs.has_item OR cs.has_sale))
    AS has_clinical_bath_only_company
 FROM "comandas" c
 JOIN "clientes" cl ON cl.id=c."clienteId"
 JOIN company_sources cs ON cs."comandaId"=c.id
 JOIN "empresas" e ON e.id=cs."empresaId"
 GROUP BY c.id, c.status
 HAVING count(*) > 1
)
SELECT json_build_object(
 'readOnly',current_setting('default_transaction_read_only')='on',
 'multiCompanyComandas',(SELECT count(*) FROM by_comanda),
 'sameTenantComandas',(SELECT count(*) FROM by_comanda WHERE all_in_client_tenant AND distinct_orgs=1),
 'crossTenantComandas',(SELECT count(*) FROM by_comanda WHERE NOT all_in_client_tenant OR distinct_orgs>1),
 'withItems',(SELECT count(*) FROM by_comanda WHERE has_items),
 'withSales',(SELECT count(*) FROM by_comanda WHERE has_sales),
 'withClinical',(SELECT count(*) FROM by_comanda WHERE has_clinical),
 'withBath',(SELECT count(*) FROM by_comanda WHERE has_bath),
 'openComandas',(SELECT count(*) FROM by_comanda WHERE status='ABERTA'),
 'nonOpenComandas',(SELECT count(*) FROM by_comanda WHERE status<>'ABERTA'),
 'withClinicalBathOnlyCompany',(SELECT count(*) FROM by_comanda WHERE has_clinical_bath_only_company)
)::text;
