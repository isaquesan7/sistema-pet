-- PETRISE PHASE 15 — SaaS COMMERCIAL / ONBOARDING
-- Adds plans, subscriptions, tenant billing, contracted-module control and platform administration.

CREATE TYPE "StatusAssinaturaSaaS" AS ENUM ('TRIAL', 'ATIVA', 'INADIMPLENTE', 'SUSPENSA', 'CANCELADA');
CREATE TYPE "CicloAssinaturaSaaS" AS ENUM ('MENSAL', 'ANUAL');
CREATE TYPE "StatusFaturaSaaS" AS ENUM ('PENDENTE', 'PAGA', 'VENCIDA', 'CANCELADA');
CREATE TYPE "ProvedorCobrancaSaaS" AS ENUM ('DESENVOLVIMENTO', 'MANUAL', 'STRIPE', 'ASAAS', 'OUTRO');

ALTER TABLE "usuarios" ADD COLUMN "superAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "modulos_organizacao" ADD COLUMN "contratado" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "planos_saas" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "descricao" TEXT,
  "precoMensal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "precoAnual" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "trialDias" INTEGER NOT NULL DEFAULT 14,
  "limiteEmpresas" INTEGER,
  "limiteUsuarios" INTEGER,
  "limiteClientes" INTEGER,
  "limitePets" INTEGER,
  "limiteFuncionarios" INTEGER,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "destaque" BOOLEAN NOT NULL DEFAULT false,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "planos_saas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "planos_saas_slug_key" ON "planos_saas"("slug");
CREATE INDEX "planos_saas_ativo_ordem_idx" ON "planos_saas"("ativo", "ordem");

CREATE TABLE "plano_modulos_saas" (
  "planoId" TEXT NOT NULL,
  "modulo" "ModuloSistema" NOT NULL,
  CONSTRAINT "plano_modulos_saas_pkey" PRIMARY KEY ("planoId", "modulo")
);

CREATE TABLE "assinaturas_saas" (
  "id" TEXT NOT NULL,
  "organizacaoId" TEXT NOT NULL,
  "planoId" TEXT NOT NULL,
  "status" "StatusAssinaturaSaaS" NOT NULL DEFAULT 'TRIAL',
  "ciclo" "CicloAssinaturaSaaS" NOT NULL DEFAULT 'MENSAL',
  "provedor" "ProvedorCobrancaSaaS" NOT NULL DEFAULT 'MANUAL',
  "inicioEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trialFimEm" TIMESTAMP(3),
  "proximaCobrancaEm" TIMESTAMP(3),
  "canceladaEm" TIMESTAMP(3),
  "suspensaEm" TIMESTAMP(3),
  "providerCustomerId" TEXT,
  "providerSubscriptionId" TEXT,
  "observacoesInternas" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assinaturas_saas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "assinaturas_saas_organizacaoId_key" ON "assinaturas_saas"("organizacaoId");
CREATE INDEX "assinaturas_saas_status_idx" ON "assinaturas_saas"("status");
CREATE INDEX "assinaturas_saas_planoId_idx" ON "assinaturas_saas"("planoId");
CREATE INDEX "assinaturas_saas_trialFimEm_idx" ON "assinaturas_saas"("trialFimEm");

CREATE TABLE "faturas_saas" (
  "id" TEXT NOT NULL,
  "assinaturaId" TEXT NOT NULL,
  "organizacaoId" TEXT NOT NULL,
  "planoDestinoId" TEXT,
  "status" "StatusFaturaSaaS" NOT NULL DEFAULT 'PENDENTE',
  "provedor" "ProvedorCobrancaSaaS" NOT NULL DEFAULT 'MANUAL',
  "ciclo" "CicloAssinaturaSaaS" NOT NULL DEFAULT 'MENSAL',
  "descricao" TEXT,
  "valor" DECIMAL(12,2) NOT NULL,
  "vencimento" DATE NOT NULL,
  "pagoEm" TIMESTAMP(3),
  "canceladoEm" TIMESTAMP(3),
  "referenciaExterna" TEXT,
  "checkoutUrl" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "faturas_saas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "faturas_saas_organizacaoId_status_idx" ON "faturas_saas"("organizacaoId", "status");
CREATE INDEX "faturas_saas_assinaturaId_vencimento_idx" ON "faturas_saas"("assinaturaId", "vencimento");
CREATE INDEX "faturas_saas_planoDestinoId_idx" ON "faturas_saas"("planoDestinoId");

CREATE TABLE "eventos_saas" (
  "id" TEXT NOT NULL,
  "assinaturaId" TEXT NOT NULL,
  "usuarioId" TEXT,
  "tipo" TEXT NOT NULL,
  "descricao" TEXT,
  "dados" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "eventos_saas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "eventos_saas_assinaturaId_createdAt_idx" ON "eventos_saas"("assinaturaId", "createdAt");
CREATE INDEX "eventos_saas_usuarioId_idx" ON "eventos_saas"("usuarioId");

ALTER TABLE "plano_modulos_saas" ADD CONSTRAINT "plano_modulos_saas_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "planos_saas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assinaturas_saas" ADD CONSTRAINT "assinaturas_saas_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assinaturas_saas" ADD CONSTRAINT "assinaturas_saas_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "planos_saas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "faturas_saas" ADD CONSTRAINT "faturas_saas_assinaturaId_fkey" FOREIGN KEY ("assinaturaId") REFERENCES "assinaturas_saas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "faturas_saas" ADD CONSTRAINT "faturas_saas_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "faturas_saas" ADD CONSTRAINT "faturas_saas_planoDestinoId_fkey" FOREIGN KEY ("planoDestinoId") REFERENCES "planos_saas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "eventos_saas" ADD CONSTRAINT "eventos_saas_assinaturaId_fkey" FOREIGN KEY ("assinaturaId") REFERENCES "assinaturas_saas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eventos_saas" ADD CONSTRAINT "eventos_saas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Starter plans. IDs are stable so the migration can safely attach existing tenants.
INSERT INTO "planos_saas" ("id", "slug", "nome", "descricao", "precoMensal", "precoAnual", "trialDias", "limiteEmpresas", "limiteUsuarios", "limiteClientes", "limitePets", "limiteFuncionarios", "ativo", "destaque", "ordem", "updatedAt") VALUES
('plano_essencial', 'essencial', 'Essencial', 'Operação básica para pet shops em início de digitalização.', 149.90, 1499.00, 14, 1, 3, 1000, 1500, 5, true, false, 10, CURRENT_TIMESTAMP),
('plano_profissional', 'profissional', 'Profissional', 'Gestão completa para operação em crescimento.', 249.90, 2499.00, 14, 2, 10, 5000, 7500, 20, true, true, 20, CURRENT_TIMESTAMP),
('plano_completo', 'completo', 'Completo', 'Todos os módulos do PetRise e limites ampliados.', 399.90, 3999.00, 14, 5, 30, 20000, 30000, 60, true, false, 30, CURRENT_TIMESTAMP);

INSERT INTO "plano_modulos_saas" ("planoId", "modulo") VALUES
('plano_essencial', 'PDV'), ('plano_essencial', 'ESTOQUE'), ('plano_essencial', 'BANHO_TOSA'), ('plano_essencial', 'PORTAL_CLIENTE'), ('plano_essencial', 'RELATORIOS'),
('plano_profissional', 'PDV'), ('plano_profissional', 'ESTOQUE'), ('plano_profissional', 'CONSULTORIO'), ('plano_profissional', 'BANHO_TOSA'), ('plano_profissional', 'FINANCEIRO'), ('plano_profissional', 'PORTAL_CLIENTE'), ('plano_profissional', 'PONTO'), ('plano_profissional', 'RELATORIOS'),
('plano_completo', 'PDV'), ('plano_completo', 'ESTOQUE'), ('plano_completo', 'CONSULTORIO'), ('plano_completo', 'BANHO_TOSA'), ('plano_completo', 'FINANCEIRO'), ('plano_completo', 'PORTAL_CLIENTE'), ('plano_completo', 'PONTO'), ('plano_completo', 'FISCAL'), ('plano_completo', 'RELATORIOS');

-- Existing organizations are grandfathered into the Complete plan without a trial interruption.
INSERT INTO "assinaturas_saas" ("id", "organizacaoId", "planoId", "status", "ciclo", "provedor", "inicioEm", "proximaCobrancaEm", "createdAt", "updatedAt")
SELECT
  'assinatura_migrada_' || o."id",
  o."id",
  'plano_completo',
  'ATIVA'::"StatusAssinaturaSaaS",
  'MENSAL'::"CicloAssinaturaSaaS",
  'MANUAL'::"ProvedorCobrancaSaaS",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '1 month',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "organizacoes" o
ON CONFLICT ("organizacaoId") DO NOTHING;

-- Existing module choices remain enabled and are considered contracted after migration.
UPDATE "modulos_organizacao" SET "contratado" = true;
