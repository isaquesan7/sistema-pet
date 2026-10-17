-- M.5.11 — second-operator documentary review, not bank verification.
-- Additive, CI-only before independent real-staging approval.
CREATE TABLE "pareceres_pre_baixa_cartao_manual_unificada" (
  "id" TEXT NOT NULL,
  "preparacaoId" TEXT NOT NULL,
  "organizacaoId" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "conferenteId" TEXT NOT NULL,
  "evidenciaReferencia" VARCHAR(120) NOT NULL,
  "evidenciaSha256" VARCHAR(64) NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'CONFERENCIA_DOCUMENTAL_DECLARADA',
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pareceres_pre_baixa_cartao_manual_unificada_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pareceres_pre_baixa_cartao_manual_unificada_status_check" CHECK
    ("status" = 'CONFERENCIA_DOCUMENTAL_DECLARADA'),
  CONSTRAINT "pareceres_pre_baixa_cartao_manual_unificada_sha_check" CHECK
    ("evidenciaSha256" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "pareceres_pre_baixa_cartao_manual_unificada_preparacaoId_key"
 ON "pareceres_pre_baixa_cartao_manual_unificada"("preparacaoId");
CREATE UNIQUE INDEX "pareceres_pre_baixa_cartao_manual_unificada_fingerprint_key"
 ON "pareceres_pre_baixa_cartao_manual_unificada"("fingerprint");
CREATE INDEX "pareceres_pre_baixa_cartao_manual_unificada_organizacaoId_empresaId_createdAt_idx"
 ON "pareceres_pre_baixa_cartao_manual_unificada"("organizacaoId","empresaId","createdAt");
ALTER TABLE "pareceres_pre_baixa_cartao_manual_unificada"
 ADD CONSTRAINT "pareceres_pre_baixa_cartao_manual_unificada_preparacaoId_fkey"
 FOREIGN KEY ("preparacaoId") REFERENCES "preparacoes_baixa_cartao_manual_unificada"("id")
 ON DELETE RESTRICT ON UPDATE CASCADE;
