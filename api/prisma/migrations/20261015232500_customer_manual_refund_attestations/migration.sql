-- PointVet M.5.22: operator ATTESTATIONS of external customer refunds.
-- This is not a bank integration, payment or financial cash movement.
-- No migration is applied outside the disposable CI DB without separate approval.
CREATE TABLE "devolucoes_cliente_manual_unificada" (
    "id" TEXT NOT NULL,
    "organizacaoId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "comandaId" TEXT NOT NULL,
    "preparacaoId" TEXT NOT NULL,
    "conciliacaoOrigemId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "referenciaExterna" VARCHAR(120) NOT NULL,
    "valorBruto" DECIMAL(12,2) NOT NULL,
    "motivo" VARCHAR(500) NOT NULL,
    "confirmacaoHumanaExterna" BOOLEAN NOT NULL,
    "codigoRevisao" VARCHAR(64) NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "devolucoes_cliente_manual_unificada_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "devolucoes_cliente_manual_unificada_valor_positivo" CHECK ("valorBruto" > 0),
    CONSTRAINT "devolucoes_cliente_manual_unificada_confirmacao" CHECK ("confirmacaoHumanaExterna" = TRUE)
);
CREATE UNIQUE INDEX "devolucoes_cliente_manual_unificada_fingerprint_key"
 ON "devolucoes_cliente_manual_unificada"("fingerprint");
CREATE UNIQUE INDEX "devolucoes_cliente_manual_unificada_empresaId_referenciaExterna_key"
 ON "devolucoes_cliente_manual_unificada"("empresaId", "referenciaExterna");
CREATE INDEX "devolucoes_cliente_manual_unificada_organizacaoId_empresaId_preparacaoId_idx"
 ON "devolucoes_cliente_manual_unificada"("organizacaoId","empresaId","preparacaoId");
CREATE INDEX "devolucoes_cliente_manual_unificada_empresaId_comandaId_idx"
 ON "devolucoes_cliente_manual_unificada"("empresaId","comandaId");
ALTER TABLE "devolucoes_cliente_manual_unificada"
 ADD CONSTRAINT "devolucoes_cliente_manual_unificada_preparacaoId_fkey"
 FOREIGN KEY ("preparacaoId") REFERENCES "preparacoes_baixa_cartao_manual_unificada"("id")
 ON DELETE RESTRICT ON UPDATE CASCADE;
