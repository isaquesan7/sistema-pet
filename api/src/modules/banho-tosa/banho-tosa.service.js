import prisma from "../../config/prisma.js";

const ordemInclude = {
  cliente: { select: { id: true, nome: true, telefone: true, whatsapp: true } },
  pet: {
    include: {
      especie: { select: { id: true, nome: true } },
      raca: { select: { id: true, nome: true } },
      fichaBanhoTosa: true,
    },
  },
  profissional: { select: { id: true, nome: true, funcao: { select: { id: true, nome: true } } } },
  agendamento: { select: { id: true, inicio: true, fim: true, origem: true } },
  comanda: { select: { id: true, numero: true, status: true } },
  itens: {
    include: {
      itemCatalogo: { select: { id: true, nome: true, precoVenda: true, categoria: { select: { id: true, nome: true } } } },
      pacoteClienteItem: {
        include: { pacoteCliente: { select: { id: true, nome: true, status: true } } },
      },
    },
  },
  anexos: { orderBy: { createdAt: "desc" } },
};

const agendamentoInclude = {
  cliente: { select: { id: true, nome: true, telefone: true, whatsapp: true } },
  pet: { include: { especie: true, raca: true, fichaBanhoTosa: true } },
  profissional: { select: { id: true, nome: true, funcao: { select: { id: true, nome: true } } } },
  itens: { include: { itemCatalogo: { select: { id: true, nome: true, precoVenda: true, servico: true } } } },
  ordem: { select: { id: true, numero: true, status: true } },
};

function numero(valor) {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function inicioDia(valor) {
  const data = valor ? new Date(`${valor}T00:00:00.000`) : new Date();
  data.setHours(0, 0, 0, 0);
  return data;
}

function fimDia(valor) {
  const data = inicioDia(valor);
  data.setHours(23, 59, 59, 999);
  return data;
}

function intervalo({ data, inicio, fim }) {
  if (inicio && fim) {
    const de = new Date(inicio);
    const ate = new Date(fim);
    if (!Number.isNaN(de.getTime()) && !Number.isNaN(ate.getTime()) && ate > de) return { inicio: de, fim: ate };
  }
  return { inicio: inicioDia(data), fim: fimDia(data) };
}

async function validarClientePet(tx, { organizacaoId, clienteId, petId }) {
  const cliente = await tx.cliente.findFirst({ where: { id: clienteId, organizacaoId, ativo: true } });
  if (!cliente) throw new Error("CLIENTE_NAO_ENCONTRADO");
  const pet = await tx.pet.findFirst({ where: { id: petId, clienteId, ativo: true } });
  if (!pet) throw new Error("PET_NAO_ENCONTRADO");
  return { cliente, pet };
}

async function validarProfissional(tx, { empresaId, organizacaoId, profissionalId }) {
  if (!profissionalId) return null;
  const profissional = await tx.funcionario.findFirst({
    where: {
      id: profissionalId,
      organizacaoId,
      status: { not: "DESLIGADO" },
      empresas: { some: { empresaId, ativo: true } },
    },
  });
  if (!profissional) throw new Error("PROFISSIONAL_NAO_ENCONTRADO");
  return profissional;
}

async function validarItensServico(tx, { empresaId, organizacaoId, itens }) {
  const ids = [...new Set(itens.map((i) => i.itemCatalogoId))];
  const encontrados = await tx.itemCatalogo.findMany({
    where: {
      id: { in: ids },
      empresaId,
      tipo: "SERVICO",
      ativo: true,
      empresa: { organizacaoId },
    },
    include: { servico: true },
  });
  if (encontrados.length !== ids.length) throw new Error("SERVICO_NAO_ENCONTRADO");
  const mapa = new Map(encontrados.map((i) => [i.id, i]));
  return itens.map((linha) => ({
    item: mapa.get(linha.itemCatalogoId),
    quantidade: numero(linha.quantidade) || 1,
    pacoteClienteItemId: linha.pacoteClienteItemId || null,
  }));
}

function calcularFim(inicio, itens) {
  const minutos = itens.reduce((soma, linha) => {
    const duracao = Number(linha.item.servico?.duracaoMinutos || 30);
    return soma + duracao * linha.quantidade;
  }, 0);
  return new Date(inicio.getTime() + Math.max(minutos, 30) * 60000);
}

async function validarConflito(tx, { empresaId, profissionalId, inicio, fim, ignorarId = null }) {
  if (!profissionalId) return;
  const conflito = await tx.agendamentoBanhoTosa.findFirst({
    where: {
      empresaId,
      profissionalId,
      id: ignorarId ? { not: ignorarId } : undefined,
      status: { notIn: ["CANCELADO", "FALTOU", "CONCLUIDO"] },
      inicio: { lt: fim },
      fim: { gt: inicio },
    },
    select: { id: true, inicio: true, fim: true },
  });
  if (conflito) throw new Error("HORARIO_INDISPONIVEL");
}

async function obterOuCriarComanda(tx, clienteId) {
  const aberta = await tx.comanda.findFirst({
    where: { clienteId, status: { in: ["ABERTA", "PARCIALMENTE_FECHADA"] } },
    orderBy: { createdAt: "desc" },
  });
  if (aberta) return aberta;
  return tx.comanda.create({ data: { clienteId, observacoes: "Comanda aberta pelo Banho e Tosa" } });
}

async function consumirCreditoNoTx(tx, { empresaId, organizacaoId, usuarioId, clienteId, petId, itemCatalogoId, pacoteClienteItemId, quantidade, ordemItemId }) {
  const credito = await tx.pacoteClienteItem.findFirst({
    where: {
      id: pacoteClienteItemId,
      itemCatalogoId,
      pacoteCliente: {
        organizacaoId,
        empresaId,
        clienteId,
        status: "ATIVO",
        OR: [{ petId: null }, { petId }],
      },
    },
    include: { pacoteCliente: true },
  });
  if (!credito) throw new Error("CREDITO_PACOTE_INVALIDO");

  const agora = new Date();
  const inicio = new Date(`${credito.pacoteCliente.inicioValidade.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const fim = credito.pacoteCliente.fimValidade
    ? new Date(`${credito.pacoteCliente.fimValidade.toISOString().slice(0, 10)}T23:59:59.999Z`)
    : null;
  if (agora < inicio || (fim && agora > fim)) throw new Error("PACOTE_FORA_VIGENCIA");

  const restante = numero(credito.quantidadeTotal) - numero(credito.quantidadeConsumida);
  if (restante + 0.0001 < quantidade) throw new Error("SALDO_PACOTE_INSUFICIENTE");

  await tx.pacoteClienteItem.update({
    where: { id: credito.id },
    data: { quantidadeConsumida: { increment: quantidade } },
  });

  await tx.consumoPacote.create({
    data: {
      pacoteClienteItemId: credito.id,
      usuarioId,
      petId,
      quantidade,
      origemTipo: "BANHO_TOSA_OS_ITEM",
      origemId: ordemItemId,
      observacao: "Crédito consumido pelo Banho e Tosa",
    },
  });

  const saldos = await tx.pacoteClienteItem.findMany({ where: { pacoteClienteId: credito.pacoteClienteId } });
  const esgotado = saldos.every((s) => numero(s.quantidadeConsumida) >= numero(s.quantidadeTotal));
  if (esgotado) {
    await tx.pacoteCliente.update({ where: { id: credito.pacoteClienteId }, data: { status: "ESGOTADO" } });
  }
}

async function criarItensOrdem(tx, { ordem, empresaId, organizacaoId, usuarioId, clienteId, petId, itens }) {
  const preparados = await validarItensServico(tx, { empresaId, organizacaoId, itens });
  let comanda = ordem.comandaId ? await tx.comanda.findUnique({ where: { id: ordem.comandaId } }) : null;

  for (const linha of preparados) {
    const viaPacote = Boolean(linha.pacoteClienteItemId);
    if (!viaPacote && !comanda) {
      comanda = await obterOuCriarComanda(tx, clienteId);
      await tx.ordemServicoBanhoTosa.update({ where: { id: ordem.id }, data: { comandaId: comanda.id } });
    }

    const osItem = await tx.ordemServicoBanhoTosaItem.create({
      data: {
        ordemId: ordem.id,
        itemCatalogoId: linha.item.id,
        pacoteClienteItemId: linha.pacoteClienteItemId,
        quantidade: linha.quantidade,
        valorUnitario: linha.item.precoVenda,
        viaPacote,
      },
    });

    if (viaPacote) {
      await consumirCreditoNoTx(tx, {
        empresaId,
        organizacaoId,
        usuarioId,
        clienteId,
        petId,
        itemCatalogoId: linha.item.id,
        pacoteClienteItemId: linha.pacoteClienteItemId,
        quantidade: linha.quantidade,
        ordemItemId: osItem.id,
      });
    } else {
      const total = numero(linha.item.precoVenda) * linha.quantidade;
      const comandaItem = await tx.comandaItem.create({
        data: {
          comandaId: comanda.id,
          empresaId,
          itemCatalogoId: linha.item.id,
          petId,
          descricao: linha.item.nome,
          quantidade: linha.quantidade,
          valorUnitario: linha.item.precoVenda,
          valorTotal: total,
          origemTipo: "BANHO_TOSA_OS",
          origemId: ordem.id,
        },
      });
      await tx.ordemServicoBanhoTosaItem.update({
        where: { id: osItem.id },
        data: { comandaItemId: comandaItem.id },
      });
    }
  }
}

export async function resumo({ empresaId, data, inicio: inicioParam, fim: fimParam }) {
  const { inicio, fim } = intervalo({ data, inicio: inicioParam, fim: fimParam });
  const [agendados, aguardando, emProducao, prontos] = await Promise.all([
    prisma.agendamentoBanhoTosa.count({
      where: { empresaId, inicio: { gte: inicio, lte: fim }, status: { notIn: ["CANCELADO", "FALTOU"] } },
    }),
    prisma.ordemServicoBanhoTosa.count({ where: { empresaId, entrada: { gte: inicio, lte: fim }, status: "AGUARDANDO" } }),
    prisma.ordemServicoBanhoTosa.count({
      where: { empresaId, entrada: { gte: inicio, lte: fim }, status: { in: ["EM_BANHO", "EM_SECAGEM", "EM_TOSA"] } },
    }),
    prisma.ordemServicoBanhoTosa.count({
      where: { empresaId, entrada: { gte: inicio, lte: fim }, status: { in: ["FINALIZADO", "AGUARDANDO_RETIRADA"] } },
    }),
  ]);
  return { agendados, aguardando, emProducao, prontos };
}

export async function listarProfissionais({ organizacaoId, empresaId }) {
  return prisma.funcionario.findMany({
    where: { organizacaoId, status: { not: "DESLIGADO" }, empresas: { some: { empresaId, ativo: true } } },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, funcao: { select: { id: true, nome: true } } },
  });
}

export async function listarAgendamentos({ empresaId, organizacaoId, data, inicio: inicioParam, fim: fimParam, status, profissionalId }) {
  const { inicio, fim } = intervalo({ data, inicio: inicioParam, fim: fimParam });
  return prisma.agendamentoBanhoTosa.findMany({
    where: {
      empresaId,
      empresa: { organizacaoId },
      inicio: { gte: inicio, lte: fim },
      ...(status ? { status } : {}),
      ...(profissionalId ? { profissionalId } : {}),
    },
    orderBy: { inicio: "asc" },
    include: agendamentoInclude,
  });
}

export async function criarAgendamento({ empresaId, organizacaoId, dados }) {
  return prisma.$transaction(async (tx) => {
    await validarClientePet(tx, { organizacaoId, clienteId: dados.clienteId, petId: dados.petId });
    await validarProfissional(tx, { empresaId, organizacaoId, profissionalId: dados.profissionalId });
    const itens = await validarItensServico(tx, { empresaId, organizacaoId, itens: dados.itens });
    const inicio = new Date(dados.inicio);
    if (Number.isNaN(inicio.getTime())) throw new Error("PERIODO_INVALIDO");
    const fim = dados.fim ? new Date(dados.fim) : calcularFim(inicio, itens);
    if (Number.isNaN(fim.getTime()) || fim <= inicio) throw new Error("PERIODO_INVALIDO");
    await validarConflito(tx, { empresaId, profissionalId: dados.profissionalId, inicio, fim });

    return tx.agendamentoBanhoTosa.create({
      data: {
        empresaId,
        clienteId: dados.clienteId,
        petId: dados.petId,
        profissionalId: dados.profissionalId || null,
        inicio,
        fim,
        origem: dados.origem || "INTERNO",
        status: dados.status || "CONFIRMADO",
        observacoesCliente: dados.observacoesCliente || null,
        observacoesInternas: dados.observacoesInternas || null,
        itens: {
          create: itens.map((linha) => ({
            itemCatalogoId: linha.item.id,
            quantidade: linha.quantidade,
            valorUnitario: linha.item.precoVenda,
          })),
        },
      },
      include: agendamentoInclude,
    });
  }, { maxWait: 10_000, timeout: 30_000 });
}

export async function atualizarAgendamento({ empresaId, organizacaoId, id, dados }) {
  return prisma.$transaction(async (tx) => {
    const atual = await tx.agendamentoBanhoTosa.findFirst({
      where: { id, empresaId, empresa: { organizacaoId } },
      include: { itens: { include: { itemCatalogo: { include: { servico: true } } } }, ordem: true },
    });
    if (!atual) throw new Error("AGENDAMENTO_NAO_ENCONTRADO");
    if (atual.ordem) throw new Error("AGENDAMENTO_JA_CHECKIN");

    await validarProfissional(tx, { empresaId, organizacaoId, profissionalId: dados.profissionalId ?? atual.profissionalId });
    let itens = atual.itens.map((i) => ({ item: i.itemCatalogo, quantidade: numero(i.quantidade) }));
    if (dados.itens) itens = await validarItensServico(tx, { empresaId, organizacaoId, itens: dados.itens });

    const inicio = dados.inicio ? new Date(dados.inicio) : atual.inicio;
    const fim = dados.fim ? new Date(dados.fim) : (dados.inicio || dados.itens ? calcularFim(inicio, itens) : atual.fim);
    if (fim <= inicio) throw new Error("PERIODO_INVALIDO");
    const profissionalId = Object.prototype.hasOwnProperty.call(dados, "profissionalId") ? dados.profissionalId || null : atual.profissionalId;
    await validarConflito(tx, { empresaId, profissionalId, inicio, fim, ignorarId: id });

    await tx.agendamentoBanhoTosa.update({
      where: { id },
      data: {
        profissionalId,
        inicio,
        fim,
        ...(dados.status ? { status: dados.status } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "observacoesCliente") ? { observacoesCliente: dados.observacoesCliente || null } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "observacoesInternas") ? { observacoesInternas: dados.observacoesInternas || null } : {}),
      },
    });
    if (dados.itens) {
      await tx.agendamentoBanhoTosaItem.deleteMany({ where: { agendamentoId: id } });
      await tx.agendamentoBanhoTosaItem.createMany({
        data: itens.map((linha) => ({ agendamentoId: id, itemCatalogoId: linha.item.id, quantidade: linha.quantidade, valorUnitario: linha.item.precoVenda })),
      });
    }
    return tx.agendamentoBanhoTosa.findUnique({ where: { id }, include: agendamentoInclude });
  }, { maxWait: 10_000, timeout: 30_000 });
}

export async function listarCreditos({ organizacaoId, empresaId, clienteId, petId }) {
  const agora = new Date();
  return prisma.pacoteClienteItem.findMany({
    where: {
      pacoteCliente: {
        organizacaoId,
        empresaId,
        clienteId,
        status: "ATIVO",
        inicioValidade: { lte: agora },
        OR: [
          { fimValidade: null },
          { fimValidade: { gte: inicioDia() } },
        ],
        AND: [{ OR: [{ petId: null }, { petId }] }],
      },
    },
    include: {
      itemCatalogo: { select: { id: true, nome: true, precoVenda: true } },
      pacoteCliente: { select: { id: true, nome: true, fimValidade: true } },
    },
  }).then((itens) => itens.filter((i) => numero(i.quantidadeTotal) > numero(i.quantidadeConsumida)));
}

async function criarOrdemNoTx(tx, { empresaId, organizacaoId, usuarioId, dados, agendamento = null }) {
  await validarClientePet(tx, { organizacaoId, clienteId: dados.clienteId, petId: dados.petId });
  await validarProfissional(tx, { empresaId, organizacaoId, profissionalId: dados.profissionalId });

  const ordem = await tx.ordemServicoBanhoTosa.create({
    data: {
      empresaId,
      agendamentoId: agendamento?.id || null,
      clienteId: dados.clienteId,
      petId: dados.petId,
      profissionalId: dados.profissionalId || null,
      previsaoSaida: dados.previsaoSaida ? new Date(dados.previsaoSaida) : (agendamento?.fim || null),
      observacoesEntrada: dados.observacoesEntrada || null,
    },
  });

  await criarItensOrdem(tx, {
    ordem,
    empresaId,
    organizacaoId,
    usuarioId,
    clienteId: dados.clienteId,
    petId: dados.petId,
    itens: dados.itens,
  });

  if (agendamento) {
    await tx.agendamentoBanhoTosa.update({ where: { id: agendamento.id }, data: { status: "EM_ATENDIMENTO" } });
  }
  return ordem.id;
}

export async function checkinAgendamento({ empresaId, organizacaoId, usuarioId, id, dados }) {
  const ordemId = await prisma.$transaction(async (tx) => {
    const agendamento = await tx.agendamentoBanhoTosa.findFirst({
      where: { id, empresaId, empresa: { organizacaoId } },
      include: { itens: true, ordem: true },
    });
    if (!agendamento) throw new Error("AGENDAMENTO_NAO_ENCONTRADO");
    if (agendamento.ordem) throw new Error("AGENDAMENTO_JA_CHECKIN");
    if (["CANCELADO", "FALTOU", "CONCLUIDO"].includes(agendamento.status)) throw new Error("AGENDAMENTO_ENCERRADO");

    const itens = dados.itens?.length
      ? dados.itens
      : agendamento.itens.map((i) => ({ itemCatalogoId: i.itemCatalogoId, quantidade: numero(i.quantidade) }));

    return criarOrdemNoTx(tx, {
      empresaId,
      organizacaoId,
      usuarioId,
      agendamento,
      dados: {
        clienteId: agendamento.clienteId,
        petId: agendamento.petId,
        profissionalId: dados.profissionalId || agendamento.profissionalId,
        previsaoSaida: dados.previsaoSaida,
        observacoesEntrada: dados.observacoesEntrada,
        itens,
      },
    });
  }, { maxWait: 10_000, timeout: 30_000 });
  return buscarOrdem({ empresaId, organizacaoId, id: ordemId });
}

export async function criarOrdemDireta({ empresaId, organizacaoId, usuarioId, dados }) {
  const ordemId = await prisma.$transaction(
    (tx) => criarOrdemNoTx(tx, { empresaId, organizacaoId, usuarioId, dados }),
    { maxWait: 10_000, timeout: 30_000 }
  );
  return buscarOrdem({ empresaId, organizacaoId, id: ordemId });
}

export async function listarOrdens({ empresaId, organizacaoId, data, inicio: inicioParam, fim: fimParam, status }) {
  const { inicio, fim } = intervalo({ data, inicio: inicioParam, fim: fimParam });
  return prisma.ordemServicoBanhoTosa.findMany({
    where: {
      empresaId,
      empresa: { organizacaoId },
      entrada: { gte: inicio, lte: fim },
      ...(status ? { status } : {}),
    },
    orderBy: { entrada: "asc" },
    include: ordemInclude,
  });
}

export async function buscarOrdem({ empresaId, organizacaoId, id }) {
  const ordem = await prisma.ordemServicoBanhoTosa.findFirst({
    where: { id, empresaId, empresa: { organizacaoId } },
    include: ordemInclude,
  });
  if (!ordem) throw new Error("ORDEM_NAO_ENCONTRADA");
  return ordem;
}

const transicoes = {
  AGUARDANDO: ["EM_BANHO", "EM_TOSA", "FINALIZADO", "AGUARDANDO_RETIRADA", "CANCELADO"],
  EM_BANHO: ["EM_SECAGEM", "EM_TOSA", "FINALIZADO", "AGUARDANDO_RETIRADA", "CANCELADO"],
  EM_SECAGEM: ["EM_TOSA", "FINALIZADO", "AGUARDANDO_RETIRADA", "CANCELADO"],
  EM_TOSA: ["FINALIZADO", "AGUARDANDO_RETIRADA", "CANCELADO"],
  FINALIZADO: ["AGUARDANDO_RETIRADA", "ENTREGUE"],
  AGUARDANDO_RETIRADA: ["ENTREGUE"],
  ENTREGUE: [],
  CANCELADO: [],
};

export async function atualizarStatusOrdem({ empresaId, organizacaoId, id, dados }) {
  return prisma.$transaction(async (tx) => {
    const atual = await tx.ordemServicoBanhoTosa.findFirst({
      where: { id, empresaId, empresa: { organizacaoId } },
      include: { agendamento: true },
    });
    if (!atual) throw new Error("ORDEM_NAO_ENCONTRADA");
    if (dados.status !== atual.status && !transicoes[atual.status]?.includes(dados.status)) throw new Error("TRANSICAO_STATUS_INVALIDA");

    if (dados.status === "CANCELADO") {
      const itens = await tx.ordemServicoBanhoTosaItem.findMany({
        where: { ordemId: id },
        include: { comandaItem: true, pacoteClienteItem: { include: { pacoteCliente: true } } },
      });

      const faturado = itens.some((item) => item.comandaItem?.status === "FATURADO");
      if (faturado) throw new Error("ORDEM_JA_FATURADA");

      for (const item of itens) {
        if (item.comandaItemId && item.comandaItem?.status === "ATIVO") {
          await tx.comandaItem.update({ where: { id: item.comandaItemId }, data: { status: "CANCELADO" } });
        }

        if (item.viaPacote && item.pacoteClienteItemId) {
          const consumo = await tx.consumoPacote.findFirst({
            where: { origemTipo: "BANHO_TOSA_OS_ITEM", origemId: item.id, pacoteClienteItemId: item.pacoteClienteItemId },
          });
          if (consumo) {
            await tx.pacoteClienteItem.update({
              where: { id: item.pacoteClienteItemId },
              data: { quantidadeConsumida: { decrement: consumo.quantidade } },
            });
            await tx.consumoPacote.delete({ where: { id: consumo.id } });

            const pacote = item.pacoteClienteItem?.pacoteCliente;
            if (pacote?.status === "ESGOTADO") {
              const hoje = new Date();
              const fim = pacote.fimValidade
                ? new Date(`${pacote.fimValidade.toISOString().slice(0, 10)}T23:59:59.999Z`)
                : null;
              await tx.pacoteCliente.update({
                where: { id: pacote.id },
                data: { status: fim && hoje > fim ? "EXPIRADO" : "ATIVO" },
              });
            }
          }
        }
      }
    }

    const ordem = await tx.ordemServicoBanhoTosa.update({
      where: { id },
      data: {
        status: dados.status,
        ...(Object.prototype.hasOwnProperty.call(dados, "observacoesSaida") ? { observacoesSaida: dados.observacoesSaida || null } : {}),
        ...(dados.status === "ENTREGUE" ? { saida: new Date() } : {}),
      },
    });

    if (atual.agendamentoId && dados.status === "ENTREGUE") {
      await tx.agendamentoBanhoTosa.update({ where: { id: atual.agendamentoId }, data: { status: "CONCLUIDO" } });
    }
    if (atual.agendamentoId && dados.status === "CANCELADO") {
      await tx.agendamentoBanhoTosa.update({ where: { id: atual.agendamentoId }, data: { status: "CANCELADO" } });
    }
    return ordem;
  }).then(() => buscarOrdem({ empresaId, organizacaoId, id }));
}

export async function buscarFicha({ organizacaoId, petId }) {
  const pet = await prisma.pet.findFirst({ where: { id: petId, cliente: { organizacaoId }, ativo: true } });
  if (!pet) throw new Error("PET_NAO_ENCONTRADO");
  return prisma.fichaBanhoTosaPet.findUnique({ where: { petId } });
}

export async function salvarFicha({ organizacaoId, petId, dados }) {
  const pet = await prisma.pet.findFirst({ where: { id: petId, cliente: { organizacaoId }, ativo: true } });
  if (!pet) throw new Error("PET_NAO_ENCONTRADO");
  return prisma.fichaBanhoTosaPet.upsert({
    where: { petId },
    update: dados,
    create: { petId, ...dados },
  });
}

export async function adicionarAnexo({ empresaId, organizacaoId, ordemId, dados }) {
  await buscarOrdem({ empresaId, organizacaoId, id: ordemId });
  return prisma.anexoBanhoTosa.create({ data: { ordemId, tipo: dados.tipo, url: dados.url, legenda: dados.legenda || null } });
}

export async function removerAnexo({ empresaId, organizacaoId, ordemId, anexoId }) {
  const anexo = await prisma.anexoBanhoTosa.findFirst({
    where: { id: anexoId, ordemId, ordem: { empresaId, empresa: { organizacaoId } } },
  });
  if (!anexo) throw new Error("ANEXO_NAO_ENCONTRADO");
  await prisma.anexoBanhoTosa.delete({ where: { id: anexoId } });
  return true;
}
