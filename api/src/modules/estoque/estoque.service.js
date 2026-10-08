import prisma from "../../config/prisma.js";
import { calcularPrecificacao } from "../catalogo/catalogo.service.js";

const n = (v) => Number(v ?? 0);
const round = (v, c = 3) => Math.round((n(v) + Number.EPSILON) * 10 ** c) / 10 ** c;
const dateOnly = (v) => (v ? new Date(`${v}T00:00:00.000Z`) : null);
const cleanDoc = (v) => (v ? String(v).replace(/\D/g, "") || null : null);

async function produtoDaEmpresa(tx, empresaId, itemCatalogoId) {
  const item = await tx.itemCatalogo.findFirst({
    where: { id: itemCatalogoId, empresaId, tipo: "PRODUTO" },
    include: { produto: { include: { estoque: true, lotes: true } } },
  });
  if (!item?.produto) throw new Error("PRODUTO_NAO_ENCONTRADO");
  if (!item.produto.controlaEstoque) throw new Error("PRODUTO_SEM_CONTROLE_ESTOQUE");
  return item;
}

async function aplicarMovimento(tx, { empresaId, produto, usuarioId, tipo, quantidade, loteId = null, origemTipo, origemId, custoUnitario, observacao }) {
  const saldo = await tx.estoqueSaldo.findUnique({ where: { produtoId: produto.id } });
  const anterior = n(saldo?.quantidade);
  const deltaPositivo = ["ENTRADA", "AJUSTE_POSITIVO", "DEVOLUCAO_CLIENTE", "CANCELAMENTO"].includes(tipo);
  const posterior = round(anterior + (deltaPositivo ? quantidade : -quantidade));
  if (posterior < -0.0001) throw new Error("ESTOQUE_INSUFICIENTE");

  if (loteId) {
    const lote = await tx.loteProduto.findUnique({ where: { id: loteId } });
    if (!lote || lote.produtoId !== produto.id) throw new Error("LOTE_INVALIDO");
    const lotePosterior = round(n(lote.quantidadeAtual) + (deltaPositivo ? quantidade : -quantidade));
    if (lotePosterior < -0.0001) throw new Error("ESTOQUE_LOTE_INSUFICIENTE");
    await tx.loteProduto.update({ where: { id: lote.id }, data: { quantidadeAtual: lotePosterior } });
  }

  await tx.estoqueSaldo.upsert({ where: { produtoId: produto.id }, update: { quantidade: posterior }, create: { produtoId: produto.id, quantidade: posterior } });
  return tx.movimentacaoEstoque.create({
    data: { empresaId, produtoId: produto.id, loteId, usuarioId, tipo, quantidade, saldoAnterior: anterior, saldoPosterior: posterior, custoUnitario: custoUnitario ?? produto.custoMedio, origemTipo, origemId, observacao: observacao || null },
  });
}

export async function resumo(empresaId) {
  const produtos = await prisma.itemCatalogo.findMany({
    where: { empresaId, tipo: "PRODUTO", ativo: true, produto: { controlaEstoque: true } },
    include: { produto: { include: { estoque: true, lotes: true } } },
  });
  const hoje = new Date();
  const limite = new Date(hoje); limite.setDate(limite.getDate() + 30);
  let semEstoque = 0, baixo = 0, vencidos = 0, vencendo = 0, valor = 0;
  for (const item of produtos) {
    const q = n(item.produto?.estoque?.quantidade);
    if (q <= 0) semEstoque += 1;
    if (n(item.produto?.estoqueMinimo) > 0 && q <= n(item.produto.estoqueMinimo)) baixo += 1;
    valor += q * n(item.produto?.custoMedio);
    for (const lote of item.produto?.lotes || []) {
      if (n(lote.quantidadeAtual) <= 0 || !lote.dataValidade) continue;
      if (lote.dataValidade < hoje) vencidos += 1;
      else if (lote.dataValidade <= limite) vencendo += 1;
    }
  }
  return { produtos: produtos.length, semEstoque, estoqueBaixo: baixo, lotesVencidos: vencidos, lotesVencendo: vencendo, valorEstoque: Math.round(valor * 100) / 100 };
}

export async function listarProdutos({ empresaId, busca, alerta }) {
  const dados = await prisma.itemCatalogo.findMany({
    where: { empresaId, tipo: "PRODUTO", ...(busca ? { OR: [{ nome: { contains: busca, mode: "insensitive" } }, { codigoInterno: { contains: busca, mode: "insensitive" } }, { codigoBarras: { contains: busca } }] } : {}) },
    orderBy: { nome: "asc" },
    include: { categoria: true, produto: { include: { estoque: true, lotes: { where: { quantidadeAtual: { gt: 0 } }, orderBy: [{ dataValidade: "asc" }, { createdAt: "asc" }] } } } },
  });
  return dados.filter((item) => {
    const q = n(item.produto?.estoque?.quantidade), min = n(item.produto?.estoqueMinimo);
    if (alerta === "SEM_ESTOQUE") return q <= 0;
    if (alerta === "BAIXO") return min > 0 && q <= min;
    return true;
  });
}

export async function listarMovimentacoes({ empresaId, produtoId, tipo, limite = 100 }) {
  return prisma.movimentacaoEstoque.findMany({
    where: { empresaId, ...(produtoId ? { produtoId } : {}), ...(tipo ? { tipo } : {}) },
    orderBy: { createdAt: "desc" }, take: Math.min(Number(limite) || 100, 300),
    include: { produto: { include: { item: true } }, lote: true, usuario: { select: { id: true, nome: true } } },
  });
}

export async function listarFornecedores({ organizacaoId, empresaId, busca }) {
  return prisma.fornecedor.findMany({
    where: { organizacaoId, ...(busca ? { OR: [{ nomeFantasia: { contains: busca, mode: "insensitive" } }, { razaoSocial: { contains: busca, mode: "insensitive" } }, { cpfCnpj: { contains: cleanDoc(busca) || busca } }] } : {}) },
    orderBy: { nomeFantasia: "asc" },
    include: { empresas: { where: { empresaId }, include: { empresa: { select: { id: true, nomeFantasia: true } } } } },
  });
}

export async function salvarFornecedor({ organizacaoId, empresaId, id, dados }) {
  const cpfCnpj = cleanDoc(dados.cpfCnpj);
  return prisma.$transaction(async (tx) => {
    let fornecedor;
    if (id) {
      const atual = await tx.fornecedor.findFirst({ where: { id, organizacaoId } });
      if (!atual) throw new Error("FORNECEDOR_NAO_ENCONTRADO");
      fornecedor = await tx.fornecedor.update({
        where: { id },
        data: {
          ...dados,
          ...(Object.prototype.hasOwnProperty.call(dados, "cpfCnpj") ? { cpfCnpj } : {}),
          ...(Object.prototype.hasOwnProperty.call(dados, "email") ? { email: dados.email || null } : {}),
        },
      });
    } else {
      fornecedor = await tx.fornecedor.create({ data: { ...dados, organizacaoId, cpfCnpj, email: dados.email || null } });
    }
    await tx.fornecedorEmpresa.upsert({ where: { fornecedorId_empresaId: { fornecedorId: fornecedor.id, empresaId } }, update: {}, create: { fornecedorId: fornecedor.id, empresaId } });
    return fornecedor;
  });
}

export async function listarEntradas(empresaId) {
  return prisma.entradaEstoque.findMany({ where: { empresaId }, orderBy: { dataEntrada: "desc" }, take: 100, include: { fornecedor: true, usuario: { select: { id: true, nome: true } }, itens: { include: { produto: { include: { item: true } }, lote: true } } } });
}

export async function criarEntrada({ empresaId, organizacaoId, usuarioId, dados }) {
  return prisma.$transaction(async (tx) => {
    if (dados.fornecedorId) {
      const f = await tx.fornecedor.findFirst({ where: { id: dados.fornecedorId, organizacaoId, ativo: true } });
      if (!f) throw new Error("FORNECEDOR_NAO_ENCONTRADO");
    }
    const entrada = await tx.entradaEstoque.create({ data: { empresaId, fornecedorId: dados.fornecedorId || null, usuarioId, numeroDocumento: dados.numeroDocumento || null, dataEntrada: dados.dataEntrada ? new Date(dados.dataEntrada) : new Date(), observacao: dados.observacao || null } });
    let total = 0;
    for (const linha of dados.itens) {
      const item = await produtoDaEmpresa(tx, empresaId, linha.itemCatalogoId);
      const produto = item.produto;
      if (produto.controlaLote && !linha.numeroLote) throw new Error("LOTE_OBRIGATORIO");
      if (produto.controlaValidade && !linha.dataValidade) throw new Error("VALIDADE_OBRIGATORIA");
      let lote = null;
      if (linha.numeroLote) {
        lote = await tx.loteProduto.upsert({
          where: { produtoId_numeroLote: { produtoId: produto.id, numeroLote: linha.numeroLote.trim() } },
          update: { ...(linha.dataFabricacao ? { dataFabricacao: dateOnly(linha.dataFabricacao) } : {}), ...(linha.dataValidade ? { dataValidade: dateOnly(linha.dataValidade) } : {}) },
          create: { produtoId: produto.id, numeroLote: linha.numeroLote.trim(), dataFabricacao: dateOnly(linha.dataFabricacao), dataValidade: dateOnly(linha.dataValidade), quantidadeAtual: 0 },
        });
      }
      const saldoAnterior = n(produto.estoque?.quantidade);
      const custoAntigo = n(produto.custoMedio);
      const qtd = n(linha.quantidade), custo = n(linha.custoUnitario);
      const novoSaldo = saldoAnterior + qtd;
      const novoCusto = novoSaldo > 0 ? ((saldoAnterior * custoAntigo) + (qtd * custo)) / novoSaldo : custo;
      await aplicarMovimento(tx, { empresaId, produto, usuarioId, tipo: "ENTRADA", quantidade: qtd, loteId: lote?.id || null, origemTipo: "ENTRADA_ESTOQUE", origemId: entrada.id, custoUnitario: custo, observacao: dados.observacao });
      await tx.produto.update({ where: { id: produto.id }, data: { custoMedio: novoCusto } });
      const preco = calcularPrecificacao({ custo: novoCusto, precoVenda: n(item.precoVenda) });
      await tx.itemCatalogo.update({ where: { id: item.id }, data: preco });
      await tx.historicoPrecoItem.create({ data: { itemCatalogoId: item.id, usuarioId, ...preco } });
      const subtotal = Math.round(qtd * custo * 100) / 100; total += subtotal;
      await tx.entradaEstoqueItem.create({ data: { entradaId: entrada.id, produtoId: produto.id, loteId: lote?.id || null, quantidade: qtd, custoUnitario: custo, subtotal } });
    }
    return tx.entradaEstoque.update({ where: { id: entrada.id }, data: { valorTotal: Math.round(total * 100) / 100 }, include: { fornecedor: true, itens: { include: { produto: { include: { item: true } }, lote: true } } } });
  });
}

export async function cancelarEntrada({ empresaId, usuarioId, id, motivo }) {
  return prisma.$transaction(async (tx) => {
    const entrada = await tx.entradaEstoque.findFirst({
      where: { id, empresaId, status: "CONCLUIDA" },
      include: { itens: { include: { produto: { include: { estoque: true, item: true } }, lote: true } } },
    });
    if (!entrada) throw new Error("ENTRADA_NAO_ENCONTRADA");

    const produtoIds = [...new Set(entrada.itens.map((item) => item.produtoId))];
    const posterior = await tx.movimentacaoEstoque.findFirst({
      where: {
        empresaId,
        produtoId: { in: produtoIds },
        createdAt: { gt: entrada.createdAt },
        NOT: { origemTipo: "ENTRADA_ESTOQUE", origemId: entrada.id },
      },
      select: { id: true },
    });
    if (posterior) throw new Error("ENTRADA_COM_MOVIMENTACOES_POSTERIORES");

    const porProduto = new Map();
    for (const linha of entrada.itens) {
      const grupo = porProduto.get(linha.produtoId) || { produto: linha.produto, quantidade: 0, valor: 0 };
      grupo.quantidade += n(linha.quantidade);
      grupo.valor += n(linha.quantidade) * n(linha.custoUnitario);
      porProduto.set(linha.produtoId, grupo);
    }

    for (const linha of entrada.itens) {
      await aplicarMovimento(tx, {
        empresaId,
        produto: linha.produto,
        usuarioId,
        tipo: "DEVOLUCAO_FORNECEDOR",
        quantidade: n(linha.quantidade),
        loteId: linha.loteId,
        origemTipo: "CANCELAMENTO_ENTRADA",
        origemId: entrada.id,
        custoUnitario: linha.custoUnitario,
        observacao: motivo,
      });
    }

    for (const grupo of porProduto.values()) {
      const saldoAntesCancelamento = n(grupo.produto.estoque?.quantidade);
      const custoAtual = n(grupo.produto.custoMedio);
      const saldoRestante = saldoAntesCancelamento - grupo.quantidade;
      const valorRestante = saldoAntesCancelamento * custoAtual - grupo.valor;
      const custoRestaurado = saldoRestante > 0 ? Math.max(0, valorRestante / saldoRestante) : 0;
      await tx.produto.update({ where: { id: grupo.produto.id }, data: { custoMedio: custoRestaurado } });
      const preco = calcularPrecificacao({ custo: custoRestaurado, precoVenda: n(grupo.produto.item.precoVenda) });
      await tx.itemCatalogo.update({ where: { id: grupo.produto.item.id }, data: preco });
      await tx.historicoPrecoItem.create({ data: { itemCatalogoId: grupo.produto.item.id, usuarioId, ...preco } });
    }

    return tx.entradaEstoque.update({
      where: { id },
      data: { status: "CANCELADA", canceladaEm: new Date(), motivoCancelamento: motivo },
    });
  });
}

export async function ajustar({ empresaId, usuarioId, dados }) {
  return prisma.$transaction(async (tx) => {
    const item = await produtoDaEmpresa(tx, empresaId, dados.itemCatalogoId);
    if (item.produto.controlaLote && !dados.loteId) throw new Error("LOTE_OBRIGATORIO");
    return aplicarMovimento(tx, { empresaId, produto: item.produto, usuarioId, tipo: dados.tipo, quantidade: n(dados.quantidade), loteId: dados.loteId || null, origemTipo: "AJUSTE_MANUAL", origemId: null, observacao: dados.observacao });
  });
}

export async function listarInventarios(empresaId) {
  return prisma.inventarioEstoque.findMany({ where: { empresaId }, orderBy: { iniciadoEm: "desc" }, take: 60, include: { usuario: { select: { id: true, nome: true } }, _count: { select: { itens: true } } } });
}

export async function criarInventario({ empresaId, usuarioId, dados }) {
  return prisma.$transaction(async (tx) => {
    const aberto = await tx.inventarioEstoque.findFirst({ where: { empresaId, status: "ABERTO" } });
    if (aberto) throw new Error("INVENTARIO_JA_ABERTO");
    const inventario = await tx.inventarioEstoque.create({ data: { empresaId, usuarioId, descricao: dados.descricao || null, observacao: dados.observacao || null } });
    const produtos = await tx.itemCatalogo.findMany({ where: { empresaId, tipo: "PRODUTO", ativo: true, produto: { controlaEstoque: true } }, include: { produto: { include: { estoque: true, lotes: true } } } });
    for (const item of produtos) {
      const p = item.produto;
      if (p.controlaLote && p.lotes.length) {
        for (const lote of p.lotes) await tx.inventarioEstoqueItem.create({ data: { inventarioId: inventario.id, produtoId: p.id, loteId: lote.id, saldoSistema: lote.quantidadeAtual } });
      } else {
        await tx.inventarioEstoqueItem.create({ data: { inventarioId: inventario.id, produtoId: p.id, saldoSistema: p.estoque?.quantidade || 0 } });
      }
    }
    return buscarInventarioTx(tx, empresaId, inventario.id);
  });
}

async function buscarInventarioTx(tx, empresaId, id) {
  const inv = await tx.inventarioEstoque.findFirst({ where: { id, empresaId }, include: { usuario: { select: { id: true, nome: true } }, itens: { include: { produto: { include: { item: true } }, lote: true }, orderBy: { createdAt: "asc" } } } });
  if (!inv) throw new Error("INVENTARIO_NAO_ENCONTRADO");
  return inv;
}
export async function buscarInventario(empresaId, id) { return prisma.$transaction((tx) => buscarInventarioTx(tx, empresaId, id)); }

export async function contarInventario({ empresaId, id, itemId, quantidadeContada }) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.inventarioEstoque.findFirst({ where: { id, empresaId, status: "ABERTO" } }); if (!inv) throw new Error("INVENTARIO_NAO_ABERTO");
    const item = await tx.inventarioEstoqueItem.findFirst({ where: { id: itemId, inventarioId: id } }); if (!item) throw new Error("ITEM_INVENTARIO_NAO_ENCONTRADO");
    return tx.inventarioEstoqueItem.update({ where: { id: item.id }, data: { quantidadeContada, diferenca: round(quantidadeContada - n(item.saldoSistema)) } });
  });
}

export async function concluirInventario({ empresaId, usuarioId, id }) {
  return prisma.$transaction(async (tx) => {
    const inv = await buscarInventarioTx(tx, empresaId, id); if (inv.status !== "ABERTO") throw new Error("INVENTARIO_NAO_ABERTO");
    if (inv.itens.some((i) => i.quantidadeContada === null)) throw new Error("INVENTARIO_CONTAGEM_INCOMPLETA");
    for (const linha of inv.itens) {
      const diff = n(linha.diferenca); if (Math.abs(diff) < 0.0001) continue;
      if (linha.produto.controlaLote && !linha.loteId) throw new Error("INVENTARIO_LOTE_OBRIGATORIO");
      const movimento = await aplicarMovimento(tx, { empresaId, produto: linha.produto, usuarioId, tipo: diff > 0 ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO", quantidade: Math.abs(diff), loteId: linha.loteId, origemTipo: "INVENTARIO", origemId: inv.id, observacao: `Inventário ${inv.descricao || inv.id}` });
      await tx.inventarioEstoqueItem.update({ where: { id: linha.id }, data: { movimentacaoId: movimento.id } });
    }
    return tx.inventarioEstoque.update({ where: { id }, data: { status: "CONCLUIDO", concluidoEm: new Date() } });
  });
}

export async function cancelarInventario({ empresaId, id }) {
  const inv = await prisma.inventarioEstoque.findFirst({ where: { id, empresaId, status: "ABERTO" } }); if (!inv) throw new Error("INVENTARIO_NAO_ABERTO");
  return prisma.inventarioEstoque.update({ where: { id }, data: { status: "CANCELADO", canceladoEm: new Date() } });
}
