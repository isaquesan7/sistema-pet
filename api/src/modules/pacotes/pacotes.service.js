import prisma from "../../config/prisma.js";

function data(valor) {
  return valor ? new Date(`${valor}T00:00:00.000Z`) : null;
}

function validarPeriodo(inicio, fim) {
  if (inicio && fim && fim < inicio) {
    throw new Error("PERIODO_INVALIDO");
  }
}

async function validarItens(empresaId, itens) {
  const ids = [...new Set(itens.map((item) => item.itemCatalogoId))];
  const encontrados = await prisma.itemCatalogo.findMany({
    where: { id: { in: ids }, empresaId, ativo: true },
    select: { id: true },
  });
  if (encontrados.length !== ids.length) throw new Error("ITEM_PACOTE_INVALIDO");
}

export async function listarModelos(organizacaoId, empresaId) {
  return prisma.pacoteModelo.findMany({
    where: { organizacaoId, empresaId },
    orderBy: { nome: "asc" },
    include: {
      itens: {
        include: {
          itemCatalogo: { select: { id: true, nome: true, tipo: true, precoVenda: true } },
        },
      },
    },
  });
}

export async function criarModelo(organizacaoId, empresaId, dados) {
  await validarItens(empresaId, dados.itens);
  const inicioVigencia = data(dados.inicioVigencia);
  const fimVigencia = data(dados.fimVigencia);
  validarPeriodo(inicioVigencia, fimVigencia);

  return prisma.pacoteModelo.create({
    data: {
      organizacaoId,
      empresaId,
      nome: dados.nome,
      descricao: dados.descricao || null,
      tipo: dados.tipo,
      valorPacote: dados.valorPacote,
      validadeDias: dados.validadeDias ?? null,
      inicioVigencia,
      fimVigencia,
      visivelPortal: dados.visivelPortal ?? false,
      ativo: dados.ativo ?? true,
      itens: {
        create: dados.itens.map((item) => ({
          itemCatalogoId: item.itemCatalogoId,
          quantidade: item.quantidade,
        })),
      },
    },
    include: { itens: { include: { itemCatalogo: true } } },
  });
}

export async function atualizarModelo(organizacaoId, empresaId, id, dados) {
  const atual = await prisma.pacoteModelo.findFirst({
    where: { id, organizacaoId, empresaId },
    include: { itens: true },
  });
  if (!atual) throw new Error("MODELO_NAO_ENCONTRADO");

  if (dados.itens) await validarItens(empresaId, dados.itens);

  const inicioVigencia = Object.prototype.hasOwnProperty.call(dados, "inicioVigencia")
    ? data(dados.inicioVigencia)
    : atual.inicioVigencia;
  const fimVigencia = Object.prototype.hasOwnProperty.call(dados, "fimVigencia")
    ? data(dados.fimVigencia)
    : atual.fimVigencia;
  validarPeriodo(inicioVigencia, fimVigencia);

  return prisma.$transaction(async (tx) => {
    await tx.pacoteModelo.update({
      where: { id },
      data: {
        ...(dados.nome ? { nome: dados.nome.trim() } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "descricao")
          ? { descricao: dados.descricao || null }
          : {}),
        ...(dados.tipo ? { tipo: dados.tipo } : {}),
        ...(dados.valorPacote !== undefined ? { valorPacote: dados.valorPacote } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "validadeDias")
          ? { validadeDias: dados.validadeDias ?? null }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "inicioVigencia")
          ? { inicioVigencia }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "fimVigencia")
          ? { fimVigencia }
          : {}),
        ...(dados.visivelPortal !== undefined ? { visivelPortal: dados.visivelPortal } : {}),
        ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
      },
    });

    if (dados.itens) {
      await tx.pacoteModeloItem.deleteMany({ where: { pacoteModeloId: id } });
      await tx.pacoteModeloItem.createMany({
        data: dados.itens.map((item) => ({
          pacoteModeloId: id,
          itemCatalogoId: item.itemCatalogoId,
          quantidade: item.quantidade,
        })),
      });
    }

    return tx.pacoteModelo.findUnique({
      where: { id },
      include: { itens: { include: { itemCatalogo: true } } },
    });
  });
}

export async function listarPacotesCliente({ organizacaoId, empresaId, clienteId, status }) {
  return prisma.pacoteCliente.findMany({
    where: {
      organizacaoId,
      empresaId,
      ...(clienteId ? { clienteId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      cliente: { select: { id: true, nome: true } },
      pet: { select: { id: true, nome: true } },
      itens: {
        include: {
          itemCatalogo: { select: { id: true, nome: true, tipo: true } },
        },
      },
    },
  });
}

async function validarClientePet(organizacaoId, clienteId, petId) {
  const cliente = await prisma.cliente.findFirst({ where: { id: clienteId, organizacaoId, ativo: true } });
  if (!cliente) throw new Error("CLIENTE_NAO_ENCONTRADO");
  if (petId) {
    const pet = await prisma.pet.findFirst({ where: { id: petId, clienteId, ativo: true } });
    if (!pet) throw new Error("PET_NAO_ENCONTRADO");
  }
}

export async function criarPacoteCliente(organizacaoId, empresaId, dados) {
  await validarClientePet(organizacaoId, dados.clienteId, dados.petId);

  const inicioValidade = data(dados.inicioValidade);
  const fimValidadeInformada = data(dados.fimValidade);
  validarPeriodo(inicioValidade, fimValidadeInformada);

  if (dados.modeloId) {
    const modelo = await prisma.pacoteModelo.findFirst({
      where: { id: dados.modeloId, organizacaoId, empresaId, ativo: true },
      include: { itens: true },
    });
    if (!modelo) throw new Error("MODELO_NAO_ENCONTRADO");

    const hoje = new Date();
    const inicioModelo = modelo.inicioVigencia
      ? new Date(`${modelo.inicioVigencia.toISOString().slice(0, 10)}T00:00:00.000Z`)
      : null;
    const fimModelo = modelo.fimVigencia
      ? new Date(`${modelo.fimVigencia.toISOString().slice(0, 10)}T23:59:59.999Z`)
      : null;
    if ((inicioModelo && hoje < inicioModelo) || (fimModelo && hoje > fimModelo)) {
      throw new Error("MODELO_FORA_VIGENCIA");
    }

    return prisma.pacoteCliente.create({
      data: {
        organizacaoId,
        empresaId,
        modeloId: modelo.id,
        clienteId: dados.clienteId,
        petId: dados.petId || null,
        tipo: modelo.tipo,
        nome: dados.nome || modelo.nome,
        valorPacote: dados.valorPacote ?? modelo.valorPacote,
        inicioValidade,
        fimValidade:
          fimValidadeInformada ||
          (modelo.validadeDias
            ? new Date(new Date(`${dados.inicioValidade}T00:00:00.000Z`).getTime() + modelo.validadeDias * 86400000)
            : null),
        observacoes: dados.observacoes || null,
        itens: {
          create: modelo.itens.map((item) => ({
            itemCatalogoId: item.itemCatalogoId,
            quantidadeTotal: item.quantidade,
          })),
        },
      },
      include: { itens: { include: { itemCatalogo: true } } },
    });
  }

  if (!dados.itens?.length || !dados.valorPacote || !dados.nome) {
    throw new Error("PACOTE_PERSONALIZADO_INCOMPLETO");
  }

  await validarItens(empresaId, dados.itens);

  return prisma.pacoteCliente.create({
    data: {
      organizacaoId,
      empresaId,
      clienteId: dados.clienteId,
      petId: dados.petId || null,
      tipo: "PERSONALIZADO",
      nome: dados.nome,
      valorPacote: dados.valorPacote,
      inicioValidade,
      fimValidade: fimValidadeInformada,
      observacoes: dados.observacoes || null,
      itens: {
        create: dados.itens.map((item) => ({
          itemCatalogoId: item.itemCatalogoId,
          quantidadeTotal: item.quantidade,
        })),
      },
    },
    include: { itens: { include: { itemCatalogo: true } } },
  });
}

export async function consumir({ organizacaoId, empresaId, usuarioId, pacoteItemId, dados }) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.pacoteClienteItem.findFirst({
      where: {
        id: pacoteItemId,
        pacoteCliente: { organizacaoId, empresaId, status: "ATIVO" },
      },
      include: { pacoteCliente: true },
    });
    if (!item) throw new Error("ITEM_PACOTE_CLIENTE_NAO_ENCONTRADO");

    const hoje = new Date();
    const inicio = new Date(`${item.pacoteCliente.inicioValidade.toISOString().slice(0, 10)}T00:00:00.000Z`);
    const fim = item.pacoteCliente.fimValidade
      ? new Date(`${item.pacoteCliente.fimValidade.toISOString().slice(0, 10)}T23:59:59.999Z`)
      : null;

    if (hoje < inicio) throw new Error("PACOTE_FORA_VIGENCIA");
    if (fim && hoje > fim) {
      await tx.pacoteCliente.update({
        where: { id: item.pacoteClienteId },
        data: { status: "EXPIRADO" },
      });
      throw new Error("PACOTE_EXPIRADO");
    }

    const total = Number(item.quantidadeTotal);
    const consumido = Number(item.quantidadeConsumida);
    const quantidade = Number(dados.quantidade);
    if (consumido + quantidade > total) throw new Error("SALDO_PACOTE_INSUFICIENTE");

    if (dados.petId) {
      const pet = await tx.pet.findFirst({
        where: {
          id: dados.petId,
          clienteId: item.pacoteCliente.clienteId,
          ativo: true,
        },
      });
      if (!pet) throw new Error("PET_NAO_ENCONTRADO");
    }

    await tx.pacoteClienteItem.update({
      where: { id: item.id },
      data: { quantidadeConsumida: { increment: quantidade } },
    });

    const consumo = await tx.consumoPacote.create({
      data: {
        pacoteClienteItemId: item.id,
        usuarioId,
        petId: dados.petId || item.pacoteCliente.petId || null,
        quantidade,
        origemTipo: dados.origemTipo || null,
        origemId: dados.origemId || null,
        observacao: dados.observacao || null,
      },
    });

    const saldos = await tx.pacoteClienteItem.findMany({
      where: { pacoteClienteId: item.pacoteClienteId },
    });
    const esgotado = saldos.every((saldo) => Number(saldo.quantidadeConsumida) >= Number(saldo.quantidadeTotal));
    if (esgotado) {
      await tx.pacoteCliente.update({
        where: { id: item.pacoteClienteId },
        data: { status: "ESGOTADO" },
      });
    }

    return consumo;
  });
}
