-- M.5.71: a empresa de origem permite proteger ate comandas sem itens.
-- Nao confundir limite de tenant (organizacaoId) com autorizacao de CNPJ.
-- Legado com empresa ambigua permanece NULL: nunca atribuir CNPJ por palpite.
ALTER TABLE "comandas" ADD COLUMN "empresaOrigemId" TEXT;

-- Origem inferivel: primeiro lancamento da comanda, somente se do mesmo tenant.
UPDATE "comandas" c SET "empresaOrigemId" = origem."empresaId"
FROM (
  SELECT DISTINCT ON (ci."comandaId") ci."comandaId", ci."empresaId"
  FROM "comanda_itens" ci
  ORDER BY ci."comandaId", ci."createdAt", ci."id"
) origem
JOIN "empresas" e ON e."id" = origem."empresaId"
WHERE c."id" = origem."comandaId"
  AND c."organizacaoId" = e."organizacaoId";

-- Comandas antigas sem itens mas ja faturadas: primeira venda registrada.
UPDATE "comandas" c SET "empresaOrigemId" = origem."empresaId"
FROM (
  SELECT DISTINCT ON (v."comandaId") v."comandaId", v."empresaId"
  FROM "vendas" v
  WHERE v."comandaId" IS NOT NULL
  ORDER BY v."comandaId", v."createdAt", v."id"
) origem
JOIN "empresas" e ON e."id" = origem."empresaId"
WHERE c."id" = origem."comandaId"
  AND c."organizacaoId" = e."organizacaoId"
  AND c."empresaOrigemId" IS NULL;

-- Atendimentos clinicos ou banho/tosa ainda sem lancamentos.
UPDATE "comandas" c SET "empresaOrigemId" = origem."empresaId"
FROM (
  SELECT DISTINCT ON (a."comandaId") a."comandaId", a."empresaId"
  FROM "atendimentos_clinicos" a
  WHERE a."comandaId" IS NOT NULL
  ORDER BY a."comandaId", a."createdAt", a."id"
) origem
JOIN "empresas" e ON e."id" = origem."empresaId"
WHERE c."id" = origem."comandaId"
  AND c."organizacaoId" = e."organizacaoId"
  AND c."empresaOrigemId" IS NULL;

UPDATE "comandas" c SET "empresaOrigemId" = origem."empresaId"
FROM (
  SELECT DISTINCT ON (o."comandaId") o."comandaId", o."empresaId"
  FROM "ordens_servico_banho_tosa" o
  WHERE o."comandaId" IS NOT NULL
  ORDER BY o."comandaId", o."createdAt", o."id"
) origem
JOIN "empresas" e ON e."id" = origem."empresaId"
WHERE c."id" = origem."comandaId"
  AND c."organizacaoId" = e."organizacaoId"
  AND c."empresaOrigemId" IS NULL;

ALTER TABLE "comandas"
  ADD CONSTRAINT "comandas_empresaOrigemId_fkey"
  FOREIGN KEY ("empresaOrigemId") REFERENCES "empresas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "comandas_organizacaoId_empresaOrigemId_idx"
  ON "comandas"("organizacaoId", "empresaOrigemId");
