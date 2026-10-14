-- 20.2.4B: durable SANDBOX intent/outbox. No payment rows, gateway or fiscal effects.
CREATE TYPE "StatusIntencaoAutorizacaoUnificada" AS ENUM
 ('PREPARADA_SANDBOX','CONFIRMADA_SIMULADA','RECUSADA_SIMULADA','INDETERMINADA_SIMULADA');
CREATE TYPE "StatusOutboxAutorizacaoUnificada" AS ENUM
 ('PENDENTE','EM_SIMULACAO','CONCLUIDO_SIMULADO','REVISAO_MANUAL');
CREATE TYPE "ResultadoEventoAutorizacaoSimulada" AS ENUM
 ('CONFIRMADA','RECUSADA','INDETERMINADA');

CREATE TABLE "intencoes_autorizacao_unificada" (
 "id" TEXT NOT NULL,
 "operacaoId" TEXT NOT NULL,
 "criadoPorId" TEXT NOT NULL,
 "indice" INTEGER NOT NULL,
 "forma" "FormaPagamento" NOT NULL,
 "valor" DECIMAL(12,2) NOT NULL,
 "sessaoCaixaId" TEXT NOT NULL,
 "chaveIdempotencia" TEXT NOT NULL,
 "status" "StatusIntencaoAutorizacaoUnificada" NOT NULL DEFAULT 'PREPARADA_SANDBOX',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "intencoes_autorizacao_unificada_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "intencoes_autorizacao_unificada_operacaoId_indice_key"
 ON "intencoes_autorizacao_unificada"("operacaoId","indice");
CREATE UNIQUE INDEX "intencoes_autorizacao_unificada_chaveIdempotencia_key"
 ON "intencoes_autorizacao_unificada"("chaveIdempotencia");
CREATE INDEX "intencoes_autorizacao_unificada_status_idx"
 ON "intencoes_autorizacao_unificada"("status");
ALTER TABLE "intencoes_autorizacao_unificada"
 ADD CONSTRAINT "intencoes_autorizacao_unificada_operacaoId_fkey"
 FOREIGN KEY ("operacaoId") REFERENCES "reservas_operacoes_unificadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "intencoes_autorizacao_unificada"
 ADD CONSTRAINT "intencoes_autorizacao_unificada_criadoPorId_fkey"
 FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "outbox_autorizacao_unificada" (
 "id" TEXT NOT NULL,
 "intencaoId" TEXT NOT NULL,
 "status" "StatusOutboxAutorizacaoUnificada" NOT NULL DEFAULT 'PENDENTE',
 "tentativas" INTEGER NOT NULL DEFAULT 0,
 "tokenExecucao" TEXT,
 "ultimaTentativaEm" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "outbox_autorizacao_unificada_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "outbox_autorizacao_unificada_intencaoId_key"
 ON "outbox_autorizacao_unificada"("intencaoId");
CREATE INDEX "outbox_autorizacao_unificada_status_idx"
 ON "outbox_autorizacao_unificada"("status");
ALTER TABLE "outbox_autorizacao_unificada"
 ADD CONSTRAINT "outbox_autorizacao_unificada_intencaoId_fkey"
 FOREIGN KEY ("intencaoId") REFERENCES "intencoes_autorizacao_unificada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "eventos_autorizacao_simulada" (
 "id" TEXT NOT NULL,
 "intencaoId" TEXT NOT NULL,
 "chaveEvento" TEXT NOT NULL,
 "resultado" "ResultadoEventoAutorizacaoSimulada" NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "eventos_autorizacao_simulada_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "eventos_autorizacao_simulada_chaveEvento_key"
 ON "eventos_autorizacao_simulada"("chaveEvento");
CREATE INDEX "eventos_autorizacao_simulada_intencaoId_idx"
 ON "eventos_autorizacao_simulada"("intencaoId");
ALTER TABLE "eventos_autorizacao_simulada"
 ADD CONSTRAINT "eventos_autorizacao_simulada_intencaoId_fkey"
 FOREIGN KEY ("intencaoId") REFERENCES "intencoes_autorizacao_unificada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
