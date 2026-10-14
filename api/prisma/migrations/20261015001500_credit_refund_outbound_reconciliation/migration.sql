-- M.4B.3 — outbound accounting reconciliation for returned customer prepayment.
-- Additive and optional for legacy rows; legacy return WITHOUT proof fails closed.
-- CI only. DO NOT apply to the Pet King production database.
ALTER TABLE "creditos_cliente_movimentos"
 ADD COLUMN "devolucaoConciliacaoId" TEXT;
CREATE UNIQUE INDEX "creditos_cliente_movimentos_devolucaoConciliacaoId_key"
 ON "creditos_cliente_movimentos"("devolucaoConciliacaoId");
ALTER TABLE "creditos_cliente_movimentos"
 ADD CONSTRAINT "creditos_cliente_movimentos_devolucaoConciliacaoId_fkey"
 FOREIGN KEY ("devolucaoConciliacaoId") REFERENCES "conciliacoes_financeiras"("id")
 ON DELETE RESTRICT ON UPDATE CASCADE;
