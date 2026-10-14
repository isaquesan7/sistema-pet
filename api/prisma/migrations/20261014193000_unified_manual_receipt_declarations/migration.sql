-- M.2: auditable manual receipt DECLARATIONS, not actual payments or cash ledger.
-- No automatic gateway access, payment capture, stock or fiscal side effects.
CREATE TYPE "StatusRegistroRecebimentoManualUnificado" AS ENUM ('REGISTRADO');

CREATE TABLE "registros_recebimento_manual_unificado" (
 "id" TEXT NOT NULL,
 "reservaId" TEXT NOT NULL,
 "criadoPorId" TEXT NOT NULL,
 "fingerprint" TEXT NOT NULL,
 "status" "StatusRegistroRecebimentoManualUnificado" NOT NULL DEFAULT 'REGISTRADO',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "registros_recebimento_manual_unificado_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "registros_recebimento_manual_unificado_reservaId_key"
 ON "registros_recebimento_manual_unificado"("reservaId");
CREATE INDEX "registros_recebimento_manual_unificado_createdAt_idx"
 ON "registros_recebimento_manual_unificado"("createdAt");
ALTER TABLE "registros_recebimento_manual_unificado" ADD CONSTRAINT "registros_recebimento_manual_unificado_reservaId_fkey"
 FOREIGN KEY ("reservaId") REFERENCES "reservas_fechamento_unificado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registros_recebimento_manual_unificado" ADD CONSTRAINT "registros_recebimento_manual_unificado_criadoPorId_fkey"
 FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "linhas_recebimento_manual_unificado" (
 "id" TEXT NOT NULL,
 "registroId" TEXT NOT NULL,
 "operacaoId" TEXT NOT NULL,
 "indice" INTEGER NOT NULL,
 "sessaoCaixaId" TEXT NOT NULL,
 "forma" "FormaPagamento" NOT NULL,
 "valor" DECIMAL(12,2) NOT NULL,
 "parcelas" INTEGER NOT NULL DEFAULT 1,
 "referencia" VARCHAR(120),
 "confirmadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "linhas_recebimento_manual_unificado_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "linhas_recebimento_manual_unificado_operacaoId_indice_key"
 ON "linhas_recebimento_manual_unificado"("operacaoId","indice");
CREATE INDEX "linhas_recebimento_manual_unificado_registroId_idx"
 ON "linhas_recebimento_manual_unificado"("registroId");
CREATE INDEX "linhas_recebimento_manual_unificado_sessaoCaixaId_idx"
 ON "linhas_recebimento_manual_unificado"("sessaoCaixaId");

ALTER TABLE "linhas_recebimento_manual_unificado" ADD CONSTRAINT "linhas_recebimento_manual_unificado_registroId_fkey"
 FOREIGN KEY ("registroId") REFERENCES "registros_recebimento_manual_unificado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "linhas_recebimento_manual_unificado" ADD CONSTRAINT "linhas_recebimento_manual_unificado_operacaoId_fkey"
 FOREIGN KEY ("operacaoId") REFERENCES "reservas_operacoes_unificadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "linhas_recebimento_manual_unificado" ADD CONSTRAINT "linhas_recebimento_manual_unificado_sessaoCaixaId_fkey"
 FOREIGN KEY ("sessaoCaixaId") REFERENCES "sessoes_caixa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
