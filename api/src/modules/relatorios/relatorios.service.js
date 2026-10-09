import prisma from "../../config/prisma.js";

function num(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  return Math.round((num(value) + Number.EPSILON) * 100) / 100;
}

function startOfDay(value) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value) {
  const date = value ? new Date(`${value}T23:59:59.999`) : new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function defaultPeriod(dataInicio, dataFim) {
  if (dataInicio || dataFim) {
    return { inicio: startOfDay(dataInicio), fim: endOfDay(dataFim) };
  }
  const now = new Date();
  return {
    inicio: new Date(now.getFullYear(), now.getMonth(), 1),
    fim: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

function dateKey(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function percent(part, total) {
  return total > 0 ? Math.round((part / total) * 10000) / 100 : 0;
}

function daysBetween(start, end) {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
}

function previousPeriod(inicio, fim) {
  const duration = fim.getTime() - inicio.getTime();
  const prevFim = new Date(inicio.getTime() - 1);
  const prevInicio = new Date(prevFim.getTime() - duration);
  return { inicio: prevInicio, fim: prevFim };
}

function variation(current, previous) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 10000) / 100;
}

function reportErrorInfo(error) {
  const code = error?.code || null;
  if (code === "P2021") {
    return {
      code,
      message: "Tabela necessária para este indicador ainda não existe no banco. Verifique as migrations pendentes.",
    };
  }
  if (code === "P2022") {
    return {
      code,
      message: "O banco ainda não possui uma coluna exigida por este indicador. Verifique as migrations pendentes.",
    };
  }
  return { code, message: "Não foi possível calcular esta seção agora." };
}

async function safeSection(section, loader, fallback, warnings) {
  try {
    return await loader();
  } catch (error) {
    const info = reportErrorInfo(error);
    console.error(`[Relatórios:${section}] falha isolada`, {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    warnings.push({ secao: section, codigo: info.code, mensagem: info.message });
    return typeof fallback === "function" ? fallback() : fallback;
  }
}

async function scopeCompanies({ empresaId, organizacaoId, usuarioId, escopo }) {
  if (String(escopo).toLowerCase() !== "organizacao") {
    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true, nomeFantasia: true, tipo: true, cnpj: true },
    });
    return empresa ? [empresa] : [];
  }

  const links = await prisma.usuarioEmpresa.findMany({
    where: {
      usuarioId,
      ativo: true,
      empresa: { organizacaoId, ativo: true },
      cargo: {
        permissoes: {
          some: { permissao: { codigo: "relatorios.visualizar" } },
        },
      },
    },
    select: {
      empresa: { select: { id: true, nomeFantasia: true, tipo: true, cnpj: true } },
    },
  });

  return links.map((item) => item.empresa).sort((a, b) => a.nomeFantasia.localeCompare(b.nomeFantasia, "pt-BR"));
}

function aggregateSales(vendas) {
  const paymentMap = new Map();
  const typeMap = new Map();
  const categoryMap = new Map();
  const itemMap = new Map();
  const customerMap = new Map();
  const companyMap = new Map();
  const dailyMap = new Map();

  let faturamento = 0;
  let descontos = 0;
  let acrescimos = 0;
  let unidades = 0;

  for (const venda of vendas) {
    const total = num(venda.valorTotal);
    faturamento += total;
    descontos += num(venda.desconto);
    acrescimos += num(venda.acrescimo);

    const day = dateKey(venda.finalizadaEm || venda.createdAt);
    const daily = dailyMap.get(day) || { data: day, faturamento: 0, vendas: 0 };
    daily.faturamento += total;
    daily.vendas += 1;
    dailyMap.set(day, daily);

    const companyKey = venda.empresa?.id || venda.empresaId;
    const companyRow = companyMap.get(companyKey) || {
      empresaId: companyKey,
      empresa: venda.empresa?.nomeFantasia || "Empresa",
      faturamento: 0,
      vendas: 0,
    };
    companyRow.faturamento += total;
    companyRow.vendas += 1;
    companyMap.set(companyKey, companyRow);

    if (venda.cliente) {
      const current = customerMap.get(venda.cliente.id) || {
        id: venda.cliente.id,
        nome: venda.cliente.nome,
        telefone: venda.cliente.whatsapp || venda.cliente.telefone || null,
        faturamento: 0,
        compras: 0,
      };
      current.faturamento += total;
      current.compras += 1;
      customerMap.set(venda.cliente.id, current);
    }

    for (const payment of venda.pagamentos || []) {
      if (payment.status !== "APROVADO") continue;
      const row = paymentMap.get(payment.forma) || { forma: payment.forma, valor: 0, quantidade: 0 };
      row.valor += num(payment.valor);
      row.quantidade += 1;
      paymentMap.set(payment.forma, row);
    }

    for (const item of venda.itens || []) {
      const quantity = num(item.quantidade);
      unidades += quantity;
      const catalog = item.itemCatalogo;
      const type = catalog?.tipo || "OUTRO";
      const itemTotal = num(item.valorTotal);
      const typeRow = typeMap.get(type) || { tipo: type, valor: 0, quantidade: 0 };
      typeRow.valor += itemTotal;
      typeRow.quantidade += quantity;
      typeMap.set(type, typeRow);

      const categoryName = catalog?.categoria?.nome || "Sem categoria";
      const categoryKey = `${type}:${categoryName}`;
      const categoryRow = categoryMap.get(categoryKey) || { tipo: type, categoria: categoryName, valor: 0, quantidade: 0 };
      categoryRow.valor += itemTotal;
      categoryRow.quantidade += quantity;
      categoryMap.set(categoryKey, categoryRow);

      const itemKey = catalog?.id || `snapshot:${item.descricao}`;
      const itemRow = itemMap.get(itemKey) || {
        id: catalog?.id || null,
        nome: catalog?.nome || item.descricao,
        tipo: type,
        categoria: categoryName,
        valor: 0,
        quantidade: 0,
      };
      itemRow.valor += itemTotal;
      itemRow.quantidade += quantity;
      itemMap.set(itemKey, itemRow);
    }
  }

  const decorate = (row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "number" ? money(value) : value]));
  return {
    faturamento: money(faturamento),
    descontos: money(descontos),
    acrescimos: money(acrescimos),
    vendas: vendas.length,
    ticketMedio: money(vendas.length ? faturamento / vendas.length : 0),
    unidades: money(unidades),
    clientesAtendidos: customerMap.size,
    pagamentos: [...paymentMap.values()].map(decorate).sort((a, b) => b.valor - a.valor),
    porTipo: [...typeMap.values()].map(decorate).sort((a, b) => b.valor - a.valor),
    categorias: [...categoryMap.values()].map(decorate).sort((a, b) => b.valor - a.valor),
    topItens: [...itemMap.values()].map(decorate).sort((a, b) => b.valor - a.valor).slice(0, 12),
    topClientes: [...customerMap.values()].map(decorate).sort((a, b) => b.faturamento - a.faturamento).slice(0, 12),
    empresas: [...companyMap.values()].map(decorate).sort((a, b) => b.faturamento - a.faturamento),
    evolucao: [...dailyMap.values()].map(decorate).sort((a, b) => a.data.localeCompare(b.data)),
  };
}

async function salesData(companyIds, inicio, fim) {
  return prisma.venda.findMany({
    where: {
      empresaId: { in: companyIds },
      status: "FINALIZADA",
      finalizadaEm: { gte: inicio, lte: fim },
    },
    select: {
      id: true,
      numero: true,
      empresaId: true,
      subtotal: true,
      desconto: true,
      acrescimo: true,
      valorTotal: true,
      createdAt: true,
      finalizadaEm: true,
      empresa: { select: { id: true, nomeFantasia: true } },
      cliente: { select: { id: true, nome: true, telefone: true, whatsapp: true } },
      itens: {
        select: {
          descricao: true,
          quantidade: true,
          valorUnitario: true,
          desconto: true,
          valorTotal: true,
          itemCatalogo: {
            select: {
              id: true,
              nome: true,
              tipo: true,
              categoria: { select: { nome: true } },
            },
          },
        },
      },
      pagamentos: {
        select: { forma: true, status: true, valor: true, pagoEm: true },
      },
    },
    orderBy: { finalizadaEm: "asc" },
  });
}

async function customerData({ organizacaoId, companyIds, inicio, fim, vendas }) {
  const [clientesAtivos, novosClientes, pets, primeiraCompraAnterior] = await Promise.all([
    prisma.cliente.count({ where: { organizacaoId, ativo: true } }),
    prisma.cliente.count({ where: { organizacaoId, ativo: true, createdAt: { gte: inicio, lte: fim } } }),
    prisma.pet.findMany({
      where: { ativo: true, cliente: { organizacaoId, ativo: true } },
      select: { id: true, especie: { select: { nome: true } } },
    }),
    prisma.venda.findMany({
      where: {
        empresaId: { in: companyIds },
        status: "FINALIZADA",
        finalizadaEm: { lt: inicio },
        clienteId: { not: null },
      },
      select: { clienteId: true },
      distinct: ["clienteId"],
    }),
  ]);

  const previousBuyerIds = new Set(primeiraCompraAnterior.map((row) => row.clienteId).filter(Boolean));
  const buyers = new Map();
  for (const venda of vendas) {
    if (!venda.cliente) continue;
    const row = buyers.get(venda.cliente.id) || { id: venda.cliente.id, nome: venda.cliente.nome, faturamento: 0, compras: 0 };
    row.faturamento += num(venda.valorTotal);
    row.compras += 1;
    buyers.set(venda.cliente.id, row);
  }

  const speciesMap = new Map();
  for (const pet of pets) {
    const name = pet.especie?.nome || "Não informada";
    speciesMap.set(name, (speciesMap.get(name) || 0) + 1);
  }

  const buyerRows = [...buyers.values()].map((row) => ({ ...row, faturamento: money(row.faturamento), recorrente: previousBuyerIds.has(row.id) }));
  const recorrentes = buyerRows.filter((row) => row.recorrente).length;

  return {
    clientesAtivos,
    novosClientes,
    compradoresPeriodo: buyerRows.length,
    clientesRecorrentes: recorrentes,
    taxaRecorrencia: percent(recorrentes, buyerRows.length),
    petsAtivos: pets.length,
    especies: [...speciesMap.entries()].map(([especie, quantidade]) => ({ especie, quantidade })).sort((a, b) => b.quantidade - a.quantidade),
    ranking: buyerRows.sort((a, b) => b.faturamento - a.faturamento).slice(0, 15),
  };
}

async function operationData(companyIds, inicio, fim) {
  const [clinic, groomingSchedules, groomingOrders, packages, packageConsumptions] = await Promise.all([
    prisma.atendimentoClinico.findMany({
      where: { empresaId: { in: companyIds }, createdAt: { gte: inicio, lte: fim } },
      select: { id: true, status: true, origem: true, iniciadoEm: true, finalizadoEm: true, veterinario: { select: { nome: true } } },
    }),
    prisma.agendamentoBanhoTosa.findMany({
      where: { empresaId: { in: companyIds }, inicio: { gte: inicio, lte: fim } },
      select: { id: true, status: true, origem: true, inicio: true, profissional: { select: { nome: true } } },
    }),
    prisma.ordemServicoBanhoTosa.findMany({
      where: { empresaId: { in: companyIds }, entrada: { gte: inicio, lte: fim } },
      select: { id: true, status: true, entrada: true, saida: true, profissional: { select: { nome: true } } },
    }),
    prisma.pacoteCliente.groupBy({
      by: ["status"],
      where: { empresaId: { in: companyIds } },
      _count: { _all: true },
    }),
    prisma.consumoPacote.count({
      where: { consumidoEm: { gte: inicio, lte: fim }, pacoteClienteItem: { pacoteCliente: { empresaId: { in: companyIds } } } },
    }),
  ]);

  const countBy = (rows, field) => {
    const map = new Map();
    for (const row of rows) map.set(row[field] || "NÃO INFORMADO", (map.get(row[field] || "NÃO INFORMADO") || 0) + 1);
    return [...map.entries()].map(([chave, quantidade]) => ({ chave, quantidade })).sort((a, b) => b.quantidade - a.quantidade);
  };

  const clinicFinished = clinic.filter((row) => row.status === "FINALIZADO");
  const clinicDurations = clinicFinished
    .filter((row) => row.iniciadoEm && row.finalizadoEm)
    .map((row) => Math.max(0, (new Date(row.finalizadoEm) - new Date(row.iniciadoEm)) / 60000));
  const groomingFinished = groomingOrders.filter((row) => ["ENTREGUE", "FINALIZADO", "AGUARDANDO_RETIRADA"].includes(row.status));
  const groomingDurations = groomingFinished
    .filter((row) => row.saida)
    .map((row) => Math.max(0, (new Date(row.saida) - new Date(row.entrada)) / 60000));

  const professionalMap = new Map();
  for (const row of groomingSchedules) {
    if (!row.profissional?.nome) continue;
    const data = professionalMap.get(row.profissional.nome) || { profissional: row.profissional.nome, agendamentos: 0 };
    data.agendamentos += 1;
    professionalMap.set(row.profissional.nome, data);
  }

  return {
    consultorio: {
      atendimentos: clinic.length,
      finalizados: clinicFinished.length,
      cancelados: clinic.filter((row) => row.status === "CANCELADO").length,
      tempoMedioMinutos: Math.round(clinicDurations.length ? clinicDurations.reduce((a, b) => a + b, 0) / clinicDurations.length : 0),
      status: countBy(clinic, "status"),
      origens: countBy(clinic, "origem"),
    },
    banhoTosa: {
      agendamentos: groomingSchedules.length,
      concluidos: groomingSchedules.filter((row) => row.status === "CONCLUIDO").length,
      faltas: groomingSchedules.filter((row) => row.status === "FALTOU").length,
      cancelados: groomingSchedules.filter((row) => row.status === "CANCELADO").length,
      taxaComparecimento: percent(groomingSchedules.filter((row) => !["FALTOU", "CANCELADO", "AGUARDANDO_PAGAMENTO"].includes(row.status)).length, groomingSchedules.length),
      tempoMedioMinutos: Math.round(groomingDurations.length ? groomingDurations.reduce((a, b) => a + b, 0) / groomingDurations.length : 0),
      status: countBy(groomingSchedules, "status"),
      origens: countBy(groomingSchedules, "origem"),
      profissionais: [...professionalMap.values()].sort((a, b) => b.agendamentos - a.agendamentos).slice(0, 10),
    },
    pacotes: {
      porStatus: packages.map((row) => ({ status: row.status, quantidade: row._count._all })),
      consumosPeriodo: packageConsumptions,
    },
  };
}

async function inventoryData(companyIds, inicio, fim) {
  const [products, lots, movements] = await Promise.all([
    prisma.produto.findMany({
      where: { item: { empresaId: { in: companyIds }, ativo: true } },
      select: {
        id: true,
        custoMedio: true,
        estoqueMinimo: true,
        controlaEstoque: true,
        item: { select: { nome: true, empresaId: true, empresa: { select: { nomeFantasia: true } } } },
        estoque: { select: { quantidade: true } },
      },
    }),
    prisma.loteProduto.findMany({
      where: { produto: { item: { empresaId: { in: companyIds }, ativo: true } }, quantidadeAtual: { gt: 0 }, dataValidade: { not: null } },
      select: { id: true, numeroLote: true, dataValidade: true, quantidadeAtual: true, produto: { select: { item: { select: { nome: true, empresa: { select: { nomeFantasia: true } } } } } } },
    }),
    prisma.movimentacaoEstoque.findMany({
      where: { empresaId: { in: companyIds }, createdAt: { gte: inicio, lte: fim } },
      select: { tipo: true, quantidade: true },
    }),
  ]);

  let valorEstoque = 0;
  let itensBaixos = 0;
  let zerados = 0;
  const lowRows = [];

  for (const product of products) {
    if (!product.controlaEstoque) continue;
    const qty = num(product.estoque?.quantidade);
    const min = num(product.estoqueMinimo);
    valorEstoque += qty * num(product.custoMedio);
    if (qty <= 0) zerados += 1;
    if (min > 0 && qty <= min) {
      itensBaixos += 1;
      lowRows.push({
        produto: product.item.nome,
        empresa: product.item.empresa.nomeFantasia,
        quantidade: money(qty),
        minimo: money(min),
      });
    }
  }

  const now = startOfDay();
  const next30 = new Date(now.getTime() + 30 * 86400000);
  const expired = lots.filter((lot) => new Date(lot.dataValidade) < now);
  const expiring = lots.filter((lot) => new Date(lot.dataValidade) >= now && new Date(lot.dataValidade) <= next30);

  const movementMap = new Map();
  for (const movement of movements) {
    const row = movementMap.get(movement.tipo) || { tipo: movement.tipo, quantidade: 0, movimentos: 0 };
    row.quantidade += Math.abs(num(movement.quantidade));
    row.movimentos += 1;
    movementMap.set(movement.tipo, row);
  }

  return {
    produtosControlados: products.filter((p) => p.controlaEstoque).length,
    valorEstoque: money(valorEstoque),
    itensEstoqueBaixo: itensBaixos,
    itensZerados: zerados,
    lotesVencidos: expired.length,
    lotesVencendo30Dias: expiring.length,
    estoqueBaixo: lowRows.sort((a, b) => a.quantidade - b.quantidade).slice(0, 15),
    validade: [...expired.map((lot) => ({ ...lot, situacao: "VENCIDO" })), ...expiring.map((lot) => ({ ...lot, situacao: "VENCE_EM_30_DIAS" }))]
      .sort((a, b) => new Date(a.dataValidade) - new Date(b.dataValidade))
      .slice(0, 15)
      .map((lot) => ({
        id: lot.id,
        produto: lot.produto.item.nome,
        empresa: lot.produto.item.empresa.nomeFantasia,
        lote: lot.numeroLote,
        validade: lot.dataValidade,
        quantidade: money(lot.quantidadeAtual),
        situacao: lot.situacao,
      })),
    movimentos: [...movementMap.values()].map((row) => ({ ...row, quantidade: money(row.quantidade) })).sort((a, b) => b.movimentos - a.movimentos),
  };
}

async function financeData(companyIds, inicio, fim) {
  const [settlements, titles, conciliations] = await Promise.all([
    prisma.baixaFinanceira.findMany({
      where: { titulo: { empresaId: { in: companyIds } }, pagoEm: { gte: inicio, lte: fim } },
      select: { valor: true, desconto: true, juros: true, forma: true, titulo: { select: { tipo: true, categoria: { select: { nome: true } }, empresa: { select: { nomeFantasia: true } } } } },
    }),
    prisma.tituloFinanceiro.findMany({
      where: { empresaId: { in: companyIds }, status: { in: ["PENDENTE", "PARCIAL"] } },
      select: { tipo: true, status: true, valorOriginal: true, valorPago: true, vencimentoEm: true },
    }),
    prisma.conciliacaoFinanceira.count({ where: { empresaId: { in: companyIds }, conciliadoEm: { gte: inicio, lte: fim } } }),
  ]);

  let recebimentos = 0;
  let pagamentos = 0;
  const categoryMap = new Map();
  const formMap = new Map();
  for (const row of settlements) {
    const value = num(row.valor) + num(row.juros) - num(row.desconto);
    if (row.titulo.tipo === "RECEBER") recebimentos += value;
    else pagamentos += value;

    const category = row.titulo.categoria?.nome || "Sem categoria";
    const key = `${row.titulo.tipo}:${category}`;
    const categoryRow = categoryMap.get(key) || { tipo: row.titulo.tipo, categoria: category, valor: 0 };
    categoryRow.valor += value;
    categoryMap.set(key, categoryRow);

    const form = row.forma || "NÃO INFORMADA";
    const formRow = formMap.get(form) || { forma: form, valor: 0, quantidade: 0 };
    formRow.valor += value;
    formRow.quantidade += 1;
    formMap.set(form, formRow);
  }

  const today = startOfDay();
  let receberAberto = 0;
  let pagarAberto = 0;
  let receberVencido = 0;
  let pagarVencido = 0;
  for (const title of titles) {
    const open = Math.max(0, num(title.valorOriginal) - num(title.valorPago));
    const overdue = title.vencimentoEm && new Date(title.vencimentoEm) < today;
    if (title.tipo === "RECEBER") {
      receberAberto += open;
      if (overdue) receberVencido += open;
    } else {
      pagarAberto += open;
      if (overdue) pagarVencido += open;
    }
  }

  return {
    recebimentos: money(recebimentos),
    pagamentos: money(pagamentos),
    resultado: money(recebimentos - pagamentos),
    receberAberto: money(receberAberto),
    pagarAberto: money(pagarAberto),
    receberVencido: money(receberVencido),
    pagarVencido: money(pagarVencido),
    conciliacoesPeriodo: conciliations,
    categorias: [...categoryMap.values()].map((row) => ({ ...row, valor: money(row.valor) })).sort((a, b) => b.valor - a.valor),
    formas: [...formMap.values()].map((row) => ({ ...row, valor: money(row.valor) })).sort((a, b) => b.valor - a.valor),
  };
}

async function fiscalData(companyIds, inicio, fim) {
  let docs;
  try {
    docs = await prisma.documentoFiscal.findMany({
      where: { empresaId: { in: companyIds }, createdAt: { gte: inicio, lte: fim } },
      select: { id: true, tipo: true, status: true, simulado: true, valorTotal: true, emitidoEm: true, createdAt: true, empresa: { select: { nomeFantasia: true } } },
    });
  } catch (error) {
    // Compatibilidade defensiva: se a Fase 13 ainda não tiver sido aplicada no banco,
    // as colunas novas de DocumentoFiscal (como `simulado`) podem não existir.
    // O relatório continua funcionando com os campos legados e o restante da API
    // ainda sinaliza a migration pendente pelos logs.
    if (error?.code !== "P2022") throw error;
    console.warn("[Relatórios:fiscal] usando leitura compatível com schema fiscal legado", { code: error?.code, meta: error?.meta });
    docs = await prisma.documentoFiscal.findMany({
      where: { empresaId: { in: companyIds }, createdAt: { gte: inicio, lte: fim } },
      select: { id: true, tipo: true, status: true, valorTotal: true, emitidoEm: true, createdAt: true, empresa: { select: { nomeFantasia: true } } },
    });
    docs = docs.map((doc) => ({ ...doc, simulado: false }));
  }

  const statusMap = new Map();
  const typeMap = new Map();
  let autorizado = 0;
  let erros = 0;
  let valorAutorizado = 0;
  for (const doc of docs) {
    statusMap.set(doc.status, (statusMap.get(doc.status) || 0) + 1);
    typeMap.set(doc.tipo, (typeMap.get(doc.tipo) || 0) + 1);
    if (doc.status === "AUTORIZADO") {
      autorizado += 1;
      valorAutorizado += num(doc.valorTotal);
    }
    if (["ERRO", "REJEITADO"].includes(doc.status)) erros += 1;
  }
  return {
    documentos: docs.length,
    autorizados: autorizado,
    pendentes: docs.filter((doc) => ["PENDENTE", "PROCESSANDO"].includes(doc.status)).length,
    erros,
    taxaAutorizacao: percent(autorizado, docs.length),
    valorAutorizado: money(valorAutorizado),
    simulados: docs.filter((doc) => doc.simulado).length,
    porStatus: [...statusMap.entries()].map(([status, quantidade]) => ({ status, quantidade })).sort((a, b) => b.quantidade - a.quantidade),
    porTipo: [...typeMap.entries()].map(([tipo, quantidade]) => ({ tipo, quantidade })).sort((a, b) => b.quantidade - a.quantidade),
  };
}

async function dashboardComparison(companyIds, inicio, fim, currentSales) {
  const prev = previousPeriod(inicio, fim);
  const prevSales = await salesData(companyIds, prev.inicio, prev.fim);
  const current = aggregateSales(currentSales);
  const previous = aggregateSales(prevSales);
  return {
    faturamento: variation(current.faturamento, previous.faturamento),
    vendas: variation(current.vendas, previous.vendas),
    ticketMedio: variation(current.ticketMedio, previous.ticketMedio),
    clientesAtendidos: variation(current.clientesAtendidos, previous.clientesAtendidos),
    periodoAnterior: { inicio: prev.inicio, fim: prev.fim },
  };
}

export async function gerarPainel({ organizacaoId, empresaId, usuarioId, escopo, dataInicio, dataFim }) {
  const { inicio, fim } = defaultPeriod(dataInicio, dataFim);
  const empresas = await scopeCompanies({ empresaId, organizacaoId, usuarioId, escopo });
  const companyIds = empresas.map((empresa) => empresa.id);
  const avisos = [];

  if (!companyIds.length) {
    return {
      periodo: { inicio, fim, dias: daysBetween(inicio, fim) },
      escopo: "empresa",
      empresas: [],
      vendas: aggregateSales([]),
      clientes: {},
      operacao: {},
      estoque: {},
      financeiro: {},
      fiscal: {},
      comparativo: {},
      avisos,
    };
  }

  // O relatório consulta muitos módulos. Em PostgreSQL remoto, disparar tudo de uma vez
  // pode gerar picos de conexões e qualquer falha isolada derrubava a tela inteira.
  // A partir do Hotfix 14.1, cada seção é calculada e isolada independentemente.
  const vendasRaw = await safeSection("Vendas", () => salesData(companyIds, inicio, fim), [], avisos);
  const vendas = aggregateSales(vendasRaw);

  const clientes = await safeSection(
    "Clientes",
    () => customerData({ organizacaoId, companyIds, inicio, fim, vendas: vendasRaw }),
    { clientesAtivos: 0, novosClientes: 0, compradoresPeriodo: 0, clientesRecorrentes: 0, taxaRecorrencia: 0, petsAtivos: 0, especies: [], ranking: [] },
    avisos,
  );

  const operacao = await safeSection(
    "Operação",
    () => operationData(companyIds, inicio, fim),
    { consultorio: {}, banhoTosa: {}, pacotes: {} },
    avisos,
  );

  const estoque = await safeSection(
    "Estoque",
    () => inventoryData(companyIds, inicio, fim),
    { produtosControlados: 0, valorEstoque: 0, itensEstoqueBaixo: 0, itensZerados: 0, lotesVencidos: 0, lotesVencendo30Dias: 0, estoqueBaixo: [], validade: [], movimentos: [] },
    avisos,
  );

  const financeiro = await safeSection(
    "Financeiro",
    () => financeData(companyIds, inicio, fim),
    { recebimentos: 0, pagamentos: 0, resultado: 0, receberAberto: 0, pagarAberto: 0, receberVencido: 0, pagarVencido: 0, conciliacoesPeriodo: 0, categorias: [], formas: [] },
    avisos,
  );

  const fiscal = await safeSection(
    "Fiscal",
    () => fiscalData(companyIds, inicio, fim),
    { documentos: 0, autorizados: 0, pendentes: 0, erros: 0, taxaAutorizacao: 0, valorAutorizado: 0, simulados: 0, porStatus: [], porTipo: [] },
    avisos,
  );

  const comparativo = await safeSection(
    "Comparativo",
    () => dashboardComparison(companyIds, inicio, fim, vendasRaw),
    { faturamento: 0, vendas: 0, ticketMedio: 0, clientesAtendidos: 0 },
    avisos,
  );

  const canceladas = await safeSection(
    "Vendas canceladas",
    () => prisma.venda.count({ where: { empresaId: { in: companyIds }, status: { in: ["CANCELADA", "ESTORNADA"] }, createdAt: { gte: inicio, lte: fim } } }),
    0,
    avisos,
  );

  return {
    periodo: { inicio, fim, dias: daysBetween(inicio, fim) },
    escopo: String(escopo).toLowerCase() === "organizacao" ? "organizacao" : "empresa",
    empresas,
    vendas: { ...vendas, canceladas },
    clientes,
    operacao,
    estoque,
    financeiro,
    fiscal,
    comparativo,
    avisos,
  };
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(rows) {
  return rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}

export async function exportarCsv({ organizacaoId, empresaId, usuarioId, escopo, dataInicio, dataFim, tipo }) {
  const dados = await gerarPainel({ organizacaoId, empresaId, usuarioId, escopo, dataInicio, dataFim });
  const suffix = `${dateKey(dados.periodo.inicio)}_${dateKey(dados.periodo.fim)}`;

  if (tipo === "vendas") {
    const rows = [["Item", "Tipo", "Categoria", "Quantidade", "Faturamento"]];
    for (const item of dados.vendas.topItens) rows.push([item.nome, item.tipo, item.categoria, item.quantidade, item.valor]);
    return { nome: `petrise-relatorio-vendas-${suffix}.csv`, conteudo: csv(rows) };
  }

  if (tipo === "clientes") {
    const rows = [["Cliente", "Compras", "Faturamento", "Recorrente"]];
    for (const item of dados.clientes.ranking || []) rows.push([item.nome, item.compras, item.faturamento, item.recorrente ? "Sim" : "Não"]);
    return { nome: `petrise-relatorio-clientes-${suffix}.csv`, conteudo: csv(rows) };
  }

  if (tipo === "estoque") {
    const rows = [["Produto", "Empresa", "Saldo", "Estoque mínimo"]];
    for (const item of dados.estoque.estoqueBaixo || []) rows.push([item.produto, item.empresa, item.quantidade, item.minimo]);
    return { nome: `petrise-relatorio-estoque-${suffix}.csv`, conteudo: csv(rows) };
  }

  if (tipo === "financeiro") {
    const rows = [["Tipo", "Categoria", "Valor"]];
    for (const item of dados.financeiro.categorias || []) rows.push([item.tipo, item.categoria, item.valor]);
    return { nome: `petrise-relatorio-financeiro-${suffix}.csv`, conteudo: csv(rows) };
  }

  if (tipo === "fiscal") {
    const rows = [["Status", "Quantidade"]];
    for (const item of dados.fiscal.porStatus || []) rows.push([item.status, item.quantidade]);
    return { nome: `petrise-relatorio-fiscal-${suffix}.csv`, conteudo: csv(rows) };
  }

  throw new Error("RELATORIO_EXPORTACAO_INVALIDO");
}
