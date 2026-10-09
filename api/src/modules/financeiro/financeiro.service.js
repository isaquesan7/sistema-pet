import prisma from "../../config/prisma.js";

function n(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function money(value) { return Math.round((n(value) + Number.EPSILON) * 100) / 100; }
function startOfDay(value) { const d = value ? new Date(`${value}T00:00:00`) : new Date(); d.setHours(0,0,0,0); return d; }
function endOfDay(value) { const d = value ? new Date(`${value}T23:59:59.999`) : new Date(); d.setHours(23,59,59,999); return d; }
function dateOnly(value) { return value ? startOfDay(value) : null; }
function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}
function defaultPeriod(dataInicio, dataFim) {
  if (dataInicio || dataFim) return { inicio: startOfDay(dataInicio), fim: endOfDay(dataFim) };
  const now = new Date();
  return { inicio: new Date(now.getFullYear(), now.getMonth(), 1), fim: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999) };
}
function saldoTitulo(titulo) { return Math.max(0, money(n(titulo.valorOriginal) - n(titulo.valorPago))); }
function tituloDecorado(titulo) {
  const hoje = startOfDay();
  const vencimento = titulo.vencimentoEm ? new Date(titulo.vencimentoEm) : null;
  return { ...titulo, saldoAberto: saldoTitulo(titulo), vencido: Boolean(vencimento && vencimento < hoje && ["PENDENTE","PARCIAL"].includes(titulo.status)) };
}

async function auditar(tx, { organizacaoId, empresaId, usuarioId, acao, entidade, entidadeId, dadosNovos }) {
  return tx.auditoria.create({ data: { organizacaoId, empresaId, usuarioId, acao, entidade, entidadeId, dadosNovos } });
}

export async function empresasPermitidasFinanceiro({ usuarioId, organizacaoId }) {
  const vinculos = await prisma.usuarioEmpresa.findMany({
    where: {
      usuarioId,
      ativo: true,
      empresa: { organizacaoId, ativo: true },
      cargo: { permissoes: { some: { permissao: { codigo: "financeiro.visualizar" } } } },
    },
    select: { empresa: { select: { id: true, nomeFantasia: true, tipo: true } } },
  });
  return vinculos.map((item) => item.empresa);
}

async function scopeCompanyIds({ empresaId, organizacaoId, usuarioId, escopo }) {
  if (escopo !== "organizacao") return [empresaId];
  const empresas = await empresasPermitidasFinanceiro({ usuarioId, organizacaoId });
  return empresas.map((item) => item.id);
}

export async function listarCategorias(organizacaoId) {
  return prisma.categoriaFinanceira.findMany({ where: { organizacaoId }, orderBy: [{ ativo: "desc" }, { nome: "asc" }] });
}

export async function salvarCategoria({ organizacaoId, id, dados }) {
  if (id) {
    const atual = await prisma.categoriaFinanceira.findFirst({ where: { id, organizacaoId } });
    if (!atual) throw new Error("CATEGORIA_NAO_ENCONTRADA");
    return prisma.categoriaFinanceira.update({ where: { id }, data: dados });
  }
  return prisma.categoriaFinanceira.create({ data: { organizacaoId, ...dados } });
}

export async function listarContas(empresaId) {
  const contas = await prisma.contaFinanceira.findMany({
    where: { empresaId },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    include: { conciliacoes: { select: { direcao: true, valor: true } } },
  });
  return contas.map((conta) => {
    const movimento = conta.conciliacoes.reduce((sum, item) => sum + (item.direcao === "ENTRADA" ? n(item.valor) : -n(item.valor)), 0);
    const { conciliacoes, ...rest } = conta;
    return { ...rest, saldoConciliado: money(n(conta.saldoInicial) + movimento) };
  });
}

export async function salvarConta({ empresaId, id, dados }) {
  if (id) {
    const atual = await prisma.contaFinanceira.findFirst({ where: { id, empresaId } });
    if (!atual) throw new Error("CONTA_NAO_ENCONTRADA");
    return prisma.contaFinanceira.update({ where: { id }, data: dados });
  }
  return prisma.contaFinanceira.create({ data: { empresaId, ...dados } });
}

async function validarReferencias(tx, { organizacaoId, empresaId, tipo, categoriaId, clienteId, fornecedorId, entradaEstoqueId }) {
  if (categoriaId) {
    const categoria = await tx.categoriaFinanceira.findFirst({ where: { id: categoriaId, organizacaoId, ativo: true } });
    if (!categoria) throw new Error("CATEGORIA_NAO_ENCONTRADA");
    if (tipo === "RECEBER" && categoria.tipo === "DESPESA") throw new Error("CATEGORIA_TIPO_INVALIDO");
    if (tipo === "PAGAR" && categoria.tipo === "RECEITA") throw new Error("CATEGORIA_TIPO_INVALIDO");
  }
  if (clienteId) {
    const cliente = await tx.cliente.findFirst({ where: { id: clienteId, organizacaoId, ativo: true } });
    if (!cliente) throw new Error("CLIENTE_NAO_ENCONTRADO");
  }
  if (fornecedorId) {
    const fornecedor = await tx.fornecedor.findFirst({ where: { id: fornecedorId, organizacaoId, ativo: true } });
    if (!fornecedor) throw new Error("FORNECEDOR_NAO_ENCONTRADO");
  }
  if (entradaEstoqueId) {
    const entrada = await tx.entradaEstoque.findFirst({ where: { id: entradaEstoqueId, empresaId, status: "CONCLUIDA" } });
    if (!entrada) throw new Error("ENTRADA_NAO_ENCONTRADA");
    if (tipo !== "PAGAR") throw new Error("ENTRADA_SOMENTE_PAGAR");
  }
}

function splitMoney(total, count) {
  const cents = Math.round(n(total) * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  return Array.from({ length: count }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100);
}

export async function criarTitulos({ organizacaoId, empresaId, usuarioId, dados }) {
  return prisma.$transaction(async (tx) => {
    await validarReferencias(tx, { organizacaoId, empresaId, ...dados });
    const parcelas = Math.max(1, Number(dados.parcelas || 1));
    const valores = splitMoney(dados.valorOriginal, parcelas);
    const vencimentoBase = dados.vencimentoEm ? dateOnly(dados.vencimentoEm) : null;
    const criados = [];
    for (let i = 0; i < parcelas; i++) {
      const titulo = await tx.tituloFinanceiro.create({
        data: {
          organizacaoId,
          empresaId,
          tipo: dados.tipo,
          origem: dados.entradaEstoqueId ? "ENTRADA_ESTOQUE" : "MANUAL",
          categoriaId: dados.categoriaId || null,
          clienteId: dados.tipo === "RECEBER" ? (dados.clienteId || null) : null,
          fornecedorId: dados.tipo === "PAGAR" ? (dados.fornecedorId || null) : null,
          entradaEstoqueId: dados.entradaEstoqueId || null,
          descricao: parcelas > 1 ? `${dados.descricao} (${i + 1}/${parcelas})` : dados.descricao,
          documento: dados.documento || null,
          parcelaAtual: i + 1,
          totalParcelas: parcelas,
          competencia: dateOnly(dados.competencia),
          vencimentoEm: vencimentoBase ? addMonths(vencimentoBase, i) : null,
          valorOriginal: valores[i],
          observacoes: dados.observacoes || null,
        },
      });
      criados.push(titulo);
      await auditar(tx, { organizacaoId, empresaId, usuarioId, acao: "CRIAR", entidade: "TITULO_FINANCEIRO", entidadeId: titulo.id, dadosNovos: { tipo: titulo.tipo, valor: valores[i], descricao: titulo.descricao } });
    }
    return criados;
  }, { maxWait: 10000, timeout: 30000 });
}

export async function atualizarTitulo({ organizacaoId, empresaId, usuarioId, id, dados }) {
  return prisma.$transaction(async (tx) => {
    const atual = await tx.tituloFinanceiro.findFirst({ where: { id, empresaId, organizacaoId } });
    if (!atual) throw new Error("TITULO_NAO_ENCONTRADO");
    if (atual.status === "CANCELADO") throw new Error("TITULO_NAO_EDITAVEL");
    if (atual.origem === "VENDA_FIADO") throw new Error("TITULO_FIADO_NAO_EDITAVEL");
    await validarReferencias(tx, { organizacaoId, empresaId, tipo: atual.tipo, ...dados });
    if (dados.valorOriginal !== undefined && n(dados.valorOriginal) + 0.001 < n(atual.valorPago)) throw new Error("VALOR_MENOR_QUE_PAGO");
    const update = { ...dados };
    delete update.parcelas;
    if (Object.prototype.hasOwnProperty.call(update, "competencia")) update.competencia = dateOnly(update.competencia);
    if (Object.prototype.hasOwnProperty.call(update, "vencimentoEm")) update.vencimentoEm = dateOnly(update.vencimentoEm);
    const titulo = await tx.tituloFinanceiro.update({ where: { id }, data: update });
    await auditar(tx, { organizacaoId, empresaId, usuarioId, acao: "EDITAR", entidade: "TITULO_FINANCEIRO", entidadeId: id, dadosNovos: { descricao: titulo.descricao, vencimentoEm: titulo.vencimentoEm?.toISOString?.(), valorOriginal: n(titulo.valorOriginal) } });
    return titulo;
  });
}

export async function listarTitulos({ organizacaoId, empresaId, tipo, status, busca, dataInicio, dataFim, limite = 200 }) {
  const hoje = startOfDay();
  const where = {
    organizacaoId,
    empresaId,
    ...(tipo ? { tipo } : {}),
    ...(status === "VENCIDO" ? { status: { in: ["PENDENTE", "PARCIAL"] }, vencimentoEm: { lt: hoje } } : status ? { status } : {}),
    ...(dataInicio || dataFim ? { vencimentoEm: { ...(dataInicio ? { gte: startOfDay(dataInicio) } : {}), ...(dataFim ? { lte: endOfDay(dataFim) } : {}) } } : {}),
    ...(busca ? { OR: [
      { descricao: { contains: busca, mode: "insensitive" } },
      { documento: { contains: busca, mode: "insensitive" } },
      { cliente: { nome: { contains: busca, mode: "insensitive" } } },
      { fornecedor: { nomeFantasia: { contains: busca, mode: "insensitive" } } },
    ] } : {}),
  };
  const titulos = await prisma.tituloFinanceiro.findMany({
    where,
    orderBy: [{ vencimentoEm: "asc" }, { createdAt: "desc" }],
    take: Math.min(Number(limite) || 200, 500),
    include: {
      categoria: true,
      cliente: { select: { id: true, nome: true, telefone: true, whatsapp: true } },
      fornecedor: { select: { id: true, nomeFantasia: true } },
      venda: { select: { id: true, numero: true, status: true } },
      entradaEstoque: { select: { id: true, numeroDocumento: true, dataEntrada: true, valorTotal: true } },
      baixas: { include: { contaFinanceira: true, usuario: { select: { id: true, nome: true } } }, orderBy: { pagoEm: "desc" } },
    },
  });
  return titulos.map(tituloDecorado);
}

export async function buscarTitulo({ organizacaoId, empresaId, id }) {
  const titulo = await prisma.tituloFinanceiro.findFirst({
    where: { id, organizacaoId, empresaId },
    include: {
      categoria: true, cliente: true, fornecedor: true,
      venda: { select: { id: true, numero: true, status: true, valorTotal: true } },
      entradaEstoque: { include: { fornecedor: true } },
      baixas: { include: { contaFinanceira: true, usuario: { select: { id: true, nome: true } } }, orderBy: { pagoEm: "desc" } },
    },
  });
  if (!titulo) throw new Error("TITULO_NAO_ENCONTRADO");
  return tituloDecorado(titulo);
}

export async function baixarTitulo({ organizacaoId, empresaId, usuarioId, id, dados }) {
  return prisma.$transaction(async (tx) => {
    const titulo = await tx.tituloFinanceiro.findFirst({ where: { id, organizacaoId, empresaId } });
    if (!titulo) throw new Error("TITULO_NAO_ENCONTRADO");
    if (!["PENDENTE", "PARCIAL"].includes(titulo.status)) throw new Error("TITULO_NAO_BAIXAVEL");
    const principal = money(n(dados.valor) + n(dados.desconto) - n(dados.juros));
    if (principal <= 0) throw new Error("BAIXA_INVALIDA");
    const saldo = saldoTitulo(titulo);
    if (principal - saldo > 0.009) throw new Error("BAIXA_MAIOR_SALDO");

    let conta = null;
    if (dados.contaFinanceiraId) {
      conta = await tx.contaFinanceira.findFirst({ where: { id: dados.contaFinanceiraId, empresaId, ativo: true } });
      if (!conta) throw new Error("CONTA_NAO_ENCONTRADA");
    }

    let sessao = null;
    if (dados.forma === "DINHEIRO" && dados.usarCaixaAberto) {
      sessao = await tx.sessaoCaixa.findFirst({ where: { status: "ABERTO", caixa: { empresaId, ativo: true } }, orderBy: { dataAbertura: "desc" } });
    }
    const pagoEm = dados.pagoEm ? new Date(`${dados.pagoEm}T12:00:00`) : new Date();
    const baixa = await tx.baixaFinanceira.create({
      data: {
        tituloId: titulo.id,
        contaFinanceiraId: conta?.id || null,
        sessaoCaixaId: sessao?.id || null,
        usuarioId,
        forma: dados.forma,
        valor: money(dados.valor),
        desconto: money(dados.desconto),
        juros: money(dados.juros),
        pagoEm,
        observacoes: dados.observacoes || null,
      },
    });
    const novoPago = money(n(titulo.valorPago) + principal);
    const quitado = novoPago + 0.009 >= n(titulo.valorOriginal);
    const atualizado = await tx.tituloFinanceiro.update({ where: { id }, data: { valorPago: Math.min(n(titulo.valorOriginal), novoPago), status: quitado ? "PAGO" : "PARCIAL" } });

    if (titulo.pagamentoId && quitado) {
      await tx.pagamento.update({ where: { id: titulo.pagamentoId }, data: { status: "APROVADO", pagoEm } });
    }
    if (sessao) {
      await tx.movimentacaoCaixa.create({
        data: {
          sessaoCaixaId: sessao.id,
          usuarioId,
          tipo: titulo.tipo === "RECEBER" ? "RECEBIMENTO" : "SANGRIA",
          valor: money(dados.valor),
          descricao: `${titulo.tipo === "RECEBER" ? "Recebimento" : "Pagamento"} financeiro: ${titulo.descricao}`,
          referenciaTipo: "TITULO_FINANCEIRO",
          referenciaId: titulo.id,
        },
      });
    }
    await auditar(tx, { organizacaoId, empresaId, usuarioId, acao: "BAIXAR", entidade: "TITULO_FINANCEIRO", entidadeId: titulo.id, dadosNovos: { baixaId: baixa.id, valor: money(dados.valor), principal, status: atualizado.status } });
    return { titulo: atualizado, baixa };
  }, { maxWait: 10000, timeout: 30000 });
}

export async function cancelarTitulo({ organizacaoId, empresaId, usuarioId, id, motivo }) {
  return prisma.$transaction(async (tx) => {
    const titulo = await tx.tituloFinanceiro.findFirst({ where: { id, organizacaoId, empresaId } });
    if (!titulo) throw new Error("TITULO_NAO_ENCONTRADO");
    if (titulo.origem === "VENDA_FIADO") throw new Error("TITULO_FIADO_NAO_CANCELAVEL");
    if (n(titulo.valorPago) > 0) throw new Error("TITULO_COM_BAIXAS");
    if (titulo.status === "CANCELADO") return titulo;
    const atualizado = await tx.tituloFinanceiro.update({ where: { id }, data: { status: "CANCELADO", canceladoEm: new Date(), observacoes: [titulo.observacoes, `CANCELAMENTO: ${motivo}`].filter(Boolean).join("\n") } });
    await auditar(tx, { organizacaoId, empresaId, usuarioId, acao: "CANCELAR", entidade: "TITULO_FINANCEIRO", entidadeId: id, dadosNovos: { motivo } });
    return atualizado;
  });
}

export async function listarFiado({ organizacaoId, empresaId, busca }) {
  const titulos = await prisma.tituloFinanceiro.findMany({
    where: {
      organizacaoId, empresaId, tipo: "RECEBER", origem: "VENDA_FIADO", status: { not: "CANCELADO" },
      ...(busca ? { cliente: { nome: { contains: busca, mode: "insensitive" } } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { cliente: { select: { id: true, nome: true, telefone: true, whatsapp: true } }, venda: { select: { id: true, numero: true } }, baixas: true },
  });
  const map = new Map();
  for (const titulo of titulos) {
    const key = titulo.clienteId || "sem-cliente";
    if (!map.has(key)) map.set(key, { cliente: titulo.cliente, emAberto: 0, vencido: 0, recebido: 0, titulos: [] });
    const group = map.get(key);
    const item = tituloDecorado(titulo);
    group.emAberto += item.saldoAberto;
    if (item.vencido) group.vencido += item.saldoAberto;
    group.recebido += n(titulo.baixas?.reduce((sum, b) => sum + n(b.valor), 0));
    group.titulos.push(item);
  }
  return [...map.values()].map((item) => ({ ...item, emAberto: money(item.emAberto), vencido: money(item.vencido), recebido: money(item.recebido) })).sort((a,b) => b.emAberto - a.emAberto);
}

export async function referencias({ organizacaoId, empresaId }) {
  const [clientes, fornecedores, entradas, sessaoCaixa] = await Promise.all([
    prisma.cliente.findMany({ where: { organizacaoId, ativo: true }, orderBy: { nome: "asc" }, take: 300, select: { id: true, nome: true } }),
    prisma.fornecedor.findMany({ where: { organizacaoId, ativo: true }, orderBy: { nomeFantasia: "asc" }, take: 300, select: { id: true, nomeFantasia: true } }),
    prisma.entradaEstoque.findMany({ where: { empresaId, status: "CONCLUIDA" }, orderBy: { dataEntrada: "desc" }, take: 80, include: { fornecedor: { select: { id: true, nomeFantasia: true } }, titulosFinanceiros: { where: { status: { not: "CANCELADO" } }, select: { valorOriginal: true } } } }),
    prisma.sessaoCaixa.findFirst({ where: { status: "ABERTO", caixa: { empresaId, ativo: true } }, orderBy: { dataAbertura: "desc" }, include: { caixa: true } }),
  ]);
  return {
    clientes,
    fornecedores,
    entradas: entradas.map((entrada) => ({ ...entrada, valorComprometido: money(entrada.titulosFinanceiros.reduce((sum, t) => sum + n(t.valorOriginal), 0)), saldoSemTitulo: money(Math.max(0, n(entrada.valorTotal) - entrada.titulosFinanceiros.reduce((sum,t) => sum+n(t.valorOriginal),0))) })),
    sessaoCaixa,
  };
}

export async function resumo({ organizacaoId, empresaId, usuarioId, escopo, dataInicio, dataFim }) {
  const ids = await scopeCompanyIds({ empresaId, organizacaoId, usuarioId, escopo });
  const { inicio, fim } = defaultPeriod(dataInicio, dataFim);
  if (!ids.length) return { periodo: { inicio, fim }, empresas: [], faturamento: 0, receitasRealizadas: 0, despesasPagas: 0, saldoPeriodo: 0, receberAberto: 0, pagarAberto: 0, receberVencido: 0, pagarVencido: 0, formasPagamento: [] };
  const hoje = startOfDay();
  const [vendas, pagamentos, baixasReceber, baixasPagar, titulosAbertos, formas, empresas] = await Promise.all([
    prisma.venda.aggregate({ where: { empresaId: { in: ids }, status: "FINALIZADA", finalizadaEm: { gte: inicio, lte: fim } }, _sum: { valorTotal: true }, _count: { id: true } }),
    prisma.pagamento.aggregate({ where: { venda: { empresaId: { in: ids } }, status: "APROVADO", forma: { not: "CREDITO_CLIENTE" }, pagoEm: { gte: inicio, lte: fim } }, _sum: { valor: true } }),
    prisma.baixaFinanceira.aggregate({ where: { titulo: { empresaId: { in: ids }, tipo: "RECEBER" }, pagoEm: { gte: inicio, lte: fim } }, _sum: { valor: true } }),
    prisma.baixaFinanceira.aggregate({ where: { titulo: { empresaId: { in: ids }, tipo: "PAGAR" }, pagoEm: { gte: inicio, lte: fim } }, _sum: { valor: true } }),
    prisma.tituloFinanceiro.findMany({ where: { empresaId: { in: ids }, status: { in: ["PENDENTE","PARCIAL"] } }, select: { tipo: true, valorOriginal: true, valorPago: true, vencimentoEm: true } }),
    prisma.pagamento.groupBy({ by: ["forma"], where: { venda: { empresaId: { in: ids } }, status: "APROVADO", forma: { not: "CREDITO_CLIENTE" }, pagoEm: { gte: inicio, lte: fim } }, _sum: { valor: true }, _count: { id: true } }),
    prisma.empresa.findMany({ where: { id: { in: ids } }, select: { id: true, nomeFantasia: true } }),
  ]);
  let receberAberto=0,pagarAberto=0,receberVencido=0,pagarVencido=0;
  for (const t of titulosAbertos) {
    const saldo = Math.max(0, n(t.valorOriginal)-n(t.valorPago));
    const vencido = t.vencimentoEm && new Date(t.vencimentoEm) < hoje;
    if (t.tipo === "RECEBER") { receberAberto += saldo; if (vencido) receberVencido += saldo; }
    else { pagarAberto += saldo; if (vencido) pagarVencido += saldo; }
  }
  const online = await prisma.transacaoOnline.aggregate({ where: { empresaId: { in: ids }, status: "APROVADO", aprovadoEm: { gte: inicio, lte: fim } }, _sum: { valor: true } });
  const receitasRealizadas = money(n(pagamentos._sum.valor) + n(baixasReceber._sum.valor) + n(online._sum.valor));
  const despesasPagas = money(baixasPagar._sum.valor);
  const porEmpresa = await Promise.all(empresas.map(async (empresa) => {
    const [fat, recVenda, recTitulo, desp, recOnline] = await Promise.all([
      prisma.venda.aggregate({ where: { empresaId: empresa.id, status: "FINALIZADA", finalizadaEm: { gte: inicio, lte: fim } }, _sum: { valorTotal: true } }),
      prisma.pagamento.aggregate({ where: { venda: { empresaId: empresa.id }, status: "APROVADO", forma: { not: "CREDITO_CLIENTE" }, pagoEm: { gte: inicio, lte: fim } }, _sum: { valor: true } }),
      prisma.baixaFinanceira.aggregate({ where: { titulo: { empresaId: empresa.id, tipo: "RECEBER" }, pagoEm: { gte: inicio, lte: fim } }, _sum: { valor: true } }),
      prisma.baixaFinanceira.aggregate({ where: { titulo: { empresaId: empresa.id, tipo: "PAGAR" }, pagoEm: { gte: inicio, lte: fim } }, _sum: { valor: true } }),
      prisma.transacaoOnline.aggregate({ where: { empresaId: empresa.id, status: "APROVADO", aprovadoEm: { gte: inicio, lte: fim } }, _sum: { valor: true } }),
    ]);
    const receitas = money(n(recVenda._sum.valor)+n(recTitulo._sum.valor)+n(recOnline._sum.valor));
    return { ...empresa, faturamento: money(fat._sum.valorTotal), receitas, despesas: money(desp._sum.valor), saldo: money(receitas-n(desp._sum.valor)) };
  }));
  return {
    periodo: { inicio, fim },
    vendas: vendas._count.id,
    faturamento: money(vendas._sum.valorTotal),
    receitasRealizadas,
    despesasPagas,
    saldoPeriodo: money(receitasRealizadas - despesasPagas),
    receberAberto: money(receberAberto), pagarAberto: money(pagarAberto), receberVencido: money(receberVencido), pagarVencido: money(pagarVencido),
    formasPagamento: formas.map((item) => ({ forma: item.forma, valor: money(item._sum.valor), quantidade: item._count.id })),
    empresas: porEmpresa,
  };
}

export async function fluxo({ organizacaoId, empresaId, usuarioId, escopo, dataInicio, dataFim }) {
  const ids = await scopeCompanyIds({ empresaId, organizacaoId, usuarioId, escopo });
  const { inicio, fim } = defaultPeriod(dataInicio, dataFim);
  if (!ids.length) return [];
  const [pagamentos, baixas, online] = await Promise.all([
    prisma.pagamento.findMany({ where: { venda: { empresaId: { in: ids } }, status: "APROVADO", forma: { not: "CREDITO_CLIENTE" }, pagoEm: { gte: inicio, lte: fim } }, include: { venda: { include: { empresa: { select: { id:true,nomeFantasia:true } }, cliente: { select: { nome:true } } } } } }),
    prisma.baixaFinanceira.findMany({ where: { titulo: { empresaId: { in: ids } }, pagoEm: { gte: inicio, lte: fim } }, include: { titulo: { include: { empresa: { select: { id:true,nomeFantasia:true } }, cliente: { select:{nome:true} }, fornecedor: { select:{nomeFantasia:true} } } }, contaFinanceira: { select: { id:true,nome:true } } } }),
    prisma.transacaoOnline.findMany({ where: { empresaId: { in: ids }, status: "APROVADO", aprovadoEm: { gte: inicio, lte: fim } }, include: { empresa: { select: { id:true,nomeFantasia:true } }, cliente: { select: { nome:true } } } }),
  ]);
  const rows = [];
  for (const p of pagamentos) rows.push({ origem:"VENDA", origemId:p.id, data:p.pagoEm||p.createdAt, direcao:"ENTRADA", descricao:`Venda #${p.venda.numero}${p.venda.cliente?.nome ? ` · ${p.venda.cliente.nome}`:""}`, forma:p.forma, valor:money(p.valor), empresa:p.venda.empresa });
  for (const b of baixas) rows.push({ origem:b.titulo.tipo === "RECEBER" ? "RECEBIMENTO":"PAGAMENTO", origemId:b.id, data:b.pagoEm, direcao:b.titulo.tipo === "RECEBER" ? "ENTRADA":"SAIDA", descricao:b.titulo.descricao, forma:b.forma, valor:money(b.valor), empresa:b.titulo.empresa, contaFinanceira:b.contaFinanceira, pessoa:b.titulo.cliente?.nome||b.titulo.fornecedor?.nomeFantasia||null });
  for (const t of online) rows.push({ origem:"ONLINE", origemId:t.id, data:t.aprovadoEm||t.createdAt, direcao:"ENTRADA", descricao:`Pagamento online · ${t.cliente?.nome||"Cliente"}`, forma:t.forma, valor:money(t.valor), empresa:t.empresa });
  return rows.sort((a,b) => new Date(b.data)-new Date(a.data));
}

async function sourceForReconciliation(tx, { empresaId, origem, origemId }) {
  if (origem === "PAGAMENTO_VENDA") {
    const p = await tx.pagamento.findFirst({ where: { id: origemId, venda: { empresaId }, status: "APROVADO", forma: { not: "CREDITO_CLIENTE" } }, include: { venda: true } });
    if (!p) throw new Error("MOVIMENTO_NAO_ENCONTRADO");
    return { direcao:"ENTRADA", valor:n(p.valor), data:p.pagoEm||p.createdAt, descricao:`Venda #${p.venda.numero} · ${p.forma}` };
  }
  if (origem === "BAIXA_TITULO") {
    const b = await tx.baixaFinanceira.findFirst({ where: { id: origemId, titulo: { empresaId } }, include: { titulo: true } });
    if (!b) throw new Error("MOVIMENTO_NAO_ENCONTRADO");
    return { direcao:b.titulo.tipo === "RECEBER" ? "ENTRADA":"SAIDA", valor:n(b.valor), data:b.pagoEm, descricao:b.titulo.descricao };
  }
  if (origem === "TRANSACAO_ONLINE") {
    const t = await tx.transacaoOnline.findFirst({ where: { id: origemId, empresaId, status:"APROVADO" } });
    if (!t) throw new Error("MOVIMENTO_NAO_ENCONTRADO");
    return { direcao:"ENTRADA", valor:n(t.valor), data:t.aprovadoEm||t.createdAt, descricao:`Pagamento online · ${t.forma}` };
  }
  throw new Error("MOVIMENTO_NAO_ENCONTRADO");
}

export async function pendentesConciliacao({ empresaId, limite=150 }) {
  const conciliados = await prisma.conciliacaoFinanceira.findMany({ where: { empresaId }, select: { origem:true, origemId:true } });
  const done = new Set(conciliados.map((c)=>`${c.origem}:${c.origemId}`));
  const [pagamentos, baixas, online] = await Promise.all([
    prisma.pagamento.findMany({ where: { venda:{empresaId},status:"APROVADO",forma:{not:"CREDITO_CLIENTE"} }, orderBy:{pagoEm:"desc"},take:limite,include:{venda:{select:{numero:true}},sessaoCaixa:{include:{caixa:true}}} }),
    prisma.baixaFinanceira.findMany({ where:{titulo:{empresaId}},orderBy:{pagoEm:"desc"},take:limite,include:{titulo:true,contaFinanceira:true} }),
    prisma.transacaoOnline.findMany({ where:{empresaId,status:"APROVADO"},orderBy:{aprovadoEm:"desc"},take:limite }),
  ]);
  const out=[];
  for(const p of pagamentos){ if(!done.has(`PAGAMENTO_VENDA:${p.id}`)) out.push({origem:"PAGAMENTO_VENDA",origemId:p.id,direcao:"ENTRADA",data:p.pagoEm||p.createdAt,descricao:`Venda #${p.venda.numero} · ${p.forma}`,valor:money(p.valor),sugestaoConta:p.forma==="DINHEIRO"?"DINHEIRO":null}); }
  for(const b of baixas){ if(!done.has(`BAIXA_TITULO:${b.id}`)) out.push({origem:"BAIXA_TITULO",origemId:b.id,direcao:b.titulo.tipo==="RECEBER"?"ENTRADA":"SAIDA",data:b.pagoEm,descricao:b.titulo.descricao,valor:money(b.valor),contaFinanceira:b.contaFinanceira}); }
  for(const t of online){ if(!done.has(`TRANSACAO_ONLINE:${t.id}`)) out.push({origem:"TRANSACAO_ONLINE",origemId:t.id,direcao:"ENTRADA",data:t.aprovadoEm||t.createdAt,descricao:`Pagamento online · ${t.forma}`,valor:money(t.valor)}); }
  return out.sort((a,b)=>new Date(b.data)-new Date(a.data)).slice(0,limite);
}

export async function conciliar({ organizacaoId, empresaId, usuarioId, dados }) {
  return prisma.$transaction(async (tx) => {
    const conta = await tx.contaFinanceira.findFirst({ where:{id:dados.contaFinanceiraId,empresaId,ativo:true} });
    if(!conta) throw new Error("CONTA_NAO_ENCONTRADA");
    const source = await sourceForReconciliation(tx,{empresaId,origem:dados.origem,origemId:dados.origemId});
    const conciliacao = await tx.conciliacaoFinanceira.create({data:{empresaId,contaFinanceiraId:conta.id,usuarioId,origem:dados.origem,origemId:dados.origemId,direcao:source.direcao,valor:money(source.valor),dataMovimento:source.data,descricao:source.descricao}});
    await auditar(tx,{organizacaoId,empresaId,usuarioId,acao:"CONCILIAR",entidade:"CONCILIACAO_FINANCEIRA",entidadeId:conciliacao.id,dadosNovos:{origem:dados.origem,origemId:dados.origemId,conta:conta.nome,valor:money(source.valor)}});
    return conciliacao;
  });
}

export async function listarConciliacoes(empresaId) {
  return prisma.conciliacaoFinanceira.findMany({ where:{empresaId}, orderBy:{conciliadoEm:"desc"}, take:150, include:{contaFinanceira:true,usuario:{select:{id:true,nome:true}}} });
}

export async function desconciliar({ organizacaoId, empresaId, usuarioId, id }) {
  return prisma.$transaction(async(tx)=>{
    const atual=await tx.conciliacaoFinanceira.findFirst({where:{id,empresaId}});
    if(!atual) throw new Error("CONCILIACAO_NAO_ENCONTRADA");
    await tx.conciliacaoFinanceira.delete({where:{id}});
    await auditar(tx,{organizacaoId,empresaId,usuarioId,acao:"DESCONCILIAR",entidade:"CONCILIACAO_FINANCEIRA",entidadeId:id,dadosNovos:{origem:atual.origem,origemId:atual.origemId}});
    return atual;
  });
}

export async function relatorioGerencial({ organizacaoId, empresaId, usuarioId, escopo, dataInicio, dataFim }) {
  const summary = await resumo({ organizacaoId, empresaId, usuarioId, escopo, dataInicio, dataFim });
  const ids = await scopeCompanyIds({ empresaId, organizacaoId, usuarioId, escopo });
  const { inicio, fim } = defaultPeriod(dataInicio, dataFim);
  const categorias = await prisma.baixaFinanceira.findMany({
    where:{titulo:{empresaId:{in:ids}},pagoEm:{gte:inicio,lte:fim}},
    select:{valor:true,titulo:{select:{tipo:true,categoria:{select:{id:true,nome:true}}}}},
  });
  const byCategory=new Map();
  for(const b of categorias){const key=`${b.titulo.tipo}:${b.titulo.categoria?.id||"SEM"}`;const row=byCategory.get(key)||{tipo:b.titulo.tipo,categoria:b.titulo.categoria?.nome||"Sem categoria",valor:0};row.valor+=n(b.valor);byCategory.set(key,row);}
  return { ...summary, categorias:[...byCategory.values()].map((r)=>({...r,valor:money(r.valor)})).sort((a,b)=>b.valor-a.valor) };
}

// Helper usado pelo PDV. Mantém o título de fiado e o Pagamento vinculados na mesma transação.
export async function criarRecebivelFiadoNoTx(tx,{organizacaoId,empresaId,clienteId,venda,pagamento,vencimentoEm,descricao}){
  if(!clienteId) throw new Error("CLIENTE_OBRIGATORIO_CREDITO");
  const existe=await tx.tituloFinanceiro.findUnique({where:{pagamentoId:pagamento.id}});
  if(existe) return existe;
  let due = vencimentoEm ? dateOnly(vencimentoEm) : new Date();
  if(!vencimentoEm) due.setDate(due.getDate()+30);
  return tx.tituloFinanceiro.create({data:{organizacaoId,empresaId,tipo:"RECEBER",status:"PENDENTE",origem:"VENDA_FIADO",clienteId,vendaId:venda.id,pagamentoId:pagamento.id,descricao:descricao||`Venda #${venda.numero} · Fiado`,emissaoEm:new Date(),vencimentoEm:due,valorOriginal:money(pagamento.valor),valorPago:0}});
}
