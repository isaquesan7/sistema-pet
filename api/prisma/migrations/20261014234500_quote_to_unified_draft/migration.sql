-- PointVet M.4B — additive, CI-only foundation. Do NOT run on production.
-- Exactly one unified draft per approved quote, with durable item-to-catalog links.
CREATE TABLE "conversoes_orcamento_pdv" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "orcamentoId" TEXT NOT NULL,
 "comandaId" TEXT NOT NULL,
 "organizacaoId" TEXT NOT NULL,
 "empresaId" TEXT NOT NULL,
 "clienteId" TEXT NOT NULL,
 "usuarioId" TEXT NOT NULL,
 "fingerprint" TEXT NOT NULL,
 "snapshot" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "conversoes_orcamento_pdv_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "orcamentos_clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "conversoes_orcamento_pdv_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "comandas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "conversoes_orcamento_pdv_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "conversoes_orcamento_pdv_orcamentoId_key" ON "conversoes_orcamento_pdv"("orcamentoId");
CREATE UNIQUE INDEX "conversoes_orcamento_pdv_comandaId_key" ON "conversoes_orcamento_pdv"("comandaId");
CREATE INDEX "conversoes_orcamento_pdv_organizacaoId_empresaId_clienteId_idx" ON "conversoes_orcamento_pdv"("organizacaoId","empresaId","clienteId");
CREATE TABLE "conversoes_orcamento_pdv_itens" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "conversaoId" TEXT NOT NULL,
 "orcamentoItemId" TEXT NOT NULL,
 "itemCatalogoId" TEXT NOT NULL,
 "quantidade" DECIMAL(12,3) NOT NULL,
 "valorUnitario" DECIMAL(12,2) NOT NULL,
 "valorTotal" DECIMAL(12,2) NOT NULL,
 CONSTRAINT "conversoes_orcamento_pdv_itens_conversaoId_fkey" FOREIGN KEY ("conversaoId") REFERENCES "conversoes_orcamento_pdv"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "conversoes_orcamento_pdv_itens_orcamentoItemId_fkey" FOREIGN KEY ("orcamentoItemId") REFERENCES "orcamentos_cliente_itens"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "conversoes_orcamento_pdv_itens_itemCatalogoId_fkey" FOREIGN KEY ("itemCatalogoId") REFERENCES "itens_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "conversoes_orcamento_pdv_itens_orcamentoItemId_key" ON "conversoes_orcamento_pdv_itens"("orcamentoItemId");
CREATE INDEX "conversoes_orcamento_pdv_itens_conversaoId_idx" ON "conversoes_orcamento_pdv_itens"("conversaoId");
CREATE INDEX "conversoes_orcamento_pdv_itens_itemCatalogoId_idx" ON "conversoes_orcamento_pdv_itens"("itemCatalogoId");
