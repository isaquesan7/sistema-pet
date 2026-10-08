-- CreateEnum
CREATE TYPE "StatusEntradaEstoque" AS ENUM ('CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusInventarioEstoque" AS ENUM ('ABERTO', 'CONCLUIDO', 'CANCELADO');

-- CreateTable
CREATE TABLE "entradas_estoque" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "fornecedorId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "numeroDocumento" TEXT,
    "dataEntrada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valorTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "StatusEntradaEstoque" NOT NULL DEFAULT 'CONCLUIDA',
    "observacao" TEXT,
    "canceladaEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "entradas_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entrada_estoque_itens" (
    "id" TEXT NOT NULL,
    "entradaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "loteId" TEXT,
    "quantidade" DECIMAL(14,3) NOT NULL,
    "custoUnitario" DECIMAL(14,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "entrada_estoque_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventarios_estoque" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "status" "StatusInventarioEstoque" NOT NULL DEFAULT 'ABERTO',
    "descricao" TEXT,
    "observacao" TEXT,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventarios_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventario_estoque_itens" (
    "id" TEXT NOT NULL,
    "inventarioId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "loteId" TEXT,
    "saldoSistema" DECIMAL(14,3) NOT NULL,
    "quantidadeContada" DECIMAL(14,3),
    "diferenca" DECIMAL(14,3),
    "movimentacaoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventario_estoque_itens_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "entradas_estoque_empresaId_idx" ON "entradas_estoque"("empresaId");
CREATE INDEX "entradas_estoque_fornecedorId_idx" ON "entradas_estoque"("fornecedorId");
CREATE INDEX "entradas_estoque_dataEntrada_idx" ON "entradas_estoque"("dataEntrada");
CREATE INDEX "entradas_estoque_status_idx" ON "entradas_estoque"("status");
CREATE INDEX "entrada_estoque_itens_entradaId_idx" ON "entrada_estoque_itens"("entradaId");
CREATE INDEX "entrada_estoque_itens_produtoId_idx" ON "entrada_estoque_itens"("produtoId");
CREATE INDEX "entrada_estoque_itens_loteId_idx" ON "entrada_estoque_itens"("loteId");
CREATE INDEX "inventarios_estoque_empresaId_idx" ON "inventarios_estoque"("empresaId");
CREATE INDEX "inventarios_estoque_status_idx" ON "inventarios_estoque"("status");
CREATE INDEX "inventarios_estoque_iniciadoEm_idx" ON "inventarios_estoque"("iniciadoEm");
CREATE INDEX "inventario_estoque_itens_inventarioId_idx" ON "inventario_estoque_itens"("inventarioId");
CREATE INDEX "inventario_estoque_itens_produtoId_idx" ON "inventario_estoque_itens"("produtoId");
CREATE INDEX "inventario_estoque_itens_loteId_idx" ON "inventario_estoque_itens"("loteId");

-- Foreign keys
ALTER TABLE "entradas_estoque" ADD CONSTRAINT "entradas_estoque_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "entradas_estoque" ADD CONSTRAINT "entradas_estoque_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "entradas_estoque" ADD CONSTRAINT "entradas_estoque_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "entrada_estoque_itens" ADD CONSTRAINT "entrada_estoque_itens_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES "entradas_estoque"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entrada_estoque_itens" ADD CONSTRAINT "entrada_estoque_itens_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "entrada_estoque_itens" ADD CONSTRAINT "entrada_estoque_itens_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes_produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventarios_estoque" ADD CONSTRAINT "inventarios_estoque_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventarios_estoque" ADD CONSTRAINT "inventarios_estoque_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventario_estoque_itens" ADD CONSTRAINT "inventario_estoque_itens_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "inventarios_estoque"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventario_estoque_itens" ADD CONSTRAINT "inventario_estoque_itens_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventario_estoque_itens" ADD CONSTRAINT "inventario_estoque_itens_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes_produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
