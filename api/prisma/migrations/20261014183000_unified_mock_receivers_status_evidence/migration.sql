-- 20.2.4B.2B.2. Inactive PSP receiver registry and mock status consultation audit.
-- Absolutely no enabling of charges, PSP credentials, payment or invoice processing.
CREATE TABLE "recebedores_psp_unificados" (
 "id" TEXT NOT NULL,
 "empresaId" TEXT NOT NULL,
 "cnpj" TEXT NOT NULL,
 "provedor" TEXT NOT NULL DEFAULT 'SIMULADOR_CI',
 "referenciaExterna" TEXT NOT NULL,
 "ativo" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "recebedores_psp_unificados_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "recebedores_psp_unificados_empresaId_key" ON "recebedores_psp_unificados"("empresaId");
CREATE INDEX "recebedores_psp_unificados_cnpj_idx" ON "recebedores_psp_unificados"("cnpj");
ALTER TABLE "recebedores_psp_unificados" ADD CONSTRAINT "recebedores_psp_unificados_empresaId_fkey"
 FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "evidencias_consulta_psp_simulada" (
 "id" TEXT NOT NULL,
 "intencaoId" TEXT NOT NULL,
 "recebedorId" TEXT NOT NULL,
 "chaveConsulta" TEXT NOT NULL,
 "referenciaTransacao" TEXT NOT NULL,
 "resultado" "ResultadoEventoAutorizacaoSimulada" NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "evidencias_consulta_psp_simulada_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "evidencias_consulta_psp_simulada_chaveConsulta_key" ON "evidencias_consulta_psp_simulada"("chaveConsulta");
CREATE INDEX "evidencias_consulta_psp_simulada_intencaoId_createdAt_idx" ON "evidencias_consulta_psp_simulada"("intencaoId","createdAt");
ALTER TABLE "evidencias_consulta_psp_simulada" ADD CONSTRAINT "evidencias_consulta_psp_simulada_intencaoId_fkey"
 FOREIGN KEY ("intencaoId") REFERENCES "intencoes_autorizacao_unificada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidencias_consulta_psp_simulada" ADD CONSTRAINT "evidencias_consulta_psp_simulada_recebedorId_fkey"
 FOREIGN KEY ("recebedorId") REFERENCES "recebedores_psp_unificados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
