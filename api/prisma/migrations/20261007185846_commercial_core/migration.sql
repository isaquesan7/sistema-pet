-- CreateEnum
CREATE TYPE "TipoItemCatalogo" AS ENUM ('PRODUTO', 'SERVICO');

-- CreateEnum
CREATE TYPE "UnidadeEstoque" AS ENUM ('UNIDADE', 'QUILOGRAMA', 'GRAMA', 'LITRO', 'MILILITRO', 'PACOTE', 'CAIXA');

-- CreateEnum
CREATE TYPE "TipoMovimentacaoEstoque" AS ENUM ('ENTRADA', 'VENDA', 'CONSUMO_INTERNO', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'PERDA', 'DEVOLUCAO_CLIENTE', 'DEVOLUCAO_FORNECEDOR', 'TRANSFERENCIA_ENTRADA', 'TRANSFERENCIA_SAIDA', 'CANCELAMENTO');

-- CreateEnum
CREATE TYPE "StatusComanda" AS ENUM ('ABERTA', 'PARCIALMENTE_FECHADA', 'FECHADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusComandaItem" AS ENUM ('ATIVO', 'FATURADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusVenda" AS ENUM ('ABERTA', 'FINALIZADA', 'CANCELADA', 'ESTORNADA');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'TRANSFERENCIA', 'CREDITO_CLIENTE', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO', 'CANCELADO', 'ESTORNADO', 'REEMBOLSADO');

-- CreateEnum
CREATE TYPE "StatusSessaoCaixa" AS ENUM ('ABERTO', 'FECHADO');

-- CreateEnum
CREATE TYPE "TipoMovimentacaoCaixa" AS ENUM ('VENDA', 'SUPRIMENTO', 'SANGRIA', 'ESTORNO', 'RECEBIMENTO', 'AJUSTE');

-- CreateTable
CREATE TABLE "categorias_itens" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_catalogo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "categoriaId" TEXT,
    "tipo" "TipoItemCatalogo" NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "codigoInterno" TEXT,
    "codigoBarras" TEXT,
    "precoVenda" DECIMAL(12,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itens_catalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "unidade" "UnidadeEstoque" NOT NULL DEFAULT 'UNIDADE',
    "custoMedio" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estoqueMinimo" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "controlaEstoque" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicos" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "duracaoMinutos" INTEGER,
    "geraComissao" BOOLEAN NOT NULL DEFAULT false,
    "percentualComissao" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fornecedores" (
    "id" TEXT NOT NULL,
    "razaoSocial" TEXT,
    "nomeFantasia" TEXT NOT NULL,
    "cpfCnpj" TEXT,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fornecedor_empresas" (
    "fornecedorId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fornecedor_empresas_pkey" PRIMARY KEY ("fornecedorId","empresaId")
);

-- CreateTable
CREATE TABLE "estoque_saldos" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estoque_saldos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes_produtos" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "numeroLote" TEXT NOT NULL,
    "dataFabricacao" DATE,
    "dataValidade" DATE,
    "quantidadeAtual" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lotes_produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes_estoque" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "loteId" TEXT,
    "usuarioId" TEXT,
    "tipo" "TipoMovimentacaoEstoque" NOT NULL,
    "quantidade" DECIMAL(14,3) NOT NULL,
    "saldoAnterior" DECIMAL(14,3) NOT NULL,
    "saldoPosterior" DECIMAL(14,3) NOT NULL,
    "custoUnitario" DECIMAL(12,2),
    "origemTipo" TEXT,
    "origemId" TEXT,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comandas" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "clienteId" TEXT NOT NULL,
    "status" "StatusComanda" NOT NULL DEFAULT 'ABERTA',
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fechadaEm" TIMESTAMP(3),

    CONSTRAINT "comandas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comanda_itens" (
    "id" TEXT NOT NULL,
    "comandaId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "itemCatalogoId" TEXT NOT NULL,
    "petId" TEXT,
    "descricao" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "valorUnitario" DECIMAL(12,2) NOT NULL,
    "desconto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorTotal" DECIMAL(12,2) NOT NULL,
    "origemTipo" TEXT,
    "origemId" TEXT,
    "status" "StatusComandaItem" NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comanda_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caixas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caixas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes_caixa" (
    "id" TEXT NOT NULL,
    "caixaId" TEXT NOT NULL,
    "usuarioAberturaId" TEXT NOT NULL,
    "usuarioFechamentoId" TEXT,
    "status" "StatusSessaoCaixa" NOT NULL DEFAULT 'ABERTO',
    "dataAbertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataFechamento" TIMESTAMP(3),
    "valorAbertura" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorFechamento" DECIMAL(12,2),
    "valorEsperado" DECIMAL(12,2),
    "diferencaFechamento" DECIMAL(12,2),
    "observacoes" TEXT,

    CONSTRAINT "sessoes_caixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendas" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "empresaId" TEXT NOT NULL,
    "comandaId" TEXT,
    "clienteId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "status" "StatusVenda" NOT NULL DEFAULT 'ABERTA',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "desconto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "acrescimo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finalizadaEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),

    CONSTRAINT "vendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venda_itens" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "itemCatalogoId" TEXT,
    "comandaItemId" TEXT,
    "petId" TEXT,
    "descricao" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "valorUnitario" DECIMAL(12,2) NOT NULL,
    "desconto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venda_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "sessaoCaixaId" TEXT,
    "forma" "FormaPagamento" NOT NULL,
    "status" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
    "valor" DECIMAL(12,2) NOT NULL,
    "parcelas" INTEGER DEFAULT 1,
    "transacaoExternaId" TEXT,
    "codigoAutorizacao" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pagoEm" TIMESTAMP(3),

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes_caixa" (
    "id" TEXT NOT NULL,
    "sessaoCaixaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoMovimentacaoCaixa" NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "descricao" TEXT NOT NULL,
    "referenciaTipo" TEXT,
    "referenciaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_caixa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categorias_itens_empresaId_idx" ON "categorias_itens"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_itens_empresaId_nome_key" ON "categorias_itens"("empresaId", "nome");

-- CreateIndex
CREATE INDEX "itens_catalogo_empresaId_idx" ON "itens_catalogo"("empresaId");

-- CreateIndex
CREATE INDEX "itens_catalogo_categoriaId_idx" ON "itens_catalogo"("categoriaId");

-- CreateIndex
CREATE INDEX "itens_catalogo_nome_idx" ON "itens_catalogo"("nome");

-- CreateIndex
CREATE INDEX "itens_catalogo_tipo_idx" ON "itens_catalogo"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "itens_catalogo_empresaId_codigoInterno_key" ON "itens_catalogo"("empresaId", "codigoInterno");

-- CreateIndex
CREATE UNIQUE INDEX "itens_catalogo_empresaId_codigoBarras_key" ON "itens_catalogo"("empresaId", "codigoBarras");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_itemId_key" ON "produtos"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "servicos_itemId_key" ON "servicos"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "fornecedores_cpfCnpj_key" ON "fornecedores"("cpfCnpj");

-- CreateIndex
CREATE INDEX "fornecedores_nomeFantasia_idx" ON "fornecedores"("nomeFantasia");

-- CreateIndex
CREATE UNIQUE INDEX "estoque_saldos_produtoId_key" ON "estoque_saldos"("produtoId");

-- CreateIndex
CREATE INDEX "lotes_produtos_produtoId_idx" ON "lotes_produtos"("produtoId");

-- CreateIndex
CREATE INDEX "lotes_produtos_dataValidade_idx" ON "lotes_produtos"("dataValidade");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_produtos_produtoId_numeroLote_key" ON "lotes_produtos"("produtoId", "numeroLote");

-- CreateIndex
CREATE INDEX "movimentacoes_estoque_empresaId_idx" ON "movimentacoes_estoque"("empresaId");

-- CreateIndex
CREATE INDEX "movimentacoes_estoque_produtoId_idx" ON "movimentacoes_estoque"("produtoId");

-- CreateIndex
CREATE INDEX "movimentacoes_estoque_loteId_idx" ON "movimentacoes_estoque"("loteId");

-- CreateIndex
CREATE INDEX "movimentacoes_estoque_usuarioId_idx" ON "movimentacoes_estoque"("usuarioId");

-- CreateIndex
CREATE INDEX "movimentacoes_estoque_createdAt_idx" ON "movimentacoes_estoque"("createdAt");

-- CreateIndex
CREATE INDEX "movimentacoes_estoque_origemTipo_origemId_idx" ON "movimentacoes_estoque"("origemTipo", "origemId");

-- CreateIndex
CREATE UNIQUE INDEX "comandas_numero_key" ON "comandas"("numero");

-- CreateIndex
CREATE INDEX "comandas_clienteId_idx" ON "comandas"("clienteId");

-- CreateIndex
CREATE INDEX "comandas_status_idx" ON "comandas"("status");

-- CreateIndex
CREATE INDEX "comandas_createdAt_idx" ON "comandas"("createdAt");

-- CreateIndex
CREATE INDEX "comanda_itens_comandaId_idx" ON "comanda_itens"("comandaId");

-- CreateIndex
CREATE INDEX "comanda_itens_empresaId_idx" ON "comanda_itens"("empresaId");

-- CreateIndex
CREATE INDEX "comanda_itens_itemCatalogoId_idx" ON "comanda_itens"("itemCatalogoId");

-- CreateIndex
CREATE INDEX "comanda_itens_petId_idx" ON "comanda_itens"("petId");

-- CreateIndex
CREATE INDEX "comanda_itens_status_idx" ON "comanda_itens"("status");

-- CreateIndex
CREATE INDEX "caixas_empresaId_idx" ON "caixas"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "caixas_empresaId_nome_key" ON "caixas"("empresaId", "nome");

-- CreateIndex
CREATE INDEX "sessoes_caixa_caixaId_idx" ON "sessoes_caixa"("caixaId");

-- CreateIndex
CREATE INDEX "sessoes_caixa_usuarioAberturaId_idx" ON "sessoes_caixa"("usuarioAberturaId");

-- CreateIndex
CREATE INDEX "sessoes_caixa_status_idx" ON "sessoes_caixa"("status");

-- CreateIndex
CREATE INDEX "sessoes_caixa_dataAbertura_idx" ON "sessoes_caixa"("dataAbertura");

-- CreateIndex
CREATE UNIQUE INDEX "vendas_numero_key" ON "vendas"("numero");

-- CreateIndex
CREATE INDEX "vendas_empresaId_idx" ON "vendas"("empresaId");

-- CreateIndex
CREATE INDEX "vendas_comandaId_idx" ON "vendas"("comandaId");

-- CreateIndex
CREATE INDEX "vendas_clienteId_idx" ON "vendas"("clienteId");

-- CreateIndex
CREATE INDEX "vendas_usuarioId_idx" ON "vendas"("usuarioId");

-- CreateIndex
CREATE INDEX "vendas_status_idx" ON "vendas"("status");

-- CreateIndex
CREATE INDEX "vendas_createdAt_idx" ON "vendas"("createdAt");

-- CreateIndex
CREATE INDEX "venda_itens_vendaId_idx" ON "venda_itens"("vendaId");

-- CreateIndex
CREATE INDEX "venda_itens_itemCatalogoId_idx" ON "venda_itens"("itemCatalogoId");

-- CreateIndex
CREATE INDEX "venda_itens_comandaItemId_idx" ON "venda_itens"("comandaItemId");

-- CreateIndex
CREATE INDEX "venda_itens_petId_idx" ON "venda_itens"("petId");

-- CreateIndex
CREATE INDEX "pagamentos_vendaId_idx" ON "pagamentos"("vendaId");

-- CreateIndex
CREATE INDEX "pagamentos_sessaoCaixaId_idx" ON "pagamentos"("sessaoCaixaId");

-- CreateIndex
CREATE INDEX "pagamentos_status_idx" ON "pagamentos"("status");

-- CreateIndex
CREATE INDEX "pagamentos_forma_idx" ON "pagamentos"("forma");

-- CreateIndex
CREATE INDEX "pagamentos_createdAt_idx" ON "pagamentos"("createdAt");

-- CreateIndex
CREATE INDEX "movimentacoes_caixa_sessaoCaixaId_idx" ON "movimentacoes_caixa"("sessaoCaixaId");

-- CreateIndex
CREATE INDEX "movimentacoes_caixa_usuarioId_idx" ON "movimentacoes_caixa"("usuarioId");

-- CreateIndex
CREATE INDEX "movimentacoes_caixa_tipo_idx" ON "movimentacoes_caixa"("tipo");

-- CreateIndex
CREATE INDEX "movimentacoes_caixa_createdAt_idx" ON "movimentacoes_caixa"("createdAt");

-- CreateIndex
CREATE INDEX "movimentacoes_caixa_referenciaTipo_referenciaId_idx" ON "movimentacoes_caixa"("referenciaTipo", "referenciaId");

-- AddForeignKey
ALTER TABLE "categorias_itens" ADD CONSTRAINT "categorias_itens_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_catalogo" ADD CONSTRAINT "itens_catalogo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_catalogo" ADD CONSTRAINT "itens_catalogo_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_itens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "itens_catalogo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicos" ADD CONSTRAINT "servicos_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "itens_catalogo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fornecedor_empresas" ADD CONSTRAINT "fornecedor_empresas_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fornecedor_empresas" ADD CONSTRAINT "fornecedor_empresas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque_saldos" ADD CONSTRAINT "estoque_saldos_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_produtos" ADD CONSTRAINT "lotes_produtos_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes_produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comandas" ADD CONSTRAINT "comandas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda_itens" ADD CONSTRAINT "comanda_itens_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "comandas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda_itens" ADD CONSTRAINT "comanda_itens_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda_itens" ADD CONSTRAINT "comanda_itens_itemCatalogoId_fkey" FOREIGN KEY ("itemCatalogoId") REFERENCES "itens_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda_itens" ADD CONSTRAINT "comanda_itens_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caixas" ADD CONSTRAINT "caixas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_caixa" ADD CONSTRAINT "sessoes_caixa_caixaId_fkey" FOREIGN KEY ("caixaId") REFERENCES "caixas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_caixa" ADD CONSTRAINT "sessoes_caixa_usuarioAberturaId_fkey" FOREIGN KEY ("usuarioAberturaId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_caixa" ADD CONSTRAINT "sessoes_caixa_usuarioFechamentoId_fkey" FOREIGN KEY ("usuarioFechamentoId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "comandas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venda_itens" ADD CONSTRAINT "venda_itens_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "vendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venda_itens" ADD CONSTRAINT "venda_itens_itemCatalogoId_fkey" FOREIGN KEY ("itemCatalogoId") REFERENCES "itens_catalogo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venda_itens" ADD CONSTRAINT "venda_itens_comandaItemId_fkey" FOREIGN KEY ("comandaItemId") REFERENCES "comanda_itens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venda_itens" ADD CONSTRAINT "venda_itens_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "vendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_sessaoCaixaId_fkey" FOREIGN KEY ("sessaoCaixaId") REFERENCES "sessoes_caixa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_caixa" ADD CONSTRAINT "movimentacoes_caixa_sessaoCaixaId_fkey" FOREIGN KEY ("sessaoCaixaId") REFERENCES "sessoes_caixa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_caixa" ADD CONSTRAINT "movimentacoes_caixa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
