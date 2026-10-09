-- Phase 11 — Financeiro: contas a pagar/receber, fiado, conciliação e relatórios

CREATE TYPE "TipoCategoriaFinanceira" AS ENUM ('RECEITA','DESPESA','AMBOS');
CREATE TYPE "TipoContaFinanceira" AS ENUM ('DINHEIRO','BANCO','CARTEIRA_DIGITAL','OUTRO');
CREATE TYPE "TipoTituloFinanceiro" AS ENUM ('RECEBER','PAGAR');
CREATE TYPE "StatusTituloFinanceiro" AS ENUM ('PENDENTE','PARCIAL','PAGO','CANCELADO');
CREATE TYPE "OrigemTituloFinanceiro" AS ENUM ('MANUAL','VENDA_FIADO','ENTRADA_ESTOQUE','OUTRO');
CREATE TYPE "OrigemConciliacaoFinanceira" AS ENUM ('PAGAMENTO_VENDA','BAIXA_TITULO','TRANSACAO_ONLINE');
CREATE TYPE "DirecaoFinanceira" AS ENUM ('ENTRADA','SAIDA');

CREATE TABLE "categorias_financeiras" (
  "id" TEXT NOT NULL,
  "organizacaoId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "tipo" "TipoCategoriaFinanceira" NOT NULL DEFAULT 'AMBOS',
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "categorias_financeiras_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contas_financeiras" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "tipo" "TipoContaFinanceira" NOT NULL DEFAULT 'BANCO',
  "saldoInicial" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contas_financeiras_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "titulos_financeiros" (
  "id" TEXT NOT NULL,
  "organizacaoId" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "tipo" "TipoTituloFinanceiro" NOT NULL,
  "status" "StatusTituloFinanceiro" NOT NULL DEFAULT 'PENDENTE',
  "origem" "OrigemTituloFinanceiro" NOT NULL DEFAULT 'MANUAL',
  "categoriaId" TEXT,
  "clienteId" TEXT,
  "fornecedorId" TEXT,
  "vendaId" TEXT,
  "pagamentoId" TEXT,
  "entradaEstoqueId" TEXT,
  "descricao" TEXT NOT NULL,
  "documento" TEXT,
  "parcelaAtual" INTEGER NOT NULL DEFAULT 1,
  "totalParcelas" INTEGER NOT NULL DEFAULT 1,
  "competencia" DATE,
  "emissaoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "vencimentoEm" DATE,
  "valorOriginal" DECIMAL(14,2) NOT NULL,
  "valorPago" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "observacoes" TEXT,
  "canceladoEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "titulos_financeiros_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "baixas_financeiras" (
  "id" TEXT NOT NULL,
  "tituloId" TEXT NOT NULL,
  "contaFinanceiraId" TEXT,
  "sessaoCaixaId" TEXT,
  "usuarioId" TEXT NOT NULL,
  "forma" "FormaPagamento",
  "valor" DECIMAL(14,2) NOT NULL,
  "desconto" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "juros" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "pagoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "baixas_financeiras_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conciliacoes_financeiras" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "contaFinanceiraId" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "origem" "OrigemConciliacaoFinanceira" NOT NULL,
  "origemId" TEXT NOT NULL,
  "direcao" "DirecaoFinanceira" NOT NULL,
  "valor" DECIMAL(14,2) NOT NULL,
  "dataMovimento" TIMESTAMP(3) NOT NULL,
  "descricao" TEXT,
  "conciliadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conciliacoes_financeiras_pkey" PRIMARY KEY ("id")
);

-- Backfill de fiados criados nas fases anteriores ao módulo Financeiro.
-- O ID textual é determinístico e válido para o Prisma; novos registros continuam usando cuid().
INSERT INTO "titulos_financeiros" (
  "id","organizacaoId","empresaId","tipo","status","origem","clienteId","vendaId","pagamentoId",
  "descricao","parcelaAtual","totalParcelas","emissaoEm","vencimentoEm","valorOriginal","valorPago","createdAt","updatedAt"
)
SELECT
  'fiado_' || p."id", e."organizacaoId", v."empresaId", 'RECEBER'::"TipoTituloFinanceiro",
  'PENDENTE'::"StatusTituloFinanceiro", 'VENDA_FIADO'::"OrigemTituloFinanceiro", v."clienteId", v."id", p."id",
  'Venda #' || v."numero" || ' · Fiado', 1, 1, COALESCE(v."finalizadaEm", p."createdAt"),
  (COALESCE(v."finalizadaEm", p."createdAt")::date + INTERVAL '30 day')::date, p."valor", 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "pagamentos" p
JOIN "vendas" v ON v."id" = p."vendaId"
JOIN "empresas" e ON e."id" = v."empresaId"
WHERE p."forma" = 'CREDITO_CLIENTE'
  AND p."status" = 'PENDENTE'
  AND v."clienteId" IS NOT NULL;

CREATE UNIQUE INDEX "categorias_financeiras_organizacaoId_nome_tipo_key" ON "categorias_financeiras"("organizacaoId","nome","tipo");
CREATE INDEX "categorias_financeiras_organizacaoId_ativo_idx" ON "categorias_financeiras"("organizacaoId","ativo");
CREATE UNIQUE INDEX "contas_financeiras_empresaId_nome_key" ON "contas_financeiras"("empresaId","nome");
CREATE INDEX "contas_financeiras_empresaId_ativo_idx" ON "contas_financeiras"("empresaId","ativo");
CREATE UNIQUE INDEX "titulos_financeiros_pagamentoId_key" ON "titulos_financeiros"("pagamentoId");
CREATE INDEX "titulos_financeiros_organizacaoId_idx" ON "titulos_financeiros"("organizacaoId");
CREATE INDEX "titulos_financeiros_empresaId_tipo_status_idx" ON "titulos_financeiros"("empresaId","tipo","status");
CREATE INDEX "titulos_financeiros_clienteId_idx" ON "titulos_financeiros"("clienteId");
CREATE INDEX "titulos_financeiros_fornecedorId_idx" ON "titulos_financeiros"("fornecedorId");
CREATE INDEX "titulos_financeiros_vendaId_idx" ON "titulos_financeiros"("vendaId");
CREATE INDEX "titulos_financeiros_entradaEstoqueId_idx" ON "titulos_financeiros"("entradaEstoqueId");
CREATE INDEX "titulos_financeiros_vencimentoEm_idx" ON "titulos_financeiros"("vencimentoEm");
CREATE INDEX "titulos_financeiros_createdAt_idx" ON "titulos_financeiros"("createdAt");
CREATE INDEX "baixas_financeiras_tituloId_idx" ON "baixas_financeiras"("tituloId");
CREATE INDEX "baixas_financeiras_contaFinanceiraId_idx" ON "baixas_financeiras"("contaFinanceiraId");
CREATE INDEX "baixas_financeiras_sessaoCaixaId_idx" ON "baixas_financeiras"("sessaoCaixaId");
CREATE INDEX "baixas_financeiras_usuarioId_idx" ON "baixas_financeiras"("usuarioId");
CREATE INDEX "baixas_financeiras_pagoEm_idx" ON "baixas_financeiras"("pagoEm");
CREATE UNIQUE INDEX "conciliacoes_financeiras_origem_origemId_key" ON "conciliacoes_financeiras"("origem","origemId");
CREATE INDEX "conciliacoes_financeiras_empresaId_dataMovimento_idx" ON "conciliacoes_financeiras"("empresaId","dataMovimento");
CREATE INDEX "conciliacoes_financeiras_contaFinanceiraId_dataMovimento_idx" ON "conciliacoes_financeiras"("contaFinanceiraId","dataMovimento");
CREATE INDEX "conciliacoes_financeiras_usuarioId_idx" ON "conciliacoes_financeiras"("usuarioId");

ALTER TABLE "categorias_financeiras" ADD CONSTRAINT "categorias_financeiras_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contas_financeiras" ADD CONSTRAINT "contas_financeiras_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "titulos_financeiros" ADD CONSTRAINT "titulos_financeiros_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "titulos_financeiros" ADD CONSTRAINT "titulos_financeiros_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "titulos_financeiros" ADD CONSTRAINT "titulos_financeiros_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "titulos_financeiros" ADD CONSTRAINT "titulos_financeiros_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "titulos_financeiros" ADD CONSTRAINT "titulos_financeiros_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "titulos_financeiros" ADD CONSTRAINT "titulos_financeiros_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "vendas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "titulos_financeiros" ADD CONSTRAINT "titulos_financeiros_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "pagamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "titulos_financeiros" ADD CONSTRAINT "titulos_financeiros_entradaEstoqueId_fkey" FOREIGN KEY ("entradaEstoqueId") REFERENCES "entradas_estoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "baixas_financeiras" ADD CONSTRAINT "baixas_financeiras_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "titulos_financeiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "baixas_financeiras" ADD CONSTRAINT "baixas_financeiras_contaFinanceiraId_fkey" FOREIGN KEY ("contaFinanceiraId") REFERENCES "contas_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "baixas_financeiras" ADD CONSTRAINT "baixas_financeiras_sessaoCaixaId_fkey" FOREIGN KEY ("sessaoCaixaId") REFERENCES "sessoes_caixa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "baixas_financeiras" ADD CONSTRAINT "baixas_financeiras_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conciliacoes_financeiras" ADD CONSTRAINT "conciliacoes_financeiras_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conciliacoes_financeiras" ADD CONSTRAINT "conciliacoes_financeiras_contaFinanceiraId_fkey" FOREIGN KEY ("contaFinanceiraId") REFERENCES "contas_financeiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conciliacoes_financeiras" ADD CONSTRAINT "conciliacoes_financeiras_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
