-- PointVet M.5.28. Disposable CI data ONLY; no real external evidence.
-- Applying schema in production requires a separate explicitly approved gate.
CREATE TABLE "pareceres_devolucao_externa_ci" (
    "id" TEXT NOT NULL,
    "devolucaoId" TEXT NOT NULL,
    "organizacaoId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "comandaId" TEXT NOT NULL,
    "conferenteId" TEXT NOT NULL,
    "evidenciaReferencia" VARCHAR(120) NOT NULL,
    "evidenciaSha256" VARCHAR(64) NOT NULL,
    "codigoDossie" VARCHAR(64) NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'CONFERENCIA_DOCUMENTAL_DECLARADA_CI',
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pareceres_devolucao_externa_ci_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pareceres_devolucao_externa_ci_status_check"
      CHECK ("status" = 'CONFERENCIA_DOCUMENTAL_DECLARADA_CI'),
    CONSTRAINT "pareceres_devolucao_externa_ci_sha_check"
      CHECK ("evidenciaSha256" ~ '^[0-9a-f]{64}$' AND "codigoDossie" ~ '^[0-9a-f]{64}$'
       AND "fingerprint" ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX "pareceres_devolucao_externa_ci_devolucaoId_key"
 ON "pareceres_devolucao_externa_ci"("devolucaoId");
CREATE UNIQUE INDEX "pareceres_devolucao_externa_ci_fingerprint_key"
 ON "pareceres_devolucao_externa_ci"("fingerprint");
CREATE INDEX "pareceres_devolucao_externa_ci_organizacaoId_empresaId_comandaId_idx"
 ON "pareceres_devolucao_externa_ci"("organizacaoId","empresaId","comandaId");
ALTER TABLE "pareceres_devolucao_externa_ci"
 ADD CONSTRAINT "pareceres_devolucao_externa_ci_devolucaoId_fkey"
 FOREIGN KEY ("devolucaoId") REFERENCES "devolucoes_cliente_manual_unificada"("id")
 ON DELETE RESTRICT ON UPDATE CASCADE;
