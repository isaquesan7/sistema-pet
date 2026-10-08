-- =====================================================
-- SaaS FOUNDATION 2.0
-- Adds tenant isolation, configurable catalogs, HR/time clock,
-- packages, pricing history and fiscal foundations.
-- Existing data is preserved and attached to a legacy organization.
-- =====================================================

-- Extend existing enum
ALTER TYPE "TipoEmpresa" ADD VALUE IF NOT EXISTS 'OUTRA';

-- New enums
CREATE TYPE "TipoVinculoOrganizacao" AS ENUM ('PROPRIETARIO', 'ADMINISTRADOR', 'MEMBRO');
CREATE TYPE "ModuloSistema" AS ENUM ('PDV', 'ESTOQUE', 'CONSULTORIO', 'BANHO_TOSA', 'FINANCEIRO', 'PORTAL_CLIENTE', 'PONTO', 'FISCAL', 'RELATORIOS');
CREATE TYPE "StatusFuncionario" AS ENUM ('ATIVO', 'AFASTADO', 'FERIAS', 'DESLIGADO');
CREATE TYPE "TipoRegistroPonto" AS ENUM ('ENTRADA', 'INICIO_PAUSA', 'FIM_PAUSA', 'SAIDA');
CREATE TYPE "OrigemRegistroPonto" AS ENUM ('WEB', 'MOBILE', 'ADMIN', 'IMPORTACAO');
CREATE TYPE "StatusFechamentoPonto" AS ENUM ('ABERTO', 'FECHADO');
CREATE TYPE "TipoPacote" AS ENUM ('FIXO', 'TEMPORARIO', 'PERSONALIZADO');
CREATE TYPE "StatusPacoteCliente" AS ENUM ('ATIVO', 'ESGOTADO', 'EXPIRADO', 'CANCELADO');
CREATE TYPE "RegimeTributario" AS ENUM ('SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'MEI', 'OUTRO');
CREATE TYPE "AmbienteFiscal" AS ENUM ('HOMOLOGACAO', 'PRODUCAO');
CREATE TYPE "TipoDocumentoFiscal" AS ENUM ('NFCE', 'NFE', 'NFSE', 'RECIBO');
CREATE TYPE "StatusDocumentoFiscal" AS ENUM ('PENDENTE', 'PROCESSANDO', 'AUTORIZADO', 'REJEITADO', 'CANCELADO', 'ERRO');

-- =====================================================
-- ORGANIZATION / TENANT
-- =====================================================

CREATE TABLE "organizacoes" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organizacoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizacoes_slug_key" ON "organizacoes"("slug");
CREATE INDEX "organizacoes_nome_idx" ON "organizacoes"("nome");

CREATE TABLE "configuracoes_organizacao" (
    "id" TEXT NOT NULL,
    "organizacaoId" TEXT NOT NULL,
    "nomeExibicao" TEXT,
    "logoUrl" TEXT,
    "corPrimaria" TEXT,
    "corSecundaria" TEXT,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "site" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "configuracoes_organizacao_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "configuracoes_organizacao_organizacaoId_key" ON "configuracoes_organizacao"("organizacaoId");

CREATE TABLE "modulos_organizacao" (
    "organizacaoId" TEXT NOT NULL,
    "modulo" "ModuloSistema" NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT true,
    "configuracao" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "modulos_organizacao_pkey" PRIMARY KEY ("organizacaoId", "modulo")
);

CREATE TABLE "usuario_organizacoes" (
    "usuarioId" TEXT NOT NULL,
    "organizacaoId" TEXT NOT NULL,
    "papel" "TipoVinculoOrganizacao" NOT NULL DEFAULT 'MEMBRO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usuario_organizacoes_pkey" PRIMARY KEY ("usuarioId", "organizacaoId")
);
CREATE INDEX "usuario_organizacoes_organizacaoId_idx" ON "usuario_organizacoes"("organizacaoId");

-- Create a migration organization only when legacy data exists.
INSERT INTO "organizacoes" ("id", "slug", "nome", "ativo", "createdAt", "updatedAt")
SELECT
    'org_legacy_migration',
    'organizacao-migrada',
    COALESCE((SELECT MIN("nomeFantasia") FROM "empresas"), 'Organização migrada'),
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "empresas")
   OR EXISTS (SELECT 1 FROM "clientes")
   OR EXISTS (SELECT 1 FROM "especies")
   OR EXISTS (SELECT 1 FROM "fornecedores")
   OR EXISTS (SELECT 1 FROM "categorias_itens")
   OR EXISTS (SELECT 1 FROM "contas_clientes");

INSERT INTO "configuracoes_organizacao" (
    "id", "organizacaoId", "nomeExibicao", "timezone", "locale", "moeda", "createdAt", "updatedAt"
)
SELECT
    'cfg_org_legacy_migration',
    'org_legacy_migration',
    "nome",
    'America/Sao_Paulo',
    'pt-BR',
    'BRL',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "organizacoes"
WHERE "id" = 'org_legacy_migration';

INSERT INTO "modulos_organizacao" ("organizacaoId", "modulo", "habilitado", "createdAt", "updatedAt")
SELECT 'org_legacy_migration', t.modulo::"ModuloSistema", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM unnest(ARRAY['PDV','ESTOQUE','CONSULTORIO','BANHO_TOSA','FINANCEIRO','PORTAL_CLIENTE','PONTO','FISCAL','RELATORIOS']) AS t(modulo)
WHERE EXISTS (SELECT 1 FROM "organizacoes" WHERE "id" = 'org_legacy_migration');

-- =====================================================
-- TENANT COLUMNS ON LEGACY TABLES
-- =====================================================

ALTER TABLE "empresas" ADD COLUMN "organizacaoId" TEXT;
ALTER TABLE "clientes" ADD COLUMN "organizacaoId" TEXT;
ALTER TABLE "contas_clientes" ADD COLUMN "organizacaoId" TEXT;
ALTER TABLE "especies" ADD COLUMN "organizacaoId" TEXT;
ALTER TABLE "fornecedores" ADD COLUMN "organizacaoId" TEXT;
ALTER TABLE "categorias_itens" ADD COLUMN "organizacaoId" TEXT;

UPDATE "empresas" SET "organizacaoId" = 'org_legacy_migration' WHERE "organizacaoId" IS NULL;
UPDATE "clientes" SET "organizacaoId" = 'org_legacy_migration' WHERE "organizacaoId" IS NULL;
UPDATE "contas_clientes" SET "organizacaoId" = 'org_legacy_migration' WHERE "organizacaoId" IS NULL;
UPDATE "especies" SET "organizacaoId" = 'org_legacy_migration' WHERE "organizacaoId" IS NULL;
UPDATE "fornecedores" SET "organizacaoId" = 'org_legacy_migration' WHERE "organizacaoId" IS NULL;
UPDATE "categorias_itens" SET "organizacaoId" = 'org_legacy_migration' WHERE "organizacaoId" IS NULL;

ALTER TABLE "empresas" ALTER COLUMN "organizacaoId" SET NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "organizacaoId" SET NOT NULL;
ALTER TABLE "contas_clientes" ALTER COLUMN "organizacaoId" SET NOT NULL;
ALTER TABLE "especies" ALTER COLUMN "organizacaoId" SET NOT NULL;
ALTER TABLE "fornecedores" ALTER COLUMN "organizacaoId" SET NOT NULL;
ALTER TABLE "categorias_itens" ALTER COLUMN "organizacaoId" SET NOT NULL;

CREATE INDEX "empresas_organizacaoId_idx" ON "empresas"("organizacaoId");
CREATE INDEX "clientes_organizacaoId_idx" ON "clientes"("organizacaoId");
CREATE INDEX "contas_clientes_organizacaoId_idx" ON "contas_clientes"("organizacaoId");
CREATE INDEX "especies_organizacaoId_idx" ON "especies"("organizacaoId");
CREATE INDEX "fornecedores_organizacaoId_idx" ON "fornecedores"("organizacaoId");

-- Replace global uniqueness with tenant-scoped uniqueness.
DROP INDEX IF EXISTS "clientes_cpfCnpj_key";
DROP INDEX IF EXISTS "contas_clientes_email_key";
DROP INDEX IF EXISTS "contas_clientes_telefone_key";
DROP INDEX IF EXISTS "especies_nome_key";
DROP INDEX IF EXISTS "fornecedores_cpfCnpj_key";

CREATE UNIQUE INDEX "clientes_organizacaoId_cpfCnpj_key" ON "clientes"("organizacaoId", "cpfCnpj");
CREATE UNIQUE INDEX "contas_clientes_organizacaoId_email_key" ON "contas_clientes"("organizacaoId", "email");
CREATE UNIQUE INDEX "contas_clientes_organizacaoId_telefone_key" ON "contas_clientes"("organizacaoId", "telefone");
CREATE UNIQUE INDEX "especies_organizacaoId_nome_key" ON "especies"("organizacaoId", "nome");
CREATE UNIQUE INDEX "fornecedores_organizacaoId_cpfCnpj_key" ON "fornecedores"("organizacaoId", "cpfCnpj");

-- User -> organization memberships inferred from existing company access.
INSERT INTO "usuario_organizacoes" ("usuarioId", "organizacaoId", "papel", "ativo", "createdAt")
SELECT
    ue."usuarioId",
    e."organizacaoId",
    CASE
      WHEN bool_or(lower(COALESCE(c."nome", '')) LIKE '%administr%') THEN 'ADMINISTRADOR'::"TipoVinculoOrganizacao"
      ELSE 'MEMBRO'::"TipoVinculoOrganizacao"
    END,
    true,
    CURRENT_TIMESTAMP
FROM "usuario_empresas" ue
JOIN "empresas" e ON e."id" = ue."empresaId"
LEFT JOIN "cargos" c ON c."id" = ue."cargoId"
GROUP BY ue."usuarioId", e."organizacaoId"
ON CONFLICT ("usuarioId", "organizacaoId") DO NOTHING;

-- =====================================================
-- CONFIGURABLE CATEGORIES
-- =====================================================

ALTER TABLE "categorias_itens" ADD COLUMN "parentId" TEXT;
ALTER TABLE "categorias_itens" ADD COLUMN "tipo" "TipoItemCatalogo";
ALTER TABLE "categorias_itens" ADD COLUMN "ordem" INTEGER NOT NULL DEFAULT 0;

UPDATE "categorias_itens" c
SET "tipo" = COALESCE(
    (SELECT i."tipo" FROM "itens_catalogo" i WHERE i."categoriaId" = c."id" LIMIT 1),
    'PRODUTO'::"TipoItemCatalogo"
)
WHERE c."tipo" IS NULL;
ALTER TABLE "categorias_itens" ALTER COLUMN "tipo" SET NOT NULL;

ALTER TABLE "categorias_itens" DROP CONSTRAINT IF EXISTS "categorias_itens_empresaId_fkey";
DROP INDEX IF EXISTS "categorias_itens_empresaId_idx";
DROP INDEX IF EXISTS "categorias_itens_empresaId_nome_key";
ALTER TABLE "categorias_itens" DROP COLUMN "empresaId";

CREATE INDEX "categorias_itens_organizacaoId_idx" ON "categorias_itens"("organizacaoId");
CREATE INDEX "categorias_itens_parentId_idx" ON "categorias_itens"("parentId");
CREATE INDEX "categorias_itens_tipo_idx" ON "categorias_itens"("tipo");

-- Categories used to be scoped per company. When two companies in the same
-- organization had an identical category, consolidate them before creating
-- the organization-scoped unique index.
WITH ranked_categories AS (
    SELECT
      "id",
      FIRST_VALUE("id") OVER (
        PARTITION BY "organizacaoId", "tipo", "nome"
        ORDER BY "id"
      ) AS keeper_id,
      ROW_NUMBER() OVER (
        PARTITION BY "organizacaoId", "tipo", "nome"
        ORDER BY "id"
      ) AS rn
    FROM "categorias_itens"
)
UPDATE "itens_catalogo" i
SET "categoriaId" = r.keeper_id
FROM ranked_categories r
WHERE i."categoriaId" = r."id"
  AND r.rn > 1;

WITH ranked_categories AS (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "organizacaoId", "tipo", "nome"
        ORDER BY "id"
      ) AS rn
    FROM "categorias_itens"
)
DELETE FROM "categorias_itens" c
USING ranked_categories r
WHERE c."id" = r."id"
  AND r.rn > 1;

CREATE UNIQUE INDEX "categorias_itens_organizacaoId_tipo_nome_key" ON "categorias_itens"("organizacaoId", "tipo", "nome");

-- =====================================================
-- PRICING / PRODUCTS / SERVICES
-- =====================================================

ALTER TABLE "itens_catalogo" ADD COLUMN "custoReferencia" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "itens_catalogo" ADD COLUMN "markupPercentual" DECIMAL(8,4);
ALTER TABLE "itens_catalogo" ADD COLUMN "margemBrutaPercentual" DECIMAL(8,4);
ALTER TABLE "itens_catalogo" ADD COLUMN "lucroBruto" DECIMAL(12,2);

UPDATE "itens_catalogo" i
SET "custoReferencia" = p."custoMedio"
FROM "produtos" p
WHERE p."itemId" = i."id";

UPDATE "itens_catalogo"
SET
  "lucroBruto" = "precoVenda" - "custoReferencia",
  "markupPercentual" = CASE
    WHEN "custoReferencia" > 0 THEN (("precoVenda" - "custoReferencia") / "custoReferencia") * 100
    ELSE NULL
  END,
  "margemBrutaPercentual" = CASE
    WHEN "precoVenda" > 0 THEN (("precoVenda" - "custoReferencia") / "precoVenda") * 100
    ELSE NULL
  END;

ALTER TABLE "produtos" ADD COLUMN "marca" TEXT;
ALTER TABLE "produtos" ADD COLUMN "controlaLote" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "produtos" ADD COLUMN "controlaValidade" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "servicos" ADD COLUMN "permiteAgendamento" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "servicos" ADD COLUMN "exigePet" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "servicos" ADD COLUMN "exigeProfissional" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "historico_precos_itens" (
    "id" TEXT NOT NULL,
    "itemCatalogoId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "custoReferencia" DECIMAL(12,2) NOT NULL,
    "precoVenda" DECIMAL(12,2) NOT NULL,
    "markupPercentual" DECIMAL(8,4),
    "margemBrutaPercentual" DECIMAL(8,4),
    "lucroBruto" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "historico_precos_itens_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "historico_precos_itens_itemCatalogoId_idx" ON "historico_precos_itens"("itemCatalogoId");
CREATE INDEX "historico_precos_itens_createdAt_idx" ON "historico_precos_itens"("createdAt");

-- Baseline history for products/services that already existed before this migration.
INSERT INTO "historico_precos_itens" (
  "id", "itemCatalogoId", "usuarioId", "custoReferencia", "precoVenda",
  "markupPercentual", "margemBrutaPercentual", "lucroBruto", "createdAt"
)
SELECT
  'hist_migr_' || md5(i."id"),
  i."id",
  NULL,
  i."custoReferencia",
  i."precoVenda",
  i."markupPercentual",
  i."margemBrutaPercentual",
  i."lucroBruto",
  CURRENT_TIMESTAMP
FROM "itens_catalogo" i;

-- =====================================================
-- HR / TIME CLOCK
-- =====================================================

CREATE TABLE "funcoes_funcionarios" (
    "id" TEXT NOT NULL,
    "organizacaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "funcoes_funcionarios_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "funcoes_funcionarios_organizacaoId_idx" ON "funcoes_funcionarios"("organizacaoId");
CREATE UNIQUE INDEX "funcoes_funcionarios_organizacaoId_nome_key" ON "funcoes_funcionarios"("organizacaoId", "nome");

CREATE TABLE "funcionarios" (
    "id" TEXT NOT NULL,
    "organizacaoId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "funcaoId" TEXT,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "matricula" TEXT,
    "dataAdmissao" DATE,
    "dataDemissao" DATE,
    "salarioBase" DECIMAL(12,2),
    "status" "StatusFuncionario" NOT NULL DEFAULT 'ATIVO',
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "funcionarios_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "funcionarios_organizacaoId_cpf_key" ON "funcionarios"("organizacaoId", "cpf");
CREATE UNIQUE INDEX "funcionarios_organizacaoId_matricula_key" ON "funcionarios"("organizacaoId", "matricula");
CREATE UNIQUE INDEX "funcionarios_organizacaoId_usuarioId_key" ON "funcionarios"("organizacaoId", "usuarioId");
CREATE INDEX "funcionarios_organizacaoId_idx" ON "funcionarios"("organizacaoId");
CREATE INDEX "funcionarios_usuarioId_idx" ON "funcionarios"("usuarioId");
CREATE INDEX "funcionarios_funcaoId_idx" ON "funcionarios"("funcaoId");
CREATE INDEX "funcionarios_nome_idx" ON "funcionarios"("nome");

CREATE TABLE "funcionario_empresas" (
    "funcionarioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "funcionario_empresas_pkey" PRIMARY KEY ("funcionarioId", "empresaId")
);
CREATE INDEX "funcionario_empresas_empresaId_idx" ON "funcionario_empresas"("empresaId");

CREATE TABLE "jornadas_trabalho" (
    "id" TEXT NOT NULL,
    "funcionarioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "entradaPrevista" TEXT NOT NULL,
    "saidaPrevista" TEXT NOT NULL,
    "inicioIntervalo" TEXT,
    "fimIntervalo" TEXT,
    "toleranciaMinutos" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "jornadas_trabalho_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "jornadas_trabalho_funcionarioId_empresaId_diaSemana_key" ON "jornadas_trabalho"("funcionarioId", "empresaId", "diaSemana");
CREATE INDEX "jornadas_trabalho_empresaId_idx" ON "jornadas_trabalho"("empresaId");

CREATE TABLE "registros_ponto" (
    "id" TEXT NOT NULL,
    "funcionarioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "registradoPorId" TEXT,
    "tipo" "TipoRegistroPonto" NOT NULL,
    "origem" "OrigemRegistroPonto" NOT NULL DEFAULT 'WEB',
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "registros_ponto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "registros_ponto_funcionarioId_registradoEm_idx" ON "registros_ponto"("funcionarioId", "registradoEm");
CREATE INDEX "registros_ponto_empresaId_registradoEm_idx" ON "registros_ponto"("empresaId", "registradoEm");
CREATE INDEX "registros_ponto_registradoPorId_idx" ON "registros_ponto"("registradoPorId");

CREATE TABLE "ajustes_ponto" (
    "id" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "horarioAnterior" TIMESTAMP(3) NOT NULL,
    "horarioNovo" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ajustes_ponto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ajustes_ponto_registroId_idx" ON "ajustes_ponto"("registroId");
CREATE INDEX "ajustes_ponto_usuarioId_idx" ON "ajustes_ponto"("usuarioId");

CREATE TABLE "fechamentos_ponto" (
    "id" TEXT NOT NULL,
    "funcionarioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "fechadoPorId" TEXT,
    "competencia" TEXT NOT NULL,
    "minutosPrevistos" INTEGER NOT NULL DEFAULT 0,
    "minutosTrabalhados" INTEGER NOT NULL DEFAULT 0,
    "minutosExtras" INTEGER NOT NULL DEFAULT 0,
    "minutosAtraso" INTEGER NOT NULL DEFAULT 0,
    "minutosPausa" INTEGER NOT NULL DEFAULT 0,
    "faltas" INTEGER NOT NULL DEFAULT 0,
    "status" "StatusFechamentoPonto" NOT NULL DEFAULT 'ABERTO',
    "fechadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fechamentos_ponto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fechamentos_ponto_funcionarioId_empresaId_competencia_key" ON "fechamentos_ponto"("funcionarioId", "empresaId", "competencia");
CREATE INDEX "fechamentos_ponto_empresaId_competencia_idx" ON "fechamentos_ponto"("empresaId", "competencia");

-- =====================================================
-- PACKAGES
-- =====================================================

CREATE TABLE "pacotes_modelo" (
    "id" TEXT NOT NULL,
    "organizacaoId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoPacote" NOT NULL DEFAULT 'FIXO',
    "valorPacote" DECIMAL(12,2) NOT NULL,
    "validadeDias" INTEGER,
    "inicioVigencia" DATE,
    "fimVigencia" DATE,
    "visivelPortal" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pacotes_modelo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pacotes_modelo_organizacaoId_idx" ON "pacotes_modelo"("organizacaoId");
CREATE INDEX "pacotes_modelo_empresaId_idx" ON "pacotes_modelo"("empresaId");
CREATE INDEX "pacotes_modelo_ativo_idx" ON "pacotes_modelo"("ativo");

CREATE TABLE "pacote_modelo_itens" (
    "id" TEXT NOT NULL,
    "pacoteModeloId" TEXT NOT NULL,
    "itemCatalogoId" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL DEFAULT 1,
    CONSTRAINT "pacote_modelo_itens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pacote_modelo_itens_pacoteModeloId_itemCatalogoId_key" ON "pacote_modelo_itens"("pacoteModeloId", "itemCatalogoId");
CREATE INDEX "pacote_modelo_itens_itemCatalogoId_idx" ON "pacote_modelo_itens"("itemCatalogoId");

CREATE TABLE "pacotes_clientes" (
    "id" TEXT NOT NULL,
    "organizacaoId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "modeloId" TEXT,
    "clienteId" TEXT NOT NULL,
    "petId" TEXT,
    "vendaId" TEXT,
    "tipo" "TipoPacote" NOT NULL,
    "nome" TEXT NOT NULL,
    "valorPacote" DECIMAL(12,2) NOT NULL,
    "inicioValidade" DATE NOT NULL,
    "fimValidade" DATE,
    "status" "StatusPacoteCliente" NOT NULL DEFAULT 'ATIVO',
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pacotes_clientes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pacotes_clientes_organizacaoId_idx" ON "pacotes_clientes"("organizacaoId");
CREATE INDEX "pacotes_clientes_empresaId_idx" ON "pacotes_clientes"("empresaId");
CREATE INDEX "pacotes_clientes_clienteId_idx" ON "pacotes_clientes"("clienteId");
CREATE INDEX "pacotes_clientes_petId_idx" ON "pacotes_clientes"("petId");
CREATE INDEX "pacotes_clientes_status_idx" ON "pacotes_clientes"("status");

CREATE TABLE "pacote_cliente_itens" (
    "id" TEXT NOT NULL,
    "pacoteClienteId" TEXT NOT NULL,
    "itemCatalogoId" TEXT NOT NULL,
    "quantidadeTotal" DECIMAL(12,3) NOT NULL,
    "quantidadeConsumida" DECIMAL(12,3) NOT NULL DEFAULT 0,
    CONSTRAINT "pacote_cliente_itens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pacote_cliente_itens_pacoteClienteId_itemCatalogoId_key" ON "pacote_cliente_itens"("pacoteClienteId", "itemCatalogoId");
CREATE INDEX "pacote_cliente_itens_itemCatalogoId_idx" ON "pacote_cliente_itens"("itemCatalogoId");

CREATE TABLE "consumos_pacote" (
    "id" TEXT NOT NULL,
    "pacoteClienteItemId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "petId" TEXT,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "origemTipo" TEXT,
    "origemId" TEXT,
    "observacao" TEXT,
    "consumidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consumos_pacote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "consumos_pacote_pacoteClienteItemId_idx" ON "consumos_pacote"("pacoteClienteItemId");
CREATE INDEX "consumos_pacote_consumidoEm_idx" ON "consumos_pacote"("consumidoEm");

-- =====================================================
-- FISCAL FOUNDATION
-- =====================================================

CREATE TABLE "configuracoes_fiscais_empresas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "regime" "RegimeTributario" NOT NULL DEFAULT 'OUTRO',
    "ambiente" "AmbienteFiscal" NOT NULL DEFAULT 'HOMOLOGACAO',
    "provedorFiscal" TEXT,
    "serieNfe" TEXT,
    "serieNfce" TEXT,
    "serieNfse" TEXT,
    "certificadoReferencia" TEXT,
    "certificadoValidoAte" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "configuracoes_fiscais_empresas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "configuracoes_fiscais_empresas_empresaId_key" ON "configuracoes_fiscais_empresas"("empresaId");

CREATE TABLE "configuracoes_fiscais_itens" (
    "id" TEXT NOT NULL,
    "itemCatalogoId" TEXT NOT NULL,
    "ncm" TEXT,
    "cest" TEXT,
    "cfop" TEXT,
    "origemMercadoria" TEXT,
    "cstCsosn" TEXT,
    "codigoServicoMunicipal" TEXT,
    "aliquotaIcms" DECIMAL(7,4),
    "aliquotaIss" DECIMAL(7,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "configuracoes_fiscais_itens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "configuracoes_fiscais_itens_itemCatalogoId_key" ON "configuracoes_fiscais_itens"("itemCatalogoId");

CREATE TABLE "documentos_fiscais" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "vendaId" TEXT,
    "tipo" "TipoDocumentoFiscal" NOT NULL,
    "status" "StatusDocumentoFiscal" NOT NULL DEFAULT 'PENDENTE',
    "numero" TEXT,
    "serie" TEXT,
    "chave" TEXT,
    "valorTotal" DECIMAL(12,2),
    "protocolo" TEXT,
    "xmlUrl" TEXT,
    "pdfUrl" TEXT,
    "mensagemErro" TEXT,
    "emitidoEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "documentos_fiscais_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "documentos_fiscais_empresaId_idx" ON "documentos_fiscais"("empresaId");
CREATE INDEX "documentos_fiscais_vendaId_idx" ON "documentos_fiscais"("vendaId");
CREATE INDEX "documentos_fiscais_status_idx" ON "documentos_fiscais"("status");
CREATE INDEX "documentos_fiscais_chave_idx" ON "documentos_fiscais"("chave");

-- =====================================================
-- AUDIT
-- =====================================================

CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "organizacaoId" TEXT NOT NULL,
    "empresaId" TEXT,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "dadosAnteriores" JSONB,
    "dadosNovos" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "auditoria_organizacaoId_createdAt_idx" ON "auditoria"("organizacaoId", "createdAt");
CREATE INDEX "auditoria_empresaId_createdAt_idx" ON "auditoria"("empresaId", "createdAt");
CREATE INDEX "auditoria_usuarioId_createdAt_idx" ON "auditoria"("usuarioId", "createdAt");
CREATE INDEX "auditoria_entidade_entidadeId_idx" ON "auditoria"("entidade", "entidadeId");

-- =====================================================
-- FOREIGN KEYS
-- =====================================================

ALTER TABLE "configuracoes_organizacao" ADD CONSTRAINT "configuracoes_organizacao_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "modulos_organizacao" ADD CONSTRAINT "modulos_organizacao_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usuario_organizacoes" ADD CONSTRAINT "usuario_organizacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usuario_organizacoes" ADD CONSTRAINT "usuario_organizacoes_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "empresas" ADD CONSTRAINT "empresas_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contas_clientes" ADD CONSTRAINT "contas_clientes_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "especies" ADD CONSTRAINT "especies_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fornecedores" ADD CONSTRAINT "fornecedores_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categorias_itens" ADD CONSTRAINT "categorias_itens_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categorias_itens" ADD CONSTRAINT "categorias_itens_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categorias_itens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "historico_precos_itens" ADD CONSTRAINT "historico_precos_itens_itemCatalogoId_fkey" FOREIGN KEY ("itemCatalogoId") REFERENCES "itens_catalogo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "historico_precos_itens" ADD CONSTRAINT "historico_precos_itens_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "funcoes_funcionarios" ADD CONSTRAINT "funcoes_funcionarios_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "funcoes_funcionarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "funcionario_empresas" ADD CONSTRAINT "funcionario_empresas_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "funcionarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "funcionario_empresas" ADD CONSTRAINT "funcionario_empresas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "jornadas_trabalho" ADD CONSTRAINT "jornadas_trabalho_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "funcionarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "jornadas_trabalho" ADD CONSTRAINT "jornadas_trabalho_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "registros_ponto" ADD CONSTRAINT "registros_ponto_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "funcionarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "registros_ponto" ADD CONSTRAINT "registros_ponto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registros_ponto" ADD CONSTRAINT "registros_ponto_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ajustes_ponto" ADD CONSTRAINT "ajustes_ponto_registroId_fkey" FOREIGN KEY ("registroId") REFERENCES "registros_ponto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ajustes_ponto" ADD CONSTRAINT "ajustes_ponto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fechamentos_ponto" ADD CONSTRAINT "fechamentos_ponto_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "funcionarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fechamentos_ponto" ADD CONSTRAINT "fechamentos_ponto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fechamentos_ponto" ADD CONSTRAINT "fechamentos_ponto_fechadoPorId_fkey" FOREIGN KEY ("fechadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pacotes_modelo" ADD CONSTRAINT "pacotes_modelo_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pacotes_modelo" ADD CONSTRAINT "pacotes_modelo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pacote_modelo_itens" ADD CONSTRAINT "pacote_modelo_itens_pacoteModeloId_fkey" FOREIGN KEY ("pacoteModeloId") REFERENCES "pacotes_modelo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pacote_modelo_itens" ADD CONSTRAINT "pacote_modelo_itens_itemCatalogoId_fkey" FOREIGN KEY ("itemCatalogoId") REFERENCES "itens_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pacotes_clientes" ADD CONSTRAINT "pacotes_clientes_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pacotes_clientes" ADD CONSTRAINT "pacotes_clientes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pacotes_clientes" ADD CONSTRAINT "pacotes_clientes_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "pacotes_modelo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pacotes_clientes" ADD CONSTRAINT "pacotes_clientes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pacotes_clientes" ADD CONSTRAINT "pacotes_clientes_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pacotes_clientes" ADD CONSTRAINT "pacotes_clientes_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "vendas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pacote_cliente_itens" ADD CONSTRAINT "pacote_cliente_itens_pacoteClienteId_fkey" FOREIGN KEY ("pacoteClienteId") REFERENCES "pacotes_clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pacote_cliente_itens" ADD CONSTRAINT "pacote_cliente_itens_itemCatalogoId_fkey" FOREIGN KEY ("itemCatalogoId") REFERENCES "itens_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consumos_pacote" ADD CONSTRAINT "consumos_pacote_pacoteClienteItemId_fkey" FOREIGN KEY ("pacoteClienteItemId") REFERENCES "pacote_cliente_itens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consumos_pacote" ADD CONSTRAINT "consumos_pacote_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consumos_pacote" ADD CONSTRAINT "consumos_pacote_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "configuracoes_fiscais_empresas" ADD CONSTRAINT "configuracoes_fiscais_empresas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "configuracoes_fiscais_itens" ADD CONSTRAINT "configuracoes_fiscais_itens_itemCatalogoId_fkey" FOREIGN KEY ("itemCatalogoId") REFERENCES "itens_catalogo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documentos_fiscais" ADD CONSTRAINT "documentos_fiscais_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documentos_fiscais" ADD CONSTRAINT "documentos_fiscais_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "vendas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
