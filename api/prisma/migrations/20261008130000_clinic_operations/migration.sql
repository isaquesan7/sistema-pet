-- CreateEnum
CREATE TYPE "StatusAtendimentoClinico" AS ENUM ('AGUARDANDO', 'EM_ATENDIMENTO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusExameClinico" AS ENUM ('SOLICITADO', 'COLETADO', 'EM_PROCESSAMENTO', 'RESULTADO_DISPONIVEL', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoDocumentoClinico" AS ENUM ('RECEITA', 'ATESTADO', 'RELATORIO', 'ORIENTACAO', 'OUTRO');

-- CreateTable
CREATE TABLE "atendimentos_clinicos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "veterinarioId" TEXT,
    "comandaId" TEXT,
    "status" "StatusAtendimentoClinico" NOT NULL DEFAULT 'AGUARDANDO',
    "agendadoPara" TIMESTAMP(3),
    "iniciadoEm" TIMESTAMP(3),
    "finalizadoEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),
    "queixaPrincipal" TEXT,
    "anamnese" TEXT,
    "exameFisico" TEXT,
    "diagnostico" TEXT,
    "conduta" TEXT,
    "observacoesInternas" TEXT,
    "temperatura" DECIMAL(5,2),
    "frequenciaCardiaca" INTEGER,
    "frequenciaRespiratoria" INTEGER,
    "hidratacao" TEXT,
    "mucosas" TEXT,
    "tpcSegundos" DECIMAL(4,1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "atendimentos_clinicos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prescricoes_clinicas" (
    "id" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "veterinarioId" TEXT,
    "orientacoes" TEXT,
    "emitidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "prescricoes_clinicas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prescricao_itens" (
    "id" TEXT NOT NULL,
    "prescricaoId" TEXT NOT NULL,
    "itemCatalogoId" TEXT,
    "medicamento" TEXT NOT NULL,
    "concentracao" TEXT,
    "dose" TEXT,
    "via" TEXT,
    "frequencia" TEXT,
    "duracao" TEXT,
    "quantidade" TEXT,
    "orientacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prescricao_itens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vacinas_aplicacoes" (
    "id" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "itemCatalogoId" TEXT,
    "loteProdutoId" TEXT,
    "nomeVacina" TEXT NOT NULL,
    "fabricante" TEXT,
    "numeroLote" TEXT,
    "dataValidade" DATE,
    "dose" TEXT,
    "via" TEXT,
    "local" TEXT,
    "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proximaDose" DATE,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vacinas_aplicacoes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vermifugacoes_aplicacoes" (
    "id" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "itemCatalogoId" TEXT,
    "loteProdutoId" TEXT,
    "produto" TEXT NOT NULL,
    "principioAtivo" TEXT,
    "dose" TEXT,
    "numeroLote" TEXT,
    "dataValidade" DATE,
    "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proximaDose" DATE,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vermifugacoes_aplicacoes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exames_clinicos" (
    "id" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "itemCatalogoId" TEXT,
    "nome" TEXT NOT NULL,
    "status" "StatusExameClinico" NOT NULL DEFAULT 'SOLICITADO',
    "solicitadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coletadoEm" TIMESTAMP(3),
    "resultadoEm" TIMESTAMP(3),
    "resultadoTexto" TEXT,
    "arquivoUrl" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "exames_clinicos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "procedimentos_clinicos" (
    "id" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "itemCatalogoId" TEXT NOT NULL,
    "comandaItemId" TEXT,
    "quantidade" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "valorUnitario" DECIMAL(12,2) NOT NULL,
    "observacoes" TEXT,
    "realizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "procedimentos_clinicos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "documentos_clinicos" (
    "id" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "tipo" "TipoDocumentoClinico" NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "arquivoUrl" TEXT,
    "visivelCliente" BOOLEAN NOT NULL DEFAULT true,
    "emitidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "documentos_clinicos_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "atendimentos_clinicos_empresaId_status_idx" ON "atendimentos_clinicos"("empresaId", "status");
CREATE INDEX "atendimentos_clinicos_petId_createdAt_idx" ON "atendimentos_clinicos"("petId", "createdAt");
CREATE INDEX "atendimentos_clinicos_clienteId_createdAt_idx" ON "atendimentos_clinicos"("clienteId", "createdAt");
CREATE INDEX "atendimentos_clinicos_veterinarioId_idx" ON "atendimentos_clinicos"("veterinarioId");
CREATE INDEX "atendimentos_clinicos_agendadoPara_idx" ON "atendimentos_clinicos"("agendadoPara");
CREATE INDEX "prescricoes_clinicas_atendimentoId_idx" ON "prescricoes_clinicas"("atendimentoId");
CREATE INDEX "prescricoes_clinicas_veterinarioId_idx" ON "prescricoes_clinicas"("veterinarioId");
CREATE INDEX "prescricao_itens_prescricaoId_idx" ON "prescricao_itens"("prescricaoId");
CREATE INDEX "prescricao_itens_itemCatalogoId_idx" ON "prescricao_itens"("itemCatalogoId");
CREATE INDEX "vacinas_aplicacoes_atendimentoId_idx" ON "vacinas_aplicacoes"("atendimentoId");
CREATE INDEX "vacinas_aplicacoes_petId_aplicadaEm_idx" ON "vacinas_aplicacoes"("petId", "aplicadaEm");
CREATE INDEX "vacinas_aplicacoes_proximaDose_idx" ON "vacinas_aplicacoes"("proximaDose");
CREATE INDEX "vermifugacoes_aplicacoes_atendimentoId_idx" ON "vermifugacoes_aplicacoes"("atendimentoId");
CREATE INDEX "vermifugacoes_aplicacoes_petId_aplicadaEm_idx" ON "vermifugacoes_aplicacoes"("petId", "aplicadaEm");
CREATE INDEX "vermifugacoes_aplicacoes_proximaDose_idx" ON "vermifugacoes_aplicacoes"("proximaDose");
CREATE INDEX "exames_clinicos_atendimentoId_idx" ON "exames_clinicos"("atendimentoId");
CREATE INDEX "exames_clinicos_status_idx" ON "exames_clinicos"("status");
CREATE INDEX "exames_clinicos_solicitadoEm_idx" ON "exames_clinicos"("solicitadoEm");
CREATE UNIQUE INDEX "procedimentos_clinicos_comandaItemId_key" ON "procedimentos_clinicos"("comandaItemId");
CREATE INDEX "procedimentos_clinicos_atendimentoId_idx" ON "procedimentos_clinicos"("atendimentoId");
CREATE INDEX "procedimentos_clinicos_itemCatalogoId_idx" ON "procedimentos_clinicos"("itemCatalogoId");
CREATE INDEX "procedimentos_clinicos_realizadoEm_idx" ON "procedimentos_clinicos"("realizadoEm");
CREATE INDEX "documentos_clinicos_atendimentoId_idx" ON "documentos_clinicos"("atendimentoId");
CREATE INDEX "documentos_clinicos_tipo_idx" ON "documentos_clinicos"("tipo");
CREATE INDEX "documentos_clinicos_emitidoEm_idx" ON "documentos_clinicos"("emitidoEm");

-- Foreign keys
ALTER TABLE "atendimentos_clinicos" ADD CONSTRAINT "atendimentos_clinicos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "atendimentos_clinicos" ADD CONSTRAINT "atendimentos_clinicos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "atendimentos_clinicos" ADD CONSTRAINT "atendimentos_clinicos_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "atendimentos_clinicos" ADD CONSTRAINT "atendimentos_clinicos_veterinarioId_fkey" FOREIGN KEY ("veterinarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "atendimentos_clinicos" ADD CONSTRAINT "atendimentos_clinicos_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "comandas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "prescricoes_clinicas" ADD CONSTRAINT "prescricoes_clinicas_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "atendimentos_clinicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prescricoes_clinicas" ADD CONSTRAINT "prescricoes_clinicas_veterinarioId_fkey" FOREIGN KEY ("veterinarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "prescricao_itens" ADD CONSTRAINT "prescricao_itens_prescricaoId_fkey" FOREIGN KEY ("prescricaoId") REFERENCES "prescricoes_clinicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prescricao_itens" ADD CONSTRAINT "prescricao_itens_itemCatalogoId_fkey" FOREIGN KEY ("itemCatalogoId") REFERENCES "itens_catalogo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vacinas_aplicacoes" ADD CONSTRAINT "vacinas_aplicacoes_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "atendimentos_clinicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vacinas_aplicacoes" ADD CONSTRAINT "vacinas_aplicacoes_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vacinas_aplicacoes" ADD CONSTRAINT "vacinas_aplicacoes_itemCatalogoId_fkey" FOREIGN KEY ("itemCatalogoId") REFERENCES "itens_catalogo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vacinas_aplicacoes" ADD CONSTRAINT "vacinas_aplicacoes_loteProdutoId_fkey" FOREIGN KEY ("loteProdutoId") REFERENCES "lotes_produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vermifugacoes_aplicacoes" ADD CONSTRAINT "vermifugacoes_aplicacoes_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "atendimentos_clinicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vermifugacoes_aplicacoes" ADD CONSTRAINT "vermifugacoes_aplicacoes_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vermifugacoes_aplicacoes" ADD CONSTRAINT "vermifugacoes_aplicacoes_itemCatalogoId_fkey" FOREIGN KEY ("itemCatalogoId") REFERENCES "itens_catalogo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vermifugacoes_aplicacoes" ADD CONSTRAINT "vermifugacoes_aplicacoes_loteProdutoId_fkey" FOREIGN KEY ("loteProdutoId") REFERENCES "lotes_produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exames_clinicos" ADD CONSTRAINT "exames_clinicos_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "atendimentos_clinicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exames_clinicos" ADD CONSTRAINT "exames_clinicos_itemCatalogoId_fkey" FOREIGN KEY ("itemCatalogoId") REFERENCES "itens_catalogo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "procedimentos_clinicos" ADD CONSTRAINT "procedimentos_clinicos_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "atendimentos_clinicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "procedimentos_clinicos" ADD CONSTRAINT "procedimentos_clinicos_itemCatalogoId_fkey" FOREIGN KEY ("itemCatalogoId") REFERENCES "itens_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "procedimentos_clinicos" ADD CONSTRAINT "procedimentos_clinicos_comandaItemId_fkey" FOREIGN KEY ("comandaItemId") REFERENCES "comanda_itens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documentos_clinicos" ADD CONSTRAINT "documentos_clinicos_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "atendimentos_clinicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
