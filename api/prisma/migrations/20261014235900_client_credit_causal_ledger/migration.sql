-- PointVet M.4B.2: optional causal fields, backward-compatible, isolated CI migration.
-- New credits MUST reference a verified reconciliation and causal reversals.
ALTER TABLE "creditos_cliente_movimentos"
 ADD COLUMN "solicitacaoFingerprint" TEXT,
 ADD COLUMN "conciliacaoId" TEXT,
 ADD COLUMN "reverteMovimentoId" TEXT,
 ADD COLUMN "responsavelId" TEXT,
 ADD COLUMN "evidencia" JSONB;
CREATE UNIQUE INDEX "creditos_cliente_movimentos_conciliacaoId_key"
 ON "creditos_cliente_movimentos"("conciliacaoId");
CREATE UNIQUE INDEX "creditos_cliente_movimentos_reverteMovimentoId_key"
 ON "creditos_cliente_movimentos"("reverteMovimentoId");
ALTER TABLE "creditos_cliente_movimentos" ADD CONSTRAINT "creditos_cliente_movimentos_conciliacaoId_fkey"
 FOREIGN KEY ("conciliacaoId") REFERENCES "conciliacoes_financeiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "creditos_cliente_movimentos" ADD CONSTRAINT "creditos_cliente_movimentos_reverteMovimentoId_fkey"
 FOREIGN KEY ("reverteMovimentoId") REFERENCES "creditos_cliente_movimentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "creditos_cliente_movimentos" ADD CONSTRAINT "creditos_cliente_movimentos_responsavelId_fkey"
 FOREIGN KEY ("responsavelId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
