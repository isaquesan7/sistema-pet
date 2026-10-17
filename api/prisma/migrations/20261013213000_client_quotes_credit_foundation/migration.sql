-- PointVet quotes and prepaid client credit: additive only. No existing financial data changed.
CREATE TYPE "StatusOrcamentoCliente" AS ENUM ('RASCUNHO','ENVIADO','APROVADO','REJEITADO','CANCELADO','EXPIRADO');
CREATE TYPE "TipoCreditoClienteMovimento" AS ENUM ('ENTRADA','UTILIZACAO','ESTORNO');
CREATE TABLE "orcamentos_clientes" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "organizacaoId" TEXT NOT NULL REFERENCES "organizacoes"("id") ON DELETE RESTRICT,
 "empresaId" TEXT NOT NULL REFERENCES "empresas"("id") ON DELETE RESTRICT,
 "clienteId" TEXT NOT NULL REFERENCES "clientes"("id") ON DELETE RESTRICT,
 "numero" SERIAL NOT NULL UNIQUE,
 "status" "StatusOrcamentoCliente" NOT NULL DEFAULT 'RASCUNHO',
 "validade" DATE,
 "observacoes" TEXT,
 "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
 "desconto" DECIMAL(12,2) NOT NULL DEFAULT 0,
 "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
 "aprovadoEm" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "orcamentos_clientes_organizacaoId_clienteId_status_idx" ON "orcamentos_clientes"("organizacaoId","clienteId","status");
CREATE INDEX "orcamentos_clientes_empresaId_createdAt_idx" ON "orcamentos_clientes"("empresaId","createdAt");
CREATE TABLE "orcamentos_cliente_itens" (
 "id" TEXT PRIMARY KEY,
 "orcamentoId" TEXT NOT NULL REFERENCES "orcamentos_clientes"("id") ON DELETE CASCADE,
 "petId" TEXT,
 "descricao" TEXT NOT NULL,
 "quantidade" DECIMAL(12,3) NOT NULL,
 "valorUnitario" DECIMAL(12,2) NOT NULL,
 "total" DECIMAL(12,2) NOT NULL
);
CREATE INDEX "orcamentos_cliente_itens_orcamentoId_idx" ON "orcamentos_cliente_itens"("orcamentoId");
CREATE TABLE "creditos_cliente_movimentos" (
 "id" TEXT PRIMARY KEY,
 "organizacaoId" TEXT NOT NULL REFERENCES "organizacoes"("id") ON DELETE RESTRICT,
 "empresaId" TEXT NOT NULL REFERENCES "empresas"("id") ON DELETE RESTRICT,
 "clienteId" TEXT NOT NULL REFERENCES "clientes"("id") ON DELETE RESTRICT,
 "tipo" "TipoCreditoClienteMovimento" NOT NULL,
 "valor" DECIMAL(12,2) NOT NULL CHECK ("valor" > 0),
 "referenciaId" TEXT,
 "motivo" TEXT,
 "idempotencia" TEXT UNIQUE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "creditos_cliente_movimentos_organizacaoId_clienteId_createdAt_idx" ON "creditos_cliente_movimentos"("organizacaoId","clienteId","createdAt");
