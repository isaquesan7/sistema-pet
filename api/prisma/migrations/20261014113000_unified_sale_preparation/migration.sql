-- Fase 20.2.3: snapshot imutável de preparação, sem vendas/financeiro/fiscal.
CREATE TYPE "StatusPreparacaoExecucaoUnificada" AS ENUM ('PREPARADA', 'INVALIDADA');

CREATE TABLE "preparacoes_execucao_unificada" (
  "id" TEXT NOT NULL,
  "reservaId" TEXT NOT NULL,
  "criadoPorId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "status" "StatusPreparacaoExecucaoUnificada" NOT NULL DEFAULT 'PREPARADA',
  "invalidadaEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "preparacoes_execucao_unificada_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "preparacoes_execucao_unificada_reservaId_key" ON "preparacoes_execucao_unificada"("reservaId");
CREATE INDEX "preparacoes_execucao_unificada_fingerprint_idx" ON "preparacoes_execucao_unificada"("fingerprint");
CREATE INDEX "preparacoes_execucao_unificada_status_idx" ON "preparacoes_execucao_unificada"("status");

ALTER TABLE "preparacoes_execucao_unificada" ADD CONSTRAINT "preparacoes_execucao_unificada_reservaId_fkey"
  FOREIGN KEY ("reservaId") REFERENCES "reservas_fechamento_unificado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "preparacoes_execucao_unificada" ADD CONSTRAINT "preparacoes_execucao_unificada_criadoPorId_fkey"
  FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
