-- M.4D.1 — disposable PostgreSQL CI-only fiscal protocol state / simulated events.
-- No changes to DocumentoFiscal or existing fiscal providers. DO NOT DEPLOY.
CREATE UNIQUE INDEX "vendas_empresaId_id_key" ON "vendas"("empresaId","id");

CREATE TABLE "fluxos_fiscais_unificados_ci" (
 "id" TEXT NOT NULL,
 "organizacaoId" TEXT NOT NULL,
 "empresaId" TEXT NOT NULL,
 "vendaId" TEXT NOT NULL,
 "criadoPorId" TEXT NOT NULL,
 "classe" VARCHAR(12) NOT NULL,
 "tipoDocumento" VARCHAR(6) NOT NULL,
 "estado" VARCHAR(40) NOT NULL DEFAULT 'PREPARADA_CI',
 "pedidoFingerprint" TEXT NOT NULL,
 "snapshotFingerprint" TEXT NOT NULL,
 "snapshot" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "fluxos_fiscais_unificados_ci_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "fluxos_fiscais_unificados_ci_organizacaoId_fkey"
  FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "fluxos_fiscais_unificados_ci_empresaId_fkey"
  FOREIGN KEY ("organizacaoId","empresaId") REFERENCES "empresas"("organizacaoId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "fluxos_fiscais_unificados_ci_vendaId_fkey"
  FOREIGN KEY ("empresaId","vendaId") REFERENCES "vendas"("empresaId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "fluxos_fiscais_unificados_ci_criadoPorId_fkey"
  FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "fluxos_fiscais_unificados_ci_estado_check" CHECK (
  "estado" IN (
   'PREPARADA_CI','INDETERMINADA_CI','REJEITADA_CI',
   'ACEITA_SIMULADA_CI','CANCELADA_SIMULADA_CI','CONTINGENCIA_REVISAO_CI'
  )
 ),
 CONSTRAINT "fluxos_fiscais_unificados_ci_tipo_check" CHECK ("tipoDocumento" IN ('NFE','NFCE','NFSE')),
 CONSTRAINT "fluxos_fiscais_unificados_ci_classe_check" CHECK ("classe" IN ('PRODUTO','SERVICO'))
);
CREATE UNIQUE INDEX "fluxos_fiscais_unificados_ci_vendaId_classe_key"
 ON "fluxos_fiscais_unificados_ci"("vendaId","classe");
CREATE UNIQUE INDEX "fluxos_fiscais_unificados_ci_pedidoFingerprint_key"
 ON "fluxos_fiscais_unificados_ci"("pedidoFingerprint");
CREATE INDEX "fluxos_fiscais_unificados_ci_organizacaoId_empresaId_estado_idx"
 ON "fluxos_fiscais_unificados_ci"("organizacaoId","empresaId","estado");

CREATE TABLE "eventos_fluxo_fiscal_unificado_ci" (
 "id" TEXT NOT NULL,
 "fluxoId" TEXT NOT NULL,
 "usuarioId" TEXT NOT NULL,
 "chaveEvento" VARCHAR(120) NOT NULL,
 "eventoFingerprint" TEXT NOT NULL,
 "tipo" VARCHAR(50) NOT NULL,
 "estadoAnterior" VARCHAR(40) NOT NULL,
 "estadoPosterior" VARCHAR(40) NOT NULL,
 "evidencia" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "eventos_fluxo_fiscal_unificado_ci_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "eventos_fluxo_fiscal_unificado_ci_fluxoId_fkey"
  FOREIGN KEY ("fluxoId") REFERENCES "fluxos_fiscais_unificados_ci"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "eventos_fluxo_fiscal_unificado_ci_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "eventos_fluxo_fiscal_unificado_ci_fluxoId_chaveEvento_key"
 ON "eventos_fluxo_fiscal_unificado_ci"("fluxoId","chaveEvento");
CREATE INDEX "eventos_fluxo_fiscal_unificado_ci_fluxoId_createdAt_idx"
 ON "eventos_fluxo_fiscal_unificado_ci"("fluxoId","createdAt");
