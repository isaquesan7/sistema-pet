-- PointVet M.3A — preparação ADITIVA do ledger de fechamento manual.
-- Sem execução de vendas, dinheiro, estoque, PSP ou documento fiscal nesta etapa.
-- O vínculo por pagamento impede que uma declaração seja consumida duas vezes.
ALTER TABLE "linhas_recebimento_manual_unificado"
 ADD COLUMN "pagamentoId" TEXT;
CREATE UNIQUE INDEX "linhas_recebimento_manual_unificado_pagamentoId_key"
 ON "linhas_recebimento_manual_unificado"("pagamentoId");
ALTER TABLE "linhas_recebimento_manual_unificado"
 ADD CONSTRAINT "linhas_recebimento_manual_unificado_pagamentoId_fkey"
 FOREIGN KEY ("pagamentoId") REFERENCES "pagamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "StatusParcelaRecebivelManualUnificado"
 AS ENUM ('AGUARDANDO_REPASSE','CONCILIADA','ESTORNADA');
CREATE TABLE "parcelas_recebiveis_manual_unificado" (
 "id" TEXT NOT NULL,
 "linhaId" TEXT NOT NULL,
 "indice" INTEGER NOT NULL,
 "quantidadeTotal" INTEGER NOT NULL,
 "valor" DECIMAL(12,2) NOT NULL,
 "status" "StatusParcelaRecebivelManualUnificado" NOT NULL DEFAULT 'AGUARDANDO_REPASSE',
 "vencimentoEm" DATE,
 "conciliadoEm" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "parcelas_recebiveis_manual_unificado_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "parcelas_recebiveis_manual_unificado_linhaId_indice_key"
 ON "parcelas_recebiveis_manual_unificado"("linhaId","indice");
CREATE INDEX "parcelas_recebiveis_manual_unificado_status_idx"
 ON "parcelas_recebiveis_manual_unificado"("status");
ALTER TABLE "parcelas_recebiveis_manual_unificado"
 ADD CONSTRAINT "parcelas_recebiveis_manual_unificado_linhaId_fkey"
 FOREIGN KEY ("linhaId") REFERENCES "linhas_recebimento_manual_unificado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
