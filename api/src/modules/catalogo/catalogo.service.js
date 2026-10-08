import prisma from "../../config/prisma.js";

function arredondar(valor, casas = 2) {
  const fator = 10 ** casas;
  return Math.round((Number(valor) + Number.EPSILON) * fator) / fator;
}

export function calcularPrecificacao({ custo, precoVenda, markupPercentual }) {
  const custoNumero = Number(custo ?? 0);
  if (!Number.isFinite(custoNumero) || custoNumero < 0) {
    throw new Error("CUSTO_INVALIDO");
  }

  let preco = precoVenda !== undefined && precoVenda !== null ? Number(precoVenda) : null;
  const markupInformado =
    markupPercentual !== undefined && markupPercentual !== null
      ? Number(markupPercentual)
      : null;

  if (preco === null) {
    if (markupInformado === null || !Number.isFinite(markupInformado)) {
      throw new Error("PRECO_OU_MARKUP_OBRIGATORIO");
    }
    preco = custoNumero * (1 + markupInformado / 100);
  }

  if (!Number.isFinite(preco) || preco < 0) throw new Error("PRECO_INVALIDO");

  const lucro = preco - custoNumero;
  const markup = custoNumero > 0 ? (lucro / custoNumero) * 100 : null;
  const margem = preco > 0 ? (lucro / preco) * 100 : null;

  return {
    custoReferencia: arredondar(custoNumero),
    precoVenda: arredondar(preco),
    lucroBruto: arredondar(lucro),
    markupPercentual: markup === null ? null : arredondar(markup, 4),
    margemBrutaPercentual: margem === null ? null : arredondar(margem, 4),
  };
}


async function validarCodigos({ empresaId, codigoInterno, codigoBarras, ignorarItemId }) {
  if (codigoInterno) {
    const existente = await prisma.itemCatalogo.findFirst({
      where: {
        empresaId,
        codigoInterno,
        ...(ignorarItemId ? { id: { not: ignorarItemId } } : {}),
      },
      select: { id: true },
    });
    if (existente) throw new Error("CODIGO_INTERNO_JA_EXISTE");
  }

  if (codigoBarras) {
    const existente = await prisma.itemCatalogo.findFirst({
      where: {
        empresaId,
        codigoBarras,
        ...(ignorarItemId ? { id: { not: ignorarItemId } } : {}),
      },
      select: { id: true },
    });
    if (existente) throw new Error("CODIGO_BARRAS_JA_EXISTE");
  }
}

async function validarCategoria({ organizacaoId, categoriaId, tipo }) {
  if (!categoriaId) return null;
  const categoria = await prisma.categoriaItem.findFirst({
    where: { id: categoriaId, organizacaoId, ativo: true },
  });
  if (!categoria) throw new Error("CATEGORIA_NAO_ENCONTRADA");
  if (tipo && categoria.tipo !== tipo) throw new Error("CATEGORIA_TIPO_INCOMPATIVEL");
  return categoria;
}

export async function listarCategorias(organizacaoId, tipo) {
  return prisma.categoriaItem.findMany({
    where: {
      organizacaoId,
      ...(tipo ? { tipo } : {}),
    },
    orderBy: [{ tipo: "asc" }, { ordem: "asc" }, { nome: "asc" }],
    include: {
      pai: { select: { id: true, nome: true } },
      _count: { select: { itens: true, filhas: true } },
    },
  });
}

export async function criarCategoria(organizacaoId, dados) {
  if (dados.parentId) {
    const pai = await validarCategoria({
      organizacaoId,
      categoriaId: dados.parentId,
      tipo: dados.tipo,
    });
    if (!pai) throw new Error("CATEGORIA_PAI_INVALIDA");
  }

  const existente = await prisma.categoriaItem.findFirst({
    where: {
      organizacaoId,
      tipo: dados.tipo,
      nome: { equals: dados.nome, mode: "insensitive" },
    },
  });
  if (existente) throw new Error("CATEGORIA_JA_EXISTE");

  return prisma.categoriaItem.create({
    data: {
      organizacaoId,
      tipo: dados.tipo,
      nome: dados.nome.trim(),
      descricao: dados.descricao || null,
      parentId: dados.parentId || null,
      ordem: dados.ordem ?? 0,
      ativo: dados.ativo ?? true,
    },
  });
}

export async function atualizarCategoria(organizacaoId, id, dados) {
  const atual = await prisma.categoriaItem.findFirst({ where: { id, organizacaoId } });
  if (!atual) throw new Error("CATEGORIA_NAO_ENCONTRADA");

  const tipo = dados.tipo ?? atual.tipo;

  if (dados.tipo && dados.tipo !== atual.tipo) {
    const [itensVinculados, filhasVinculadas] = await Promise.all([
      prisma.itemCatalogo.count({ where: { categoriaId: id } }),
      prisma.categoriaItem.count({ where: { parentId: id } }),
    ]);
    if (itensVinculados > 0 || filhasVinculadas > 0) {
      throw new Error("CATEGORIA_TIPO_EM_USO");
    }
  }

  const parentIdEfetivo = Object.prototype.hasOwnProperty.call(dados, "parentId")
    ? dados.parentId || null
    : atual.parentId;

  if (parentIdEfetivo) {
    if (parentIdEfetivo === id) throw new Error("CATEGORIA_PAI_INVALIDA");
    let pai = await validarCategoria({ organizacaoId, categoriaId: parentIdEfetivo, tipo });

    // Impede ciclos na árvore (A -> B -> A, por exemplo).
    while (pai?.parentId) {
      if (pai.parentId === id) throw new Error("CATEGORIA_PAI_INVALIDA");
      pai = await validarCategoria({ organizacaoId, categoriaId: pai.parentId, tipo });
    }
  }

  if (dados.nome && (dados.nome !== atual.nome || tipo !== atual.tipo)) {
    const duplicada = await prisma.categoriaItem.findFirst({
      where: {
        organizacaoId,
        tipo,
        id: { not: id },
        nome: { equals: dados.nome, mode: "insensitive" },
      },
    });
    if (duplicada) throw new Error("CATEGORIA_JA_EXISTE");
  }

  return prisma.categoriaItem.update({
    where: { id },
    data: {
      ...(dados.tipo ? { tipo: dados.tipo } : {}),
      ...(dados.nome ? { nome: dados.nome.trim() } : {}),
      ...(Object.prototype.hasOwnProperty.call(dados, "descricao")
        ? { descricao: dados.descricao || null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(dados, "parentId")
        ? { parentId: dados.parentId || null }
        : {}),
      ...(dados.ordem !== undefined ? { ordem: dados.ordem } : {}),
      ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
    },
  });
}

export async function listarItens({ empresaId, organizacaoId, tipo, busca, ativo }) {
  return prisma.itemCatalogo.findMany({
    where: {
      empresaId,
      empresa: { organizacaoId },
      ...(tipo ? { tipo } : {}),
      ...(ativo !== undefined ? { ativo } : {}),
      ...(busca
        ? {
            OR: [
              { nome: { contains: busca, mode: "insensitive" } },
              { codigoInterno: { contains: busca, mode: "insensitive" } },
              { codigoBarras: { contains: busca } },
            ],
          }
        : {}),
    },
    orderBy: { nome: "asc" },
    include: {
      categoria: true,
      produto: true,
      servico: true,
    },
  });
}

export async function buscarItem({ empresaId, organizacaoId, id }) {
  const item = await prisma.itemCatalogo.findFirst({
    where: { id, empresaId, empresa: { organizacaoId } },
    include: {
      categoria: true,
      produto: true,
      servico: true,
      fiscalConfig: true,
      historicosPreco: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { usuario: { select: { id: true, nome: true } } },
      },
    },
  });
  if (!item) throw new Error("ITEM_NAO_ENCONTRADO");
  return item;
}

export async function criarItem({ empresaId, organizacaoId, usuarioId, dados }) {
  await validarCategoria({
    organizacaoId,
    categoriaId: dados.categoriaId,
    tipo: dados.tipo,
  });

  await validarCodigos({
    empresaId,
    codigoInterno: dados.codigoInterno || null,
    codigoBarras: dados.codigoBarras || null,
  });

  const precificacao = calcularPrecificacao({
    custo: dados.custoReferencia,
    precoVenda: dados.precoVenda,
    markupPercentual: dados.markupPercentual,
  });

  return prisma.$transaction(async (tx) => {
    const item = await tx.itemCatalogo.create({
      data: {
        empresaId,
        categoriaId: dados.categoriaId || null,
        tipo: dados.tipo,
        nome: dados.nome.trim(),
        descricao: dados.descricao || null,
        codigoInterno: dados.codigoInterno || null,
        codigoBarras: dados.codigoBarras || null,
        ...precificacao,
        ativo: dados.ativo ?? true,
      },
    });

    if (dados.tipo === "PRODUTO") {
      await tx.produto.create({
        data: {
          itemId: item.id,
          unidade: dados.produto?.unidade ?? "UNIDADE",
          marca: dados.produto?.marca || null,
          custoMedio: precificacao.custoReferencia,
          estoqueMinimo: dados.produto?.estoqueMinimo ?? 0,
          controlaEstoque: dados.produto?.controlaEstoque ?? true,
          controlaLote: dados.produto?.controlaLote ?? false,
          controlaValidade: dados.produto?.controlaValidade ?? false,
        },
      });
    } else {
      await tx.servico.create({
        data: {
          itemId: item.id,
          duracaoMinutos: dados.servico?.duracaoMinutos ?? null,
          geraComissao: dados.servico?.geraComissao ?? false,
          percentualComissao: dados.servico?.percentualComissao ?? null,
          permiteAgendamento: dados.servico?.permiteAgendamento ?? true,
          exigePet: dados.servico?.exigePet ?? true,
          exigeProfissional: dados.servico?.exigeProfissional ?? false,
        },
      });
    }

    await tx.historicoPrecoItem.create({
      data: {
        itemCatalogoId: item.id,
        usuarioId,
        ...precificacao,
      },
    });

    return tx.itemCatalogo.findUnique({
      where: { id: item.id },
      include: { categoria: true, produto: true, servico: true },
    });
  });
}

export async function atualizarItem({ empresaId, organizacaoId, usuarioId, id, dados }) {
  const atual = await prisma.itemCatalogo.findFirst({
    where: { id, empresaId, empresa: { organizacaoId } },
    include: { produto: true, servico: true },
  });
  if (!atual) throw new Error("ITEM_NAO_ENCONTRADO");

  await validarCategoria({
    organizacaoId,
    categoriaId: Object.prototype.hasOwnProperty.call(dados, "categoriaId")
      ? dados.categoriaId
      : atual.categoriaId,
    tipo: atual.tipo,
  });

  await validarCodigos({
    empresaId,
    codigoInterno: Object.prototype.hasOwnProperty.call(dados, "codigoInterno")
      ? dados.codigoInterno || null
      : atual.codigoInterno,
    codigoBarras: Object.prototype.hasOwnProperty.call(dados, "codigoBarras")
      ? dados.codigoBarras || null
      : atual.codigoBarras,
    ignorarItemId: id,
  });

  const custo = dados.custoReferencia ?? Number(atual.custoReferencia);
  const precoFoiInformado = dados.precoVenda !== undefined;
  const markupFoiInformado = dados.markupPercentual !== undefined;
  const precificacao =
    precoFoiInformado || markupFoiInformado || dados.custoReferencia !== undefined
      ? calcularPrecificacao({
          custo,
          precoVenda: precoFoiInformado ? dados.precoVenda : markupFoiInformado ? undefined : Number(atual.precoVenda),
          markupPercentual: markupFoiInformado ? dados.markupPercentual : undefined,
        })
      : null;

  return prisma.$transaction(async (tx) => {
    await tx.itemCatalogo.update({
      where: { id },
      data: {
        ...(Object.prototype.hasOwnProperty.call(dados, "categoriaId")
          ? { categoriaId: dados.categoriaId || null }
          : {}),
        ...(dados.nome ? { nome: dados.nome.trim() } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "descricao")
          ? { descricao: dados.descricao || null }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "codigoInterno")
          ? { codigoInterno: dados.codigoInterno || null }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "codigoBarras")
          ? { codigoBarras: dados.codigoBarras || null }
          : {}),
        ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
        ...(precificacao || {}),
      },
    });

    if (atual.tipo === "PRODUTO" && dados.produto) {
      await tx.produto.update({
        where: { itemId: id },
        data: {
          ...(dados.produto.unidade ? { unidade: dados.produto.unidade } : {}),
          ...(Object.prototype.hasOwnProperty.call(dados.produto, "marca")
            ? { marca: dados.produto.marca || null }
            : {}),
          ...(dados.produto.estoqueMinimo !== undefined
            ? { estoqueMinimo: dados.produto.estoqueMinimo }
            : {}),
          ...(dados.produto.controlaEstoque !== undefined
            ? { controlaEstoque: dados.produto.controlaEstoque }
            : {}),
          ...(dados.produto.controlaLote !== undefined
            ? { controlaLote: dados.produto.controlaLote }
            : {}),
          ...(dados.produto.controlaValidade !== undefined
            ? { controlaValidade: dados.produto.controlaValidade }
            : {}),
          ...(precificacao ? { custoMedio: precificacao.custoReferencia } : {}),
        },
      });
    }

    if (atual.tipo === "SERVICO" && dados.servico) {
      await tx.servico.update({
        where: { itemId: id },
        data: dados.servico,
      });
    }

    if (precificacao) {
      await tx.historicoPrecoItem.create({
        data: { itemCatalogoId: id, usuarioId, ...precificacao },
      });
    }

    return tx.itemCatalogo.findUnique({
      where: { id },
      include: { categoria: true, produto: true, servico: true },
    });
  });
}
