-- PetRise 16.0 — Segurança, LGPD e Arquivos

CREATE TYPE "TipoArquivoPetRise" AS ENUM ('LOGO', 'FOTO_PET', 'BANHO_TOSA', 'CLINICO', 'DOCUMENTO', 'EXPORTACAO_LGPD', 'OUTRO');
CREATE TYPE "StatusArquivoPetRise" AS ENUM ('PENDENTE', 'ATIVO', 'EXCLUIDO');
CREATE TYPE "TipoSolicitacaoLGPD" AS ENUM ('EXPORTACAO', 'ANONIMIZACAO');
CREATE TYPE "StatusSolicitacaoLGPD" AS ENUM ('PENDENTE', 'PROCESSANDO', 'CONCLUIDA', 'REJEITADA', 'ERRO');

ALTER TABLE "configuracoes_organizacao"
  ADD COLUMN "lgpdContatoEmail" TEXT,
  ADD COLUMN "retencaoAuditoriaDias" INTEGER NOT NULL DEFAULT 3650,
  ADD COLUMN "retencaoArquivosExcluidosDias" INTEGER NOT NULL DEFAULT 30;

CREATE TABLE "arquivos_petrise" (
  "id" TEXT NOT NULL,
  "organizacaoId" TEXT NOT NULL,
  "empresaId" TEXT,
  "criadoPorUsuarioId" TEXT,
  "clienteId" TEXT,
  "petId" TEXT,
  "tipo" "TipoArquivoPetRise" NOT NULL,
  "status" "StatusArquivoPetRise" NOT NULL DEFAULT 'PENDENTE',
  "chave" TEXT NOT NULL,
  "nomeOriginal" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "tamanhoBytes" BIGINT,
  "privado" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "confirmadoEm" TIMESTAMP(3),
  "excluidoEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "arquivos_petrise_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "solicitacoes_lgpd" (
  "id" TEXT NOT NULL,
  "organizacaoId" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "solicitadoPorUsuarioId" TEXT,
  "exportArquivoId" TEXT,
  "tipo" "TipoSolicitacaoLGPD" NOT NULL,
  "status" "StatusSolicitacaoLGPD" NOT NULL DEFAULT 'PENDENTE',
  "motivo" TEXT,
  "observacoes" TEXT,
  "resultado" JSONB,
  "erro" TEXT,
  "processadoEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "solicitacoes_lgpd_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "arquivos_petrise_chave_key" ON "arquivos_petrise"("chave");
CREATE INDEX "arquivos_petrise_organizacaoId_status_createdAt_idx" ON "arquivos_petrise"("organizacaoId", "status", "createdAt");
CREATE INDEX "arquivos_petrise_empresaId_createdAt_idx" ON "arquivos_petrise"("empresaId", "createdAt");
CREATE INDEX "arquivos_petrise_clienteId_createdAt_idx" ON "arquivos_petrise"("clienteId", "createdAt");
CREATE INDEX "arquivos_petrise_petId_createdAt_idx" ON "arquivos_petrise"("petId", "createdAt");
CREATE INDEX "arquivos_petrise_tipo_idx" ON "arquivos_petrise"("tipo");
CREATE INDEX "solicitacoes_lgpd_organizacaoId_status_createdAt_idx" ON "solicitacoes_lgpd"("organizacaoId", "status", "createdAt");
CREATE INDEX "solicitacoes_lgpd_clienteId_createdAt_idx" ON "solicitacoes_lgpd"("clienteId", "createdAt");
CREATE INDEX "solicitacoes_lgpd_tipo_idx" ON "solicitacoes_lgpd"("tipo");

ALTER TABLE "arquivos_petrise" ADD CONSTRAINT "arquivos_petrise_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arquivos_petrise" ADD CONSTRAINT "arquivos_petrise_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "arquivos_petrise" ADD CONSTRAINT "arquivos_petrise_criadoPorUsuarioId_fkey" FOREIGN KEY ("criadoPorUsuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "arquivos_petrise" ADD CONSTRAINT "arquivos_petrise_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "arquivos_petrise" ADD CONSTRAINT "arquivos_petrise_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "solicitacoes_lgpd" ADD CONSTRAINT "solicitacoes_lgpd_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "solicitacoes_lgpd" ADD CONSTRAINT "solicitacoes_lgpd_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitacoes_lgpd" ADD CONSTRAINT "solicitacoes_lgpd_solicitadoPorUsuarioId_fkey" FOREIGN KEY ("solicitadoPorUsuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "solicitacoes_lgpd" ADD CONSTRAINT "solicitacoes_lgpd_exportArquivoId_fkey" FOREIGN KEY ("exportArquivoId") REFERENCES "arquivos_petrise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
