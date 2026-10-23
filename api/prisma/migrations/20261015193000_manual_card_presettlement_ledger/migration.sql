-- M.5.10 PointVet: durable pre-baixa ledger (NOT a financial settlement).
-- Only executed on disposable CI PostgreSQL while PR #36 stays DRAFT.
-- Nothing here credits accounts, creates fiscal docs or approves payments.
CREATE TABLE "preparacoes_baixa_cartao_manual_unificada" (
 "id" TEXT NOT NULL,
 "organizacaoId" TEXT NOT NULL,
 "empresaId" TEXT NOT NULL,
 "comandaId" TEXT NOT NULL,
 "usuarioId" TEXT NOT NULL,
 "contaFinanceiraId" TEXT NOT NULL,
 "referenciaExtrato" VARCHAR(120) NOT NULL,
 "fingerprint" TEXT NOT NULL,
 "tipo" VARCHAR(24) NOT NULL,
 "dataCredito" DATE NOT NULL,
 "bruto" DECIMAL(12,2) NOT NULL,
 "tarifaCartao" DECIMAL(12,2) NOT NULL,
 "descontoAntecipacao" DECIMAL(12,2) NOT NULL,
 "liquidoDeclarado" DECIMAL(12,2) NOT NULL,
 "status" VARCHAR(32) NOT NULL DEFAULT 'PREPARADA_SEM_BAIXA',
 "snapshot" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "preparacoes_baixa_cartao_manual_unificada_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "preparacoes_baixa_cartao_manual_unificada_status_check" CHECK ("status" = 'PREPARADA_SEM_BAIXA'),
 CONSTRAINT "preparacoes_baixa_cartao_manual_unificada_valores_check" CHECK (
  "bruto" > 0 AND "tarifaCartao" >= 0 AND "descontoAntecipacao" >= 0 AND
  "liquidoDeclarado" > 0 AND
  "bruto" = "tarifaCartao" + "descontoAntecipacao" + "liquidoDeclarado"
 )
);
CREATE UNIQUE INDEX "preparacoes_baixa_cartao_manual_unificada_fingerprint_key"
 ON "preparacoes_baixa_cartao_manual_unificada"("fingerprint");
CREATE UNIQUE INDEX "preparacoes_baixa_cartao_manual_unificada_empresaId_referenciaExtrato_key"
 ON "preparacoes_baixa_cartao_manual_unificada"("empresaId","referenciaExtrato");
CREATE INDEX "preparacoes_baixa_cartao_manual_unificada_organizacaoId_empresaId_comandaId_idx"
 ON "preparacoes_baixa_cartao_manual_unificada"("organizacaoId","empresaId","comandaId");

CREATE TABLE "parcelas_pre_baixa_cartao_manual_unificada" (
 "id" TEXT NOT NULL,
 "preparacaoId" TEXT NOT NULL,
 "parcelaId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "parcelas_pre_baixa_cartao_manual_unificada_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "parcelas_pre_baixa_cartao_manual_unificada_parcelaId_key"
 ON "parcelas_pre_baixa_cartao_manual_unificada"("parcelaId");
CREATE UNIQUE INDEX "parcelas_pre_baixa_cartao_manual_unificada_preparacaoId_parcelaId_key"
 ON "parcelas_pre_baixa_cartao_manual_unificada"("preparacaoId","parcelaId");
ALTER TABLE "parcelas_pre_baixa_cartao_manual_unificada"
 ADD CONSTRAINT "parcelas_pre_baixa_cartao_manual_unificada_preparacaoId_fkey"
 FOREIGN KEY ("preparacaoId") REFERENCES "preparacoes_baixa_cartao_manual_unificada"("id")
 ON DELETE RESTRICT ON UPDATE CASCADE;
