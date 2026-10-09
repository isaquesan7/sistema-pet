-- PETRISE PHASE 13 — FISCAL OPERATIONS
-- Operationalizes the existing fiscal foundation without coupling the platform
-- to a specific tax document provider.

ALTER TABLE "configuracoes_fiscais_empresas"
  ADD COLUMN "provedorContaReferencia" TEXT,
  ADD COLUMN "tipoDocumentoPadrao" "TipoDocumentoFiscal",
  ADD COLUMN "emissaoAutomaticaVenda" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "naturezaOperacaoPadrao" TEXT,
  ADD COLUMN "codigoMunicipioIbge" TEXT;

ALTER TABLE "documentos_fiscais"
  ADD COLUMN "usuarioId" TEXT,
  ADD COLUMN "ambiente" "AmbienteFiscal" NOT NULL DEFAULT 'HOMOLOGACAO',
  ADD COLUMN "simulado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "provedorReferencia" TEXT,
  ADD COLUMN "destinatarioSnapshot" JSONB,
  ADD COLUMN "itensSnapshot" JSONB,
  ADD COLUMN "pagamentosSnapshot" JSONB,
  ADD COLUMN "payloadEnvio" JSONB,
  ADD COLUMN "respostaProvedor" JSONB,
  ADD COLUMN "tentativas" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ultimaTentativaEm" TIMESTAMP(3),
  ADD COLUMN "motivoCancelamento" TEXT,
  ADD COLUMN "cancelamentoProtocolo" TEXT;

CREATE INDEX "documentos_fiscais_provedorReferencia_idx" ON "documentos_fiscais"("provedorReferencia");
