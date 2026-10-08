import prisma from "../../config/prisma.js";

function n(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dataInicioFim(inicio, fim) {
  const where = {};
  if (inicio || fim) {
    where.createdAt = {};
    if (inicio) where.createdAt.gte = new Date(inicio);
    if (fim) where.createdAt.lt = new Date(fim);
  }
  return where;
}

async function validarAtendimento(tx, { id, empresaId, organizacaoId, include = {} }) {
  const atendimento = await tx.atendimentoClinico.findFirst({
    where: {
      id,
      empresaId,
      empresa: { organizacaoId },
    },
    include,
  });
  if (!atendimento) throw new Error("ATENDIMENTO_NAO_ENCONTRADO");
  return atendimento;
}

async function validarClientePet(tx, { organizacaoId, clienteId, petId }) {
  const cliente = await tx.cliente.findFirst({
    where: { id: clienteId, organizacaoId, ativo: true },
    select: { id: true, nome: true },
  });
  if (!cliente) throw new Error("CLIENTE_NAO_ENCONTRADO");

  const pet = await tx.pet.findFirst({
    where: { id: petId, clienteId, ativo: true, cliente: { organizacaoId } },
    select: { id: true, nome: true },
  });
  if (!pet) throw new Error("PET_NAO_ENCONTRADO");
  return { cliente, pet };
}

async function validarItem(tx, { empresaId, organizacaoId, itemCatalogoId }) {
  if (!itemCatalogoId) return null;
  const item = await tx.itemCatalogo.findFirst({
    where: { id: itemCatalogoId, empresaId, ativo: true, empresa: { organizacaoId } },
    include: { produto: { include: { estoque: true, lotes: true } }, servico: true },
  });
  if (!item) throw new Error("ITEM_NAO_ENCONTRADO");
  return item;
}

async function garantirComanda(tx, atendimento) {
  if (atendimento.comandaId) {
    const existente = await tx.comanda.findUnique({ where: { id: atendimento.comandaId } });
    if (existente && !["FECHADA", "CANCELADA"].includes(existente.status)) return existente;
  }

  const comanda = await tx.comanda.create({
    data: {
      clienteId: atendimento.clienteId,
      observacoes: `Comanda do atendimento clínico ${atendimento.id}`,
    },
  });
  await tx.atendimentoClinico.update({ where: { id: atendimento.id }, data: { comandaId: comanda.id } });
  atendimento.comandaId = comanda.id;
  return comanda;
}

async function criarProcedimentoNoTx(tx, { atendimento, empresaId, organizacaoId, itemCatalogoId, quantidade = 1, observacoes, lancarComanda = true }) {
  const item = await validarItem(tx, { empresaId, organizacaoId, itemCatalogoId });
  const qtd = n(quantidade);
  if (qtd <= 0) throw new Error("QUANTIDADE_INVALIDA");

  const procedimento = await tx.procedimentoClinico.create({
    data: {
      atendimentoId: atendimento.id,
      itemCatalogoId: item.id,
      quantidade: qtd,
      valorUnitario: item.precoVenda,
      observacoes: observacoes || null,
    },
  });

  if (!lancarComanda) return procedimento;

  const comanda = await garantirComanda(tx, atendimento);
  const valorTotal = Math.round((n(item.precoVenda) * qtd + Number.EPSILON) * 100) / 100;
  const comandaItem = await tx.comandaItem.create({
    data: {
      comandaId: comanda.id,
      empresaId,
      itemCatalogoId: item.id,
      petId: atendimento.petId,
      descricao: item.nome,
      quantidade: qtd,
      valorUnitario: item.precoVenda,
      desconto: 0,
      valorTotal,
      origemTipo: "PROCEDIMENTO_CLINICO",
      origemId: procedimento.id,
    },
  });

  return tx.procedimentoClinico.update({
    where: { id: procedimento.id },
    data: { comandaItemId: comandaItem.id },
  });
}

async function consumirEstoqueClinico(tx, { empresaId, usuarioId, item, loteProdutoId, quantidade, origemTipo, origemId }) {
  if (!item?.produto?.controlaEstoque) throw new Error("ITEM_NAO_CONTROLA_ESTOQUE");
  const produto = item.produto;
  const qtd = n(quantidade);
  if (qtd <= 0) throw new Error("QUANTIDADE_INVALIDA");

  let lote = null;
  if (produto.controlaLote) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (loteProdutoId) {
      lote = await tx.loteProduto.findFirst({
        where: { id: loteProdutoId, produtoId: produto.id },
      });
    } else {
      lote = await tx.loteProduto.findFirst({
        where: {
          produtoId: produto.id,
          quantidadeAtual: { gte: qtd },
          OR: [{ dataValidade: null }, { dataValidade: { gte: hoje } }],
        },
        orderBy: [{ dataValidade: "asc" }, { createdAt: "asc" }],
      });
    }
    if (!lote || n(lote.quantidadeAtual) + 0.0001 < qtd) throw new Error("ESTOQUE_INSUFICIENTE");
  }

  const saldo = await tx.estoqueSaldo.findUnique({ where: { produtoId: produto.id } });
  const saldoAnterior = n(saldo?.quantidade);
  const saldoPosterior = saldoAnterior - qtd;
  if (saldoPosterior < -0.0001) throw new Error("ESTOQUE_INSUFICIENTE");

  await tx.estoqueSaldo.upsert({
    where: { produtoId: produto.id },
    update: { quantidade: saldoPosterior },
    create: { produtoId: produto.id, quantidade: saldoPosterior },
  });

  if (lote) {
    await tx.loteProduto.update({
      where: { id: lote.id },
      data: { quantidadeAtual: n(lote.quantidadeAtual) - qtd },
    });
  }

  await tx.movimentacaoEstoque.create({
    data: {
      empresaId,
      produtoId: produto.id,
      loteId: lote?.id || null,
      usuarioId,
      tipo: "CONSUMO_INTERNO",
      quantidade: qtd,
      saldoAnterior,
      saldoPosterior,
      custoUnitario: produto.custoMedio,
      origemTipo,
      origemId,
      observacao: `Consumo clínico: ${item.nome}`,
    },
  });

  return lote;
}

const atendimentoInclude = {
  cliente: { select: { id: true, nome: true, telefone: true, whatsapp: true } },
  pet: {
    include: {
      especie: { select: { id: true, nome: true } },
      raca: { select: { id: true, nome: true } },
      pesos: { orderBy: { data: "desc" }, take: 5 },
    },
  },
  veterinario: { select: { id: true, nome: true, email: true } },
  comanda: {
    include: {
      itens: { where: { status: { not: "CANCELADO" } }, include: { itemCatalogo: true } },
      vendas: { select: { id: true, numero: true, status: true, valorTotal: true } },
    },
  },
  prescricoes: { include: { veterinario: { select: { id: true, nome: true } }, itens: { include: { itemCatalogo: { select: { id: true, nome: true } } } } }, orderBy: { emitidaEm: "desc" } },
  vacinas: { include: { itemCatalogo: { select: { id: true, nome: true } }, loteProduto: true }, orderBy: { aplicadaEm: "desc" } },
  vermifugacoes: { include: { itemCatalogo: { select: { id: true, nome: true } }, loteProduto: true }, orderBy: { aplicadaEm: "desc" } },
  exames: { include: { itemCatalogo: { select: { id: true, nome: true } } }, orderBy: { solicitadoEm: "desc" } },
  procedimentos: { include: { itemCatalogo: { select: { id: true, nome: true, tipo: true } }, comandaItem: true }, orderBy: { realizadoEm: "desc" } },
  documentos: { orderBy: { emitidoEm: "desc" } },
};

export async function resumo({ empresaId, inicio, fim }) {
  const periodo = dataInicioFim(inicio, fim);
  const base = { empresaId, ...periodo };
  const [aguardando, emAtendimento, finalizados, cancelados, total] = await Promise.all([
    prisma.atendimentoClinico.count({ where: { ...base, status: "AGUARDANDO" } }),
    prisma.atendimentoClinico.count({ where: { ...base, status: "EM_ATENDIMENTO" } }),
    prisma.atendimentoClinico.count({ where: { ...base, status: "FINALIZADO" } }),
    prisma.atendimentoClinico.count({ where: { ...base, status: "CANCELADO" } }),
    prisma.atendimentoClinico.count({ where: base }),
  ]);
  return { aguardando, emAtendimento, finalizados, cancelados, total };
}

export async function listarAtendimentos({ empresaId, organizacaoId, busca, status, inicio, fim }) {
  return prisma.atendimentoClinico.findMany({
    where: {
      empresaId,
      empresa: { organizacaoId },
      ...(status ? { status } : {}),
      ...dataInicioFim(inicio, fim),
      ...(busca ? {
        OR: [
          { cliente: { nome: { contains: busca, mode: "insensitive" } } },
          { pet: { nome: { contains: busca, mode: "insensitive" } } },
          { queixaPrincipal: { contains: busca, mode: "insensitive" } },
        ],
      } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 150,
    include: {
      cliente: { select: { id: true, nome: true, telefone: true } },
      pet: { include: { especie: { select: { nome: true } }, raca: { select: { nome: true } } } },
      veterinario: { select: { id: true, nome: true } },
      comanda: { select: { id: true, numero: true, status: true } },
      _count: { select: { prescricoes: true, exames: true, vacinas: true, procedimentos: true } },
    },
  });
}

export async function criarAtendimento({ empresaId, organizacaoId, usuarioId, dados }) {
  // Mantemos dentro da transação apenas as escritas que precisam ser atômicas.
  // A leitura completa do prontuário fica fora dela para reduzir o tempo de lock
  // e evitar expiração da transação em bancos remotos (ex.: Railway).
  const atendimentoId = await prisma.$transaction(
    async (tx) => {
      await validarClientePet(tx, { organizacaoId, clienteId: dados.clienteId, petId: dados.petId });

      const atendimento = await tx.atendimentoClinico.create({
        data: {
          empresaId,
          clienteId: dados.clienteId,
          petId: dados.petId,
          queixaPrincipal: dados.queixaPrincipal || null,
          agendadoPara: dados.agendadoPara ? new Date(dados.agendadoPara) : null,
        },
      });

      if (dados.peso) {
        await tx.petPeso.create({
          data: {
            petId: dados.petId,
            peso: dados.peso,
            origem: "CONSULTORIO",
            observacao: `Atendimento ${atendimento.id}`,
          },
        });
      }

      if (dados.itemConsultaId) {
        const itemConsulta = await validarItem(tx, {
          empresaId,
          organizacaoId,
          itemCatalogoId: dados.itemConsultaId,
        });

        if (itemConsulta.tipo !== "SERVICO") throw new Error("ITEM_DEVE_SER_SERVICO");

        await criarProcedimentoNoTx(tx, {
          atendimento,
          empresaId,
          organizacaoId,
          itemCatalogoId: dados.itemConsultaId,
          quantidade: 1,
          observacoes: "Consulta veterinária",
          lancarComanda: dados.lancarComanda !== false,
        });
      }

      return atendimento.id;
    },
    { maxWait: 10_000, timeout: 30_000 }
  );

  return prisma.atendimentoClinico.findUnique({
    where: { id: atendimentoId },
    include: atendimentoInclude,
  });
}

export async function buscarAtendimento({ empresaId, organizacaoId, id }) {
  return validarAtendimento(prisma, { id, empresaId, organizacaoId, include: atendimentoInclude });
}

export async function atualizarAtendimento({ empresaId, organizacaoId, id, dados }) {
  return prisma.$transaction(async (tx) => {
    const atual = await validarAtendimento(tx, { id, empresaId, organizacaoId });
    if (atual.status === "CANCELADO") throw new Error("ATENDIMENTO_ENCERRADO");

    const { peso, ...campos } = dados;
    const update = {};
    for (const [chave, valor] of Object.entries(campos)) {
      if (valor !== undefined) update[chave] = chave === "agendadoPara" && valor ? new Date(valor) : valor;
    }
    if (Object.keys(update).length) await tx.atendimentoClinico.update({ where: { id }, data: update });
    if (peso) {
      await tx.petPeso.create({ data: { petId: atual.petId, peso, origem: "CONSULTORIO", observacao: `Atendimento ${id}` } });
    }
    return tx.atendimentoClinico.findUnique({ where: { id }, include: atendimentoInclude });
  });
}

export async function iniciarAtendimento({ empresaId, organizacaoId, usuarioId, id }) {
  return prisma.$transaction(async (tx) => {
    const atendimento = await validarAtendimento(tx, { id, empresaId, organizacaoId });
    if (atendimento.status === "CANCELADO" || atendimento.status === "FINALIZADO") throw new Error("ATENDIMENTO_ENCERRADO");
    return tx.atendimentoClinico.update({
      where: { id },
      data: { status: "EM_ATENDIMENTO", veterinarioId: usuarioId, iniciadoEm: atendimento.iniciadoEm || new Date() },
      include: atendimentoInclude,
    });
  });
}

export async function finalizarAtendimento({ empresaId, organizacaoId, usuarioId, id }) {
  return prisma.$transaction(async (tx) => {
    const atendimento = await validarAtendimento(tx, { id, empresaId, organizacaoId });
    if (atendimento.status === "CANCELADO") throw new Error("ATENDIMENTO_ENCERRADO");
    return tx.atendimentoClinico.update({
      where: { id },
      data: {
        status: "FINALIZADO",
        veterinarioId: atendimento.veterinarioId || usuarioId,
        iniciadoEm: atendimento.iniciadoEm || new Date(),
        finalizadoEm: new Date(),
      },
      include: atendimentoInclude,
    });
  });
}

export async function cancelarAtendimento({ empresaId, organizacaoId, id }) {
  const atendimento = await validarAtendimento(prisma, { id, empresaId, organizacaoId });
  if (atendimento.status === "FINALIZADO") throw new Error("ATENDIMENTO_ENCERRADO");
  return prisma.atendimentoClinico.update({ where: { id }, data: { status: "CANCELADO", canceladoEm: new Date() }, include: atendimentoInclude });
}

export async function criarPrescricao({ empresaId, organizacaoId, usuarioId, atendimentoId, dados }) {
  return prisma.$transaction(async (tx) => {
    await validarAtendimento(tx, { id: atendimentoId, empresaId, organizacaoId });
    for (const item of dados.itens) {
      if (item.itemCatalogoId) {
        const catalogo = await validarItem(tx, { empresaId, organizacaoId, itemCatalogoId: item.itemCatalogoId });
        if (catalogo.tipo !== "PRODUTO") throw new Error("ITEM_DEVE_SER_PRODUTO");
      }
    }
    return tx.prescricaoClinica.create({
      data: {
        atendimentoId,
        veterinarioId: usuarioId,
        orientacoes: dados.orientacoes || null,
        itens: { create: dados.itens.map((item) => ({
          itemCatalogoId: item.itemCatalogoId || null,
          medicamento: item.medicamento,
          concentracao: item.concentracao || null,
          dose: item.dose || null,
          via: item.via || null,
          frequencia: item.frequencia || null,
          duracao: item.duracao || null,
          quantidade: item.quantidade || null,
          orientacao: item.orientacao || null,
        })) },
      },
      include: { veterinario: { select: { id: true, nome: true } }, itens: { include: { itemCatalogo: true } } },
    });
  });
}

export async function aplicarVacina({ empresaId, organizacaoId, usuarioId, atendimentoId, dados }) {
  return prisma.$transaction(async (tx) => {
    const atendimento = await validarAtendimento(tx, { id: atendimentoId, empresaId, organizacaoId });
    const item = dados.itemCatalogoId ? await validarItem(tx, { empresaId, organizacaoId, itemCatalogoId: dados.itemCatalogoId }) : null;
    if (item && item.tipo !== "PRODUTO") throw new Error("ITEM_DEVE_SER_PRODUTO");
    const aplicacao = await tx.vacinaAplicacao.create({
      data: {
        atendimentoId,
        petId: atendimento.petId,
        itemCatalogoId: dados.itemCatalogoId || null,
        loteProdutoId: dados.loteProdutoId || null,
        nomeVacina: dados.nomeVacina,
        fabricante: dados.fabricante || null,
        numeroLote: dados.numeroLote || null,
        dataValidade: dados.dataValidade ? new Date(`${dados.dataValidade}T00:00:00.000Z`) : null,
        dose: dados.dose || null,
        via: dados.via || null,
        local: dados.local || null,
        aplicadaEm: dados.aplicadaEm ? new Date(dados.aplicadaEm) : new Date(),
        proximaDose: dados.proximaDose ? new Date(`${dados.proximaDose}T00:00:00.000Z`) : null,
        observacoes: dados.observacoes || null,
      },
    });
    if (dados.consumirEstoque) {
      if (!item) throw new Error("ITEM_ESTOQUE_OBRIGATORIO");
      const lote = await consumirEstoqueClinico(tx, { empresaId, usuarioId, item, loteProdutoId: dados.loteProdutoId, quantidade: dados.quantidadeEstoque, origemTipo: "VACINA_APLICACAO", origemId: aplicacao.id });
      if (lote) {
        await tx.vacinaAplicacao.update({
          where: { id: aplicacao.id },
          data: { loteProdutoId: lote.id, numeroLote: aplicacao.numeroLote || lote.numeroLote, dataValidade: aplicacao.dataValidade || lote.dataValidade },
        });
      }
    }
    return tx.vacinaAplicacao.findUnique({ where: { id: aplicacao.id }, include: { itemCatalogo: true, loteProduto: true } });
  });
}

export async function aplicarVermifugo({ empresaId, organizacaoId, usuarioId, atendimentoId, dados }) {
  return prisma.$transaction(async (tx) => {
    const atendimento = await validarAtendimento(tx, { id: atendimentoId, empresaId, organizacaoId });
    const item = dados.itemCatalogoId ? await validarItem(tx, { empresaId, organizacaoId, itemCatalogoId: dados.itemCatalogoId }) : null;
    if (item && item.tipo !== "PRODUTO") throw new Error("ITEM_DEVE_SER_PRODUTO");
    const aplicacao = await tx.vermifugacaoAplicacao.create({
      data: {
        atendimentoId,
        petId: atendimento.petId,
        itemCatalogoId: dados.itemCatalogoId || null,
        loteProdutoId: dados.loteProdutoId || null,
        produto: dados.produto,
        principioAtivo: dados.principioAtivo || null,
        dose: dados.dose || null,
        numeroLote: dados.numeroLote || null,
        dataValidade: dados.dataValidade ? new Date(`${dados.dataValidade}T00:00:00.000Z`) : null,
        aplicadaEm: dados.aplicadaEm ? new Date(dados.aplicadaEm) : new Date(),
        proximaDose: dados.proximaDose ? new Date(`${dados.proximaDose}T00:00:00.000Z`) : null,
        observacoes: dados.observacoes || null,
      },
    });
    if (dados.consumirEstoque) {
      if (!item) throw new Error("ITEM_ESTOQUE_OBRIGATORIO");
      const lote = await consumirEstoqueClinico(tx, { empresaId, usuarioId, item, loteProdutoId: dados.loteProdutoId, quantidade: dados.quantidadeEstoque, origemTipo: "VERMIFUGACAO_APLICACAO", origemId: aplicacao.id });
      if (lote) {
        await tx.vermifugacaoAplicacao.update({
          where: { id: aplicacao.id },
          data: { loteProdutoId: lote.id, numeroLote: aplicacao.numeroLote || lote.numeroLote, dataValidade: aplicacao.dataValidade || lote.dataValidade },
        });
      }
    }
    return tx.vermifugacaoAplicacao.findUnique({ where: { id: aplicacao.id }, include: { itemCatalogo: true, loteProduto: true } });
  });
}

export async function solicitarExame({ empresaId, organizacaoId, atendimentoId, dados }) {
  return prisma.$transaction(async (tx) => {
    const atendimento = await validarAtendimento(tx, { id: atendimentoId, empresaId, organizacaoId });
    const item = dados.itemCatalogoId ? await validarItem(tx, { empresaId, organizacaoId, itemCatalogoId: dados.itemCatalogoId }) : null;
    if (item && item.tipo !== "SERVICO") throw new Error("ITEM_DEVE_SER_SERVICO");
    const exame = await tx.exameClinico.create({ data: { atendimentoId, itemCatalogoId: item?.id || null, nome: dados.nome, observacoes: dados.observacoes || null } });
    if (item && dados.lancarComanda !== false) {
      await criarProcedimentoNoTx(tx, { atendimento, empresaId, organizacaoId, itemCatalogoId: item.id, quantidade: 1, observacoes: `Exame solicitado: ${dados.nome}`, lancarComanda: true });
    }
    return exame;
  });
}

export async function atualizarExame({ empresaId, organizacaoId, atendimentoId, exameId, dados }) {
  return prisma.$transaction(async (tx) => {
    await validarAtendimento(tx, { id: atendimentoId, empresaId, organizacaoId });
    const exame = await tx.exameClinico.findFirst({ where: { id: exameId, atendimentoId } });
    if (!exame) throw new Error("EXAME_NAO_ENCONTRADO");
    const update = { ...dados };
    if (dados.status === "COLETADO" && !exame.coletadoEm) update.coletadoEm = new Date();
    if (dados.status === "RESULTADO_DISPONIVEL" && !exame.resultadoEm) update.resultadoEm = new Date();
    return tx.exameClinico.update({ where: { id: exameId }, data: update, include: { itemCatalogo: true } });
  });
}

export async function adicionarProcedimento({ empresaId, organizacaoId, atendimentoId, dados }) {
  return prisma.$transaction(async (tx) => {
    const atendimento = await validarAtendimento(tx, { id: atendimentoId, empresaId, organizacaoId });
    return criarProcedimentoNoTx(tx, { atendimento, empresaId, organizacaoId, ...dados });
  });
}

export async function criarDocumento({ empresaId, organizacaoId, atendimentoId, dados }) {
  return prisma.$transaction(async (tx) => {
    await validarAtendimento(tx, { id: atendimentoId, empresaId, organizacaoId });
    return tx.documentoClinico.create({
      data: {
        atendimentoId,
        tipo: dados.tipo,
        titulo: dados.titulo,
        conteudo: dados.conteudo,
        arquivoUrl: dados.arquivoUrl || null,
        visivelCliente: dados.visivelCliente ?? true,
      },
    });
  });
}

export async function historicoPet({ empresaId, organizacaoId, petId }) {
  const pet = await prisma.pet.findFirst({ where: { id: petId, ativo: true, cliente: { organizacaoId } }, select: { id: true } });
  if (!pet) throw new Error("PET_NAO_ENCONTRADO");
  return prisma.atendimentoClinico.findMany({
    where: { empresaId, petId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      veterinario: { select: { id: true, nome: true } },
      _count: { select: { prescricoes: true, vacinas: true, exames: true, procedimentos: true, documentos: true } },
    },
  });
}
