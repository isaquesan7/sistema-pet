-- Fase 20.2: reservations only. Never creates sales, payments, stock or invoices.
CREATE TYPE "StatusReservaFechamentoUnificado" AS ENUM ('RESERVADA', 'CANCELADA');
CREATE TYPE "StatusReservaOperacaoUnificada" AS ENUM ('RESERVADA', 'CANCELADA', 'CONCLUIDA');

CREATE TABLE "reservas_fechamento_unificado" (
  "id" TEXT NOT NULL,
  "comandaId" TEXT NOT NULL,
  "versaoRascunho" INTEGER NOT NULL,
  "valorTotal" DECIMAL(12,2) NOT NULL,
  "status" "StatusReservaFechamentoUnificado" NOT NULL DEFAULT 'RESERVADA',
  "canceladaEm" TIMESTAMP(3),
  "motivoCancelamento" TEXT,
  "criadoPorId" TEXT NOT NULL,
  "canceladoPorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reservas_fechamento_unificado_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reservas_fechamento_unificado_comandaId_versaoRascunho_key" ON "reservas_fechamento_unificado"("comandaId", "versaoRascunho");
CREATE INDEX "reservas_fechamento_unificado_status_idx" ON "reservas_fechamento_unificado"("status");
ALTER TABLE "reservas_fechamento_unificado" ADD CONSTRAINT "reservas_fechamento_unificado_comandaId_fkey"
 FOREIGN KEY ("comandaId") REFERENCES "comandas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reservas_fechamento_unificado" ADD CONSTRAINT "reservas_fechamento_unificado_criadoPorId_fkey"
 FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservas_fechamento_unificado" ADD CONSTRAINT "reservas_fechamento_unificado_canceladoPorId_fkey"
 FOREIGN KEY ("canceladoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "reservas_operacoes_unificadas" (
  "id" TEXT NOT NULL,
  "reservaId" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "valorTotal" DECIMAL(12,2) NOT NULL,
  "status" "StatusReservaOperacaoUnificada" NOT NULL DEFAULT 'RESERVADA',
  "vendaId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reservas_operacoes_unificadas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reservas_operacoes_unificadas_chaveIdempotencia_key" ON "reservas_operacoes_unificadas"("chaveIdempotencia");
CREATE UNIQUE INDEX "reservas_operacoes_unificadas_vendaId_key" ON "reservas_operacoes_unificadas"("vendaId");
CREATE UNIQUE INDEX "reservas_operacoes_unificadas_reservaId_empresaId_key" ON "reservas_operacoes_unificadas"("reservaId","empresaId");
CREATE INDEX "reservas_operacoes_unificadas_empresaId_status_idx" ON "reservas_operacoes_unificadas"("empresaId","status");
ALTER TABLE "reservas_operacoes_unificadas" ADD CONSTRAINT "reservas_operacoes_unificadas_reservaId_fkey"
 FOREIGN KEY ("reservaId") REFERENCES "reservas_fechamento_unificado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservas_operacoes_unificadas" ADD CONSTRAINT "reservas_operacoes_unificadas_empresaId_fkey"
 FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservas_operacoes_unificadas" ADD CONSTRAINT "reservas_operacoes_unificadas_vendaId_fkey"
 FOREIGN KEY ("vendaId") REFERENCES "vendas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
