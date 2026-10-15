-- M.4D.2: chained audit integrity ONLY for disposable fiscal CI simulations.
-- No backfill of old CI events: missing hashes are read as untrusted.
ALTER TABLE "fluxos_fiscais_unificados_ci"
 ADD COLUMN "integridadeRaiz" TEXT,
 ADD COLUMN "integridadeCabeca" TEXT,
 ADD COLUMN "integridadeContador" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "eventos_fluxo_fiscal_unificado_ci"
 ADD COLUMN "sequencia" INTEGER,
 ADD COLUMN "hashAnterior" TEXT,
 ADD COLUMN "hashEvento" TEXT;
CREATE UNIQUE INDEX "eventos_fluxo_fiscal_unificado_ci_fluxoId_sequencia_key"
 ON "eventos_fluxo_fiscal_unificado_ci"("fluxoId","sequencia");
ALTER TABLE "fluxos_fiscais_unificados_ci"
 ADD CONSTRAINT "fluxos_fiscais_ci_contador_nao_negativo" CHECK ("integridadeContador">=0);
ALTER TABLE "eventos_fluxo_fiscal_unificado_ci"
 ADD CONSTRAINT "eventos_fiscais_ci_sequencia_positiva"
 CHECK ("sequencia" IS NULL OR "sequencia">0);
