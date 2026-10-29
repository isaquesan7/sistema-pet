import prisma from "../../config/prisma.js";
import { criarRecebivelFiadoNoTx } from "../financeiro/financeiro.service.js";
import { criarDocumentoAutomaticoVenda } from "../fiscal/fiscal.service.js";
import {travarUnidadesProdutos} from "../catalogo/catalogo-unidade.service.js";
import {buscarCatalogo as buscarCatalogoUnificado} from "./pdv-unificado.service.js";
import {checkoutManualHabilitado,empresaManualAutorizada} from "./pdv-unificado-checkout-manual.gate.js";

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function validarCliente(tx, organizacaoId, clienteId, obrigatorio = false) {
  if (!clienteId) {
    if (obrigatorio) throw new Error("CLIENTE_OBRIGATORIO");
    return null;
  }

  const cliente = await tx.cliente.findFirst({
    where: { id: clienteId, organizacaoId, ativo: true },
    select: { id: true, nome: true },
  });
  if (!cliente) throw new Error("CLIENTE_NAO_ENCONTRADO");
  return cliente;
}

async function validarPet(tx, organizacaoId, petId, clienteId) {
  if (!petId) return null;
  const pet = await tx.pet.findFirst({
    where: {
      id: petId,
      ativo: true,
      cliente: { organizacaoId, ...(clienteId ? { id: clienteId } : {}) },
    },
    select: { id: true, nome: true, clienteId: true },
  });
  if (!pet) throw new Error("PET_NAO_ENCONTRADO");
  return pet;
}

async function prepararItens(tx, { empresaId, organizacaoId, clienteId, itens }) {
  const ids = [...new Set(itens.map((item) => item.itemCatalogoId))];
  await travarUnidadesProdutos(tx, ids);
  const catalogo = await tx.itemCatalogo.findMany({
    where: {
      id: { in: ids },
      empresaId,
      ativo: true,
      empresa: { organizacaoId },
    },
    include: { produto: { include: { estoque: true } }, servico: true },
  });

  if (catalogo.length !== ids.length) throw new Error("ITEM_NAO_ENCONTRADO");
  const byId = new Map(catalogo.map((item) => [item.id, item]));

  const preparados = [];
  for (const entrada of itens) {
    const item = byId.get(entrada.itemCatalogoId);
    const quantidade = number(entrada.quantidade);
    const desconto = roundMoney(number(entrada.desconto));
    if (quantidade <= 0 || desconto < 0) throw new Error("VALORES_INVALIDOS");
    // Serviços são atos indivisíveis: 1, 2, 3... Produto a granel preserva frações.
    if (item.tipo === "SERVICO" && (!Number.isInteger(quantidade) || quantidade < 1)) {
      throw new Error("QUANTIDADE_SERVICO_INTEIRA");
    }
    if (item.tipo === "SERVICO" && !clienteId) throw new Error("CLIENTE_OBRIGATORIO_SERVICO");
    const pet = await validarPet(tx, organizacaoId, entrada.petId, clienteId);
    if (item.tipo === "SERVICO" && !pet) throw new Error("PET_OBRIGATORIO_SERVICO");

    const bruto = roundMoney(number(item.precoVenda) * quantidade);
    if (desconto > bruto) throw new Error("DESCONTO_INVALIDO");

    preparados.push({
      item,
      pet,
      quantidade,
      desconto,
      valorUnitario: roundMoney(item.precoVenda),
      valorTotal: roundMoney(bruto - desconto),
    });
  }

  return preparados;
}

async function validarSessao(tx, empresaId, sessaoCaixaId) {
  const sessao = await tx.sessaoCaixa.findFirst({
    where: {
      id: sessaoCaixaId,
      status: "ABERTO",
      caixa: { empresaId, ativo: true },
    },
    include: { caixa: true },
  });
  if (!sessao) throw new Error("CAIXA_NAO_ABERTO");
  return sessao;
}

function validarTotais({ itens, desconto, acrescimo, pagamentos }) {
  const subtotal = roundMoney(itens.reduce((sum, item) => sum + item.valorTotal, 0));
  const descontoVenda = roundMoney(number(desconto));
  const acrescimoVenda = roundMoney(number(acrescimo));
  if (descontoVenda < 0 || descontoVenda > subtotal || acrescimoVenda < 0) {
    throw new Error("DESCONTO_INVALIDO");
  }

  const total = roundMoney(subtotal - descontoVenda + acrescimoVenda);
  const totalPagamentos = roundMoney(
    pagamentos.reduce((sum, pagamento) => sum + number(pagamento.valor), 0)
  );

  if (Math.abs(totalPagamentos - total) > 0.009) throw new Error("PAGAMENTO_DIVERGENTE");
  return { subtotal, descontoVenda, acrescimoVenda, total };
}

async function baixarEstoque(tx, { empresaId, usuarioId, vendaId, itens }) {
  for (const linha of itens) {
    const produto = linha.item.produto;
    if (!produto?.controlaEstoque) continue;

    let restante = linha.quantidade;

    if (produto.controlaLote) {
      const inicioHoje = new Date();
      inicioHoje.setHours(0, 0, 0, 0);
      const lotes = await tx.loteProduto.findMany({
        where: {
          produtoId: produto.id,
          quantidadeAtual: { gt: 0 },
          OR: [{ dataValidade: null }, { dataValidade: { gte: inicioHoje } }],
        },
        orderBy: [{ dataValidade: "asc" }, { createdAt: "asc" }],
      });

      const disponivel = lotes.reduce((sum, lote) => sum + number(lote.quantidadeAtual), 0);
      if (disponivel + 0.0001 < restante) {
        const error = new Error("ESTOQUE_LOTE_INSUFICIENTE");
        error.itemNome = linha.item.nome;
        throw error;
      }

      for (const lote of lotes) {
        if (restante <= 0.0001) break;
        const retirar = Math.min(restante, number(lote.quantidadeAtual));
        const saldo = await tx.estoqueSaldo.findUnique({ where: { produtoId: produto.id } });
        const saldoAnterior = number(saldo?.quantidade);
        const saldoPosterior = saldoAnterior - retirar;
        if (saldoPosterior < -0.0001) {
          const error = new Error("ESTOQUE_INSUFICIENTE");
          error.itemNome = linha.item.nome;
          throw error;
        }

        await tx.loteProduto.update({
          where: { id: lote.id },
          data: { quantidadeAtual: number(lote.quantidadeAtual) - retirar },
        });
        await tx.estoqueSaldo.upsert({
          where: { produtoId: produto.id },
          update: { quantidade: saldoPosterior },
          create: { produtoId: produto.id, quantidade: saldoPosterior },
        });
        await tx.movimentacaoEstoque.create({
          data: {
            empresaId,
            produtoId: produto.id,
            loteId: lote.id,
            usuarioId,
            tipo: "VENDA",
            quantidade: retirar,
            saldoAnterior,
            saldoPosterior,
            custoUnitario: produto.custoMedio,
            origemTipo: "VENDA",
            origemId: vendaId,
          },
        });
        restante -= retirar;
      }
      continue;
    }

    const saldoAtual = await tx.estoqueSaldo.findUnique({ where: { produtoId: produto.id } });
    const saldoAnterior = number(saldoAtual?.quantidade);
    const saldoPosterior = saldoAnterior - linha.quantidade;
    if (saldoPosterior < -0.0001) {
      const error = new Error("ESTOQUE_INSUFICIENTE");
      error.itemNome = linha.item.nome;
      throw error;
    }

    await tx.estoqueSaldo.upsert({
      where: { produtoId: produto.id },
      update: { quantidade: saldoPosterior },
      create: { produtoId: produto.id, quantidade: saldoPosterior },
    });

    await tx.movimentacaoEstoque.create({
      data: {
        empresaId,
        produtoId: produto.id,
        usuarioId,
        tipo: "VENDA",
        quantidade: linha.quantidade,
        saldoAnterior,
        saldoPosterior,
        custoUnitario: produto.custoMedio,
        origemTipo: "VENDA",
        origemId: vendaId,
      },
    });
  }
}

async function restaurarEstoque(tx, { venda, usuarioId }) {
  const movimentos = await tx.movimentacaoEstoque.findMany({
    where: {
      empresaId: venda.empresaId,
      origemTipo: "VENDA",
      origemId: venda.id,
      tipo: "VENDA",
    },
    include: { produto: true, lote: true },
    orderBy: { createdAt: "asc" },
  });

  for (const movimento of movimentos) {
    const quantidade = number(movimento.quantidade);
    const saldo = await tx.estoqueSaldo.findUnique({ where: { produtoId: movimento.produtoId } });
    const saldoAnterior = number(saldo?.quantidade);
    const saldoPosterior = saldoAnterior + quantidade;

    await tx.estoqueSaldo.upsert({
      where: { produtoId: movimento.produtoId },
      update: { quantidade: saldoPosterior },
      create: { produtoId: movimento.produtoId, quantidade: saldoPosterior },
    });

    if (movimento.loteId) {
      const lote = await tx.loteProduto.findUnique({ where: { id: movimento.loteId } });
      if (lote) {
        await tx.loteProduto.update({
          where: { id: lote.id },
          data: { quantidadeAtual: number(lote.quantidadeAtual) + quantidade },
        });
      }
    }

    await tx.movimentacaoEstoque.create({
      data: {
        empresaId: venda.empresaId,
        produtoId: movimento.produtoId,
        loteId: movimento.loteId,
        usuarioId,
        tipo: "CANCELAMENTO",
        quantidade,
        saldoAnterior,
        saldoPosterior,
        custoUnitario: movimento.custoUnitario,
        origemTipo: "CANCELAMENTO_VENDA",
        origemId: venda.id,
      },
    });
  }
}

async function criarVendaNoTx(tx, {
  empresaId,
  organizacaoId,
  usuarioId,
  clienteId,
  comandaId = null,
  sessaoCaixaId,
  itensEntrada,
  pagamentos,
  desconto = 0,
  acrescimo = 0,
  observacoes,
  itensPreparados = null,
}) {
  await validarSessao(tx, empresaId, sessaoCaixaId);
  await validarCliente(tx, organizacaoId, clienteId, false);
  const itens = itensPreparados || await prepararItens(tx, {
    empresaId,
    organizacaoId,
    clienteId,
    itens: itensEntrada,
  });

  const totais = validarTotais({ itens, desconto, acrescimo, pagamentos });

  const venda = await tx.venda.create({
    data: {
      empresaId,
      comandaId,
      clienteId: clienteId || null,
      usuarioId,
      status: "FINALIZADA",
      subtotal: totais.subtotal,
      desconto: totais.descontoVenda,
      acrescimo: totais.acrescimoVenda,
      valorTotal: totais.total,
      observacoes: observacoes || null,
      finalizadaEm: new Date(),
    },
  });

  for (const linha of itens) {
    await tx.vendaItem.create({
      data: {
        vendaId: venda.id,
        itemCatalogoId: linha.item.id,
        comandaItemId: linha.comandaItemId || null,
        petId: linha.pet?.id || null,
        descricao: linha.item.nome,
        quantidade: linha.quantidade,
        valorUnitario: linha.valorUnitario,
        desconto: linha.desconto,
        valorTotal: linha.valorTotal,
      },
    });
  }

  for (const pagamento of pagamentos) {
    if (pagamento.forma === "CREDITO_CLIENTE" && !clienteId) throw new Error("CLIENTE_OBRIGATORIO_CREDITO");
    const pagamentoCriado = await tx.pagamento.create({
      data: {
        vendaId: venda.id,
        sessaoCaixaId,
        forma: pagamento.forma,
        status: pagamento.forma === "CREDITO_CLIENTE" ? "PENDENTE" : "APROVADO",
        valor: roundMoney(pagamento.valor),
        parcelas: pagamento.parcelas || 1,
        transacaoExternaId: pagamento.transacaoExternaId || null,
        codigoAutorizacao: pagamento.codigoAutorizacao || null,
        observacoes: pagamento.observacoes || null,
        pagoEm: pagamento.forma === "CREDITO_CLIENTE" ? null : new Date(),
      },
    });
    if (pagamento.forma === "CREDITO_CLIENTE") {
      await criarRecebivelFiadoNoTx(tx, {
        organizacaoId, empresaId, clienteId, venda, pagamento: pagamentoCriado,
        vencimentoEm: pagamento.vencimentoEm,
      });
    }
  }

  await baixarEstoque(tx, { empresaId, usuarioId, vendaId: venda.id, itens });
  return venda;
}

export async function listarCaixas(empresaId) {
  return prisma.caixa.findMany({
    where: { empresaId },
    orderBy: { nome: "asc" },
    include: {
      sessoes: {
        where: { status: "ABERTO" },
        orderBy: { dataAbertura: "desc" },
        take: 1,
        include: { usuarioAbertura: { select: { id: true, nome: true } } },
      },
    },
  });
}

export async function criarCaixa(empresaId, dados) {
  const existente = await prisma.caixa.findFirst({
    where: { empresaId, nome: { equals: dados.nome, mode: "insensitive" } },
  });
  if (existente) throw new Error("CAIXA_JA_EXISTE");
  return prisma.caixa.create({
    data: { empresaId, nome: dados.nome.trim(), descricao: dados.descricao || null },
  });
}

export async function obterSessaoAberta(empresaId) {
  return prisma.sessaoCaixa.findFirst({
    where: { status: "ABERTO", caixa: { empresaId } },
    orderBy: { dataAbertura: "desc" },
    include: {
      caixa: true,
      usuarioAbertura: { select: { id: true, nome: true } },
      pagamentos: { where: { status: { in: ["APROVADO", "PENDENTE"] } } },
      movimentacoes: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function abrirCaixa({ empresaId, usuarioId, caixaId, dados }) {
  return prisma.$transaction(async (tx) => {
    const caixa = await tx.caixa.findFirst({ where: { id: caixaId, empresaId, ativo: true } });
    if (!caixa) throw new Error("CAIXA_NAO_ENCONTRADO");

    const aberta = await tx.sessaoCaixa.findFirst({
      where: { caixaId, status: "ABERTO" },
    });
    if (aberta) throw new Error("CAIXA_JA_ABERTO");

    return tx.sessaoCaixa.create({
      data: {
        caixaId,
        usuarioAberturaId: usuarioId,
        valorAbertura: roundMoney(dados.valorAbertura),
        observacoes: dados.observacoes || null,
      },
      include: { caixa: true },
    });
  });
}

export async function movimentarCaixa({ empresaId, usuarioId, sessaoId, dados }) {
  return prisma.$transaction(async (tx) => {
    await validarSessao(tx, empresaId, sessaoId);
    return tx.movimentacaoCaixa.create({
      data: {
        sessaoCaixaId: sessaoId,
        usuarioId,
        tipo: dados.tipo,
        valor: roundMoney(dados.valor),
        descricao: dados.descricao,
      },
    });
  });
}

export async function fecharCaixa({ empresaId, usuarioId, sessaoId, dados }) {
  return prisma.$transaction(async (tx) => {
    const sessao = await validarSessao(tx, empresaId, sessaoId);

    const pagamentosDinheiro = await tx.pagamento.aggregate({
      where: { sessaoCaixaId: sessaoId, forma: "DINHEIRO", status: "APROVADO" },
      _sum: { valor: true },
    });
    const movimentos = await tx.movimentacaoCaixa.findMany({ where: { sessaoCaixaId: sessaoId } });

    let esperado = number(sessao.valorAbertura) + number(pagamentosDinheiro._sum.valor);
    for (const mov of movimentos) {
      if (["SUPRIMENTO", "RECEBIMENTO"].includes(mov.tipo)) esperado += number(mov.valor);
      if (["SANGRIA", "ESTORNO"].includes(mov.tipo)) esperado -= number(mov.valor);
    }
    esperado = roundMoney(esperado);
    const valorFechamento = roundMoney(dados.valorFechamento);

    return tx.sessaoCaixa.update({
      where: { id: sessaoId },
      data: {
        status: "FECHADO",
        usuarioFechamentoId: usuarioId,
        dataFechamento: new Date(),
        valorFechamento,
        valorEsperado: esperado,
        diferencaFechamento: roundMoney(valorFechamento - esperado),
        observacoes: dados.observacoes || sessao.observacoes,
      },
      include: { caixa: true },
    });
  });
}

export async function resumo(empresaId) {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);

  const [sessao, vendasHoje, comandasAbertas] = await Promise.all([
    obterSessaoAberta(empresaId),
    prisma.venda.aggregate({
      where: { empresaId, status: "FINALIZADA", createdAt: { gte: inicio } },
      _count: { id: true },
      _sum: { valorTotal: true },
    }),
    prisma.comanda.count({
      where: {
        status: { in: ["ABERTA", "PARCIALMENTE_FECHADA"] },
        rascunhoUnificado: false,
        itens: { some: { empresaId, status: "ATIVO" } },
      },
    }),
  ]);

  return {
    sessao,
    vendasHoje: vendasHoje._count.id,
    faturamentoHoje: number(vendasHoje._sum.valorTotal),
    comandasAbertas,
  };
}

export async function listarItensPdv({ empresaId, organizacaoId, busca }) {
  return prisma.itemCatalogo.findMany({
    where: {
      empresaId,
      ativo: true,
      empresa: { organizacaoId },
      ...(busca ? {
        OR: [
          { nome: { contains: busca, mode: "insensitive" } },
          { codigoInterno: { contains: busca, mode: "insensitive" } },
          { codigoBarras: { contains: busca, mode: "insensitive" } },
        ],
      } : {}),
    },
    orderBy: [{ tipo: "asc" }, { nome: "asc" }],
    take: 100,
    include: {
      categoria: { select: { id: true, nome: true } },
      produto: { include: { estoque: true } },
      servico: true,
    },
  });
}

export async function criarVenda({ empresaId, organizacaoId, usuarioId, dados }) {
  const venda = await prisma.$transaction(async (tx) => {
    const criada = await criarVendaNoTx(tx, {
      empresaId,
      organizacaoId,
      usuarioId,
      clienteId: dados.clienteId,
      sessaoCaixaId: dados.sessaoCaixaId,
      itensEntrada: dados.itens,
      pagamentos: dados.pagamentos,
      desconto: dados.desconto,
      acrescimo: dados.acrescimo,
      observacoes: dados.observacoes,
    });

    return tx.venda.findUnique({
      where: { id: criada.id },
      include: {
        cliente: { select: { id: true, nome: true } },
        itens: { include: { itemCatalogo: true, pet: { select: { id: true, nome: true } } } },
        pagamentos: true,
      },
    });
  });
  await criarDocumentoAutomaticoVenda({ empresaId, organizacaoId, usuarioId, vendaId: venda.id });
  return venda;
}

export async function listarVendas({ empresaId, busca, limite = 50 }) {
  return prisma.venda.findMany({
    where: {
      empresaId,
      ...(busca ? {
        OR: [
          { cliente: { nome: { contains: busca, mode: "insensitive" } } },
          { itens: { some: { descricao: { contains: busca, mode: "insensitive" } } } },
        ],
      } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Number(limite) || 50, 100),
    include: {
      cliente: { select: { id: true, nome: true } },
      pagamentos: true,
      _count: { select: { itens: true } },
    },
  });
}

export async function buscarVenda({ empresaId, id }) {
  const venda = await prisma.venda.findFirst({
    where: { id, empresaId },
    include: {
      empresa: true,
      cliente: true,
      usuario: { select: { id: true, nome: true } },
      itens: { include: { itemCatalogo: true, pet: { select: { id: true, nome: true } } } },
      pagamentos: true,
    },
  });
  if (!venda) throw new Error("VENDA_NAO_ENCONTRADA");
  return venda;
}

export async function cancelarVenda({ empresaId, usuarioId, id, motivo }) {
  return prisma.$transaction(async (tx) => {
    const venda = await tx.venda.findFirst({
      where: { id, empresaId },
      include: {
        itens: { include: { itemCatalogo: { include: { produto: { include: { estoque: true } } } } } },
        pagamentos: true,
        pacotesCliente: true,
        titulosFinanceiros: { include: { baixas: true } },
        documentosFiscais: true,
      },
    });
    if (!venda) throw new Error("VENDA_NAO_ENCONTRADA");
    // Uma Venda filha de comanda unificada não pode ser estornada isoladamente:
    // seria possível devolver estoque/caixa de um CNPJ e deixar o outro fechado.
    if (venda.comandaId) {
      const origem = await tx.comanda.findUnique({
        where: { id: venda.comandaId }, select: { rascunhoUnificado: true },
      });
      if (origem?.rascunhoUnificado) throw new Error("VENDA_UNIFICADA_EXIGE_ESTORNO_INTEGRAL");
    }
    if (venda.status !== "FINALIZADA") throw new Error("VENDA_NAO_CANCELAVEL");
    if (venda.documentosFiscais?.some((documento) => documento.status === "AUTORIZADO")) {
      throw new Error("VENDA_POSSUI_DOCUMENTO_FISCAL");
    }
    if (venda.titulosFinanceiros?.some((titulo) => Number(titulo.valorPago || 0) > 0 || titulo.baixas?.length)) {
      throw new Error("VENDA_POSSUI_RECEBIMENTO_FIADO");
    }

    // Rascunhos/erros fiscais ainda não autorizados acompanham o cancelamento da venda.
    // Um documento autorizado é bloqueado acima e precisa ser cancelado primeiro no Fiscal.
    await tx.documentoFiscal.updateMany({
      where: { vendaId: venda.id, status: { in: ["PENDENTE", "ERRO", "REJEITADO"] } },
      data: {
        status: "CANCELADO",
        canceladoEm: new Date(),
        motivoCancelamento: `Venda cancelada no PDV: ${motivo}`,
      },
    });

    await restaurarEstoque(tx, { venda, usuarioId });

    for (const pagamento of venda.pagamentos) {
      await tx.pagamento.update({
        where: { id: pagamento.id },
        data: { status: "ESTORNADO" },
      });
      if (pagamento.forma === "DINHEIRO" && pagamento.sessaoCaixaId) {
        const sessao = await tx.sessaoCaixa.findUnique({ where: { id: pagamento.sessaoCaixaId } });
        if (sessao?.status === "ABERTO") {
          await tx.movimentacaoCaixa.create({
            data: {
              sessaoCaixaId: pagamento.sessaoCaixaId,
              usuarioId,
              tipo: "ESTORNO",
              valor: pagamento.valor,
              descricao: `Estorno da venda #${venda.numero}: ${motivo}`,
              referenciaTipo: "VENDA",
              referenciaId: venda.id,
            },
          });
        }
      }
    }

    if (venda.titulosFinanceiros?.length) {
      await tx.tituloFinanceiro.updateMany({
        where: { vendaId: venda.id, status: { in: ["PENDENTE", "PARCIAL"] } },
        data: { status: "CANCELADO", canceladoEm: new Date() },
      });
    }

    if (venda.pacotesCliente?.length) {
      await tx.pacoteCliente.updateMany({
        where: { vendaId: venda.id },
        data: { vendaId: null },
      });
    }

    if (venda.comandaId) {
      const idsComanda = venda.itens.map((item) => item.comandaItemId).filter(Boolean);
      if (idsComanda.length) {
        await tx.comandaItem.updateMany({
          where: { id: { in: idsComanda }, comandaId: venda.comandaId },
          data: { status: "ATIVO" },
        });
      }

      const [ativos, faturados] = await Promise.all([
        tx.comandaItem.count({ where: { comandaId: venda.comandaId, status: "ATIVO" } }),
        tx.comandaItem.count({ where: { comandaId: venda.comandaId, status: "FATURADO" } }),
      ]);

      await tx.comanda.update({
        where: { id: venda.comandaId },
        data: {
          status: ativos > 0 && faturados > 0 ? "PARCIALMENTE_FECHADA" : "ABERTA",
          fechadaEm: null,
        },
      });
    }

    return tx.venda.update({
      where: { id: venda.id },
      data: {
        status: "CANCELADA",
        canceladaEm: new Date(),
        observacoes: [venda.observacoes, `CANCELAMENTO: ${motivo}`].filter(Boolean).join("\n"),
      },
    });
  });
}

/** Orçamentos da empresa selecionada, somente leitura; autorização financeiro.visualizar
 * aplicada na rota. Não converte, não reserva estoque e não emite documentos. */
export async function listarOrcamentosPdv({organizacaoId,empresaId}){
 const rows=await prisma.orcamentoCliente.findMany({
  where:{organizacaoId,empresaId},
  include:{cliente:{select:{id:true,nome:true,cpfCnpj:true}},itens:{select:{id:true,descricao:true,petId:true}}},
  orderBy:{createdAt:"desc"},take:100
 });
 return rows.map(row=>({
  id:row.id,numero:row.numero,status:row.status,createdAt:row.createdAt,
  updatedAt:row.updatedAt,cliente:row.cliente,
  empresaId:row.empresaId,total:Number(row.total),
  itens:row.itens
 }));
}

/** Tenant scope alone is insufficient: an operator must see only commands whose
 * originating company or authorized item/sale belongs to the selected CNPJ.
 * The multi-company engine has its own separately authorized endpoints. */
function escopoComandaEmpresa(empresaId) {
  if (!empresaId) throw new Error("EMPRESA_NAO_INFORMADA");
  return { OR: [
    { empresaOrigemId: empresaId },
    { itens: { some: { empresaId } } },
    { vendas: { some: { empresaId } } },
  ] };
}

export async function listarComandas({ organizacaoId, empresaId, busca, status }) {
  return prisma.comanda.findMany({
    where: {
      organizacaoId,
      rascunhoUnificado: false,
      AND: [
        escopoComandaEmpresa(empresaId),
        ...(busca ? [{ OR: [
          { cliente: { nome: { contains: busca, mode: "insensitive" } } },
          { itens: { some: { empresaId, descricao: { contains: busca, mode: "insensitive" } } } },
        ] }] : []),
      ],
      ...(status ? { status } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      cliente: { select: { id: true, nome: true, cpfCnpj: true, telefone: true, whatsapp: true } },
      itens: {
        where: { empresaId, status: { not: "CANCELADO" } },
        include: {
          empresa: { select: { id: true, nomeFantasia: true, tipo: true } },
          itemCatalogo: { select: { id: true, nome: true, tipo: true } },
          pet: { select: { id: true, nome: true } },
        },
      },
      vendas: { where: { empresaId }, select: { id: true, numero: true, empresaId: true, status: true, valorTotal: true } },
    },
  });
}

/** Central compartilhada de comandas: so revela CNPJs aos quais o usuario
 * tem vinculo ATIVO, cargo ativo e permissao pdv.acessar.
 * A separacao de caixa/estoque/vendas continua pelas rotas por CNPJ. */
async function empresasPermitidasNaCentral(organizacaoId, usuarioId, db=prisma) {
  if (!organizacaoId || !usuarioId) throw new Error("ACESSO_NEGADO");
  const vinculos = await db.usuarioEmpresa.findMany({
    where: {
      usuarioId, ativo: true,
      empresa: { organizacaoId, ativo: true },
      cargo: { ativo: true, permissoes: { some: { permissao: { codigo: "pdv.acessar" } } } },
    },
    select: { empresaId: true },
  });
  return vinculos.map(v => v.empresaId);
}
/** Reutiliza o catalogo unificado ja validado: filtra CNPJ e ACL na origem. */
export async function listarCatalogoCentral({organizacaoId,usuarioId,empresaId,busca=""}){
 return buscarCatalogoUnificado({organizacaoId,usuarioId,empresaId,busca});
}
function escopoCentralComandas(ids) {
  return { OR: [
    { empresaOrigemId: { in: ids } },
    { itens: { some: { empresaId: { in: ids } } } },
    { vendas: { some: { empresaId: { in: ids } } } },
    { atendimentosClinicos: { some: { empresaId: { in: ids } } } },
    { ordensBanhoTosa: { some: { empresaId: { in: ids } } } },
  ] };
}
export async function listarComandasCentral({ organizacaoId, usuarioId }) {
  const ids = await empresasPermitidasNaCentral(organizacaoId, usuarioId);
  if (!ids.length) return [];
  return prisma.comanda.findMany({
    where: { organizacaoId, rascunhoUnificado: false, AND: [escopoCentralComandas(ids)] },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      cliente: { select: { id: true, nome: true, cpfCnpj: true, telefone: true, whatsapp: true } },
      itens: {
        where: { empresaId: { in: ids }, status: { not: "CANCELADO" } },
        include: {
          empresa: { select: { id: true, nomeFantasia: true, tipo: true } },
          itemCatalogo: { select: { id: true, nome: true, tipo: true } },
          pet: { select: { id: true, nome: true } },
        },
      },
      vendas: { where: { empresaId: { in: ids } }, select: { id: true, numero: true, empresaId: true, status: true, valorTotal: true } },
    },
  });
}
export async function buscarComandaCentral({ organizacaoId, usuarioId, id }) {
  const ids = await empresasPermitidasNaCentral(organizacaoId, usuarioId);
  if (!ids.length) throw new Error("COMANDA_NAO_ENCONTRADA");
  const comanda = await prisma.comanda.findFirst({
    where: { id, organizacaoId, rascunhoUnificado: false, AND: [escopoCentralComandas(ids)] },
    include: {
      cliente: { include: { pets: { where: { ativo: true }, select: { id: true, nome: true } } } },
      itens: {
        where: { empresaId: { in: ids }, status: { not: "CANCELADO" } },
        include: {
          empresa: { select: { id: true, nomeFantasia: true, tipo: true } },
          itemCatalogo: { select: { id: true, nome: true, tipo: true, precoVenda: true } },
          pet: { select: { id: true, nome: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      vendas: {
        where: { empresaId: { in: ids } },
        include: { empresa: { select: { id: true, nomeFantasia: true } }, pagamentos: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!comanda) throw new Error("COMANDA_NAO_ENCONTRADA");
  return comanda;
}

/** Conversao explicita, sem duplicar comanda nem venda, para o motor atomico
 * de fechamento inteligente ja homologado. So para comanda aberta, nao faturada.
 * Nenhum pagamento e realizado aqui e a historia CANCELADA nao e apagada. */
export async function converterComandaParaUnificada({organizacao,organizacaoId,usuarioId,empresaId,id}){
 if(!checkoutManualHabilitado(organizacao,empresaId))
  throw Error("CHECKOUT_MANUAL_DESATIVADO");
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT "id" FROM "comandas" WHERE "id"=${id} FOR UPDATE`;
  const original=await tx.comanda.findFirst({
   where:{id,organizacaoId,rascunhoUnificado:false},
   include:{itens:{include:{itemCatalogo:{select:{id:true,ativo:true,precoVenda:true,empresaId:true}}}},
    vendas:{select:{id:true}}}
  });
  if(!original)throw Error("COMANDA_NAO_ENCONTRADA");
  if(original.status!=="ABERTA"||original.vendas.length)
   throw Error("COMANDA_COM_HISTORICO_FINANCEIRO");
  const ativos=original.itens.filter(item=>item.status==="ATIVO");
  if(!ativos.length||original.itens.some(item=>!["ATIVO","CANCELADO"].includes(item.status)))
   throw Error("COMANDA_CONVERSAO_INVALIDA");
  const autorizadas=await empresasPermitidasNaCentral(organizacaoId,usuarioId,tx);
  const participantes=[...new Set(ativos.map(item=>item.empresaId))];
  if(participantes.some(e=>!autorizadas.includes(e)||!empresaManualAutorizada(e)))
   throw Error("EMPRESA_SEM_ACESSO");
  // Pre-close do motor exige precos atuais e totais exatos. Sem alterar valores.
  for(const linha of ativos){
   const cat=linha.itemCatalogo;
   if(!cat?.ativo||cat.empresaId!==linha.empresaId||
      Math.round(Number(cat.precoVenda)*100)!==Math.round(Number(linha.valorUnitario)*100)||
      Math.abs(roundMoney(Number(linha.valorUnitario)*Number(linha.quantidade)-Number(linha.desconto))-Number(linha.valorTotal))>0.009)
    throw Error("COMANDA_REVISAR_VALORES");
  }
  const result=await tx.comanda.update({
   where:{id},data:{rascunhoUnificado:true},
   select:{id:true,numero:true,versaoRascunho:true}
  });
  return {id:result.id,numero:result.numero,versao:result.versaoRascunho,origem:"COMANDA_EXISTENTE"};
 },{isolationLevel:"Serializable",maxWait:8000,timeout:14000});
}

export async function criarComanda({ organizacaoId, empresaId, dados }) {
  return prisma.$transaction(async (tx) => {
    await validarCliente(tx, organizacaoId, dados.clienteId, false);
    return tx.comanda.create({
      data: { organizacaoId, clienteId: dados.clienteId || null, empresaOrigemId: empresaId, observacoes: dados.observacoes || null },
      include: { cliente: true },
    });
  });
}

export async function buscarComanda({ organizacaoId, empresaId, id }) {
  const comanda = await prisma.comanda.findFirst({
    where: { id, organizacaoId, rascunhoUnificado: false, AND: [escopoComandaEmpresa(empresaId)] },
    include: {
      cliente: { include: { pets: { where: { ativo: true }, select: { id: true, nome: true } } } },
      itens: {
        where: { empresaId, status: { not: "CANCELADO" } },
        include: {
          empresa: { select: { id: true, nomeFantasia: true, tipo: true } },
          itemCatalogo: { select: { id: true, nome: true, tipo: true, precoVenda: true } },
          pet: { select: { id: true, nome: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      vendas: {
        where: { empresaId },
        include: { empresa: { select: { id: true, nomeFantasia: true } }, pagamentos: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!comanda) throw new Error("COMANDA_NAO_ENCONTRADA");
  return comanda;
}

/** Comanda de produtos inicialmente anônima pode ganhar tutor uma única vez.
 * O vínculo não pode ser trocado depois: protege pets e histórico financeiro. */
export async function atribuirTutorComanda({organizacaoId,empresaId,id,clienteId}){
 return prisma.$transaction(async tx=>{
  await validarCliente(tx,organizacaoId,clienteId,true);
  const updated=await tx.comanda.updateMany({where:{id,organizacaoId,rascunhoUnificado:false,clienteId:null,status:{in:["ABERTA","PARCIALMENTE_FECHADA"]}},data:{clienteId}});
  if(updated.count!==1){
   const existing=await tx.comanda.findFirst({where:{id,organizacaoId,rascunhoUnificado:false},select:{id:true,clienteId:true,status:true}});
   if(!existing)throw new Error("COMANDA_NAO_ENCONTRADA");
   if(["FECHADA","CANCELADA"].includes(existing.status))throw new Error("COMANDA_FECHADA");
   throw new Error("COMANDA_TUTOR_IMUTAVEL");
  }
  return tx.comanda.findUnique({where:{id},include:{cliente:{include:{pets:{where:{ativo:true},select:{id:true,nome:true}}}}}});
 });
}

export async function adicionarItemComanda({ empresaId, organizacaoId, usuarioId, pdvUnificadoHabilitado=false, comandaId, dados }) {
  return prisma.$transaction(async (tx) => {
    const comanda = await tx.comanda.findFirst({
      where: { id: comandaId, organizacaoId, rascunhoUnificado: false },
    });
    if (!comanda) throw new Error("COMANDA_NAO_ENCONTRADA");
    if (comanda.rascunhoUnificado) throw new Error("COMANDA_RASCUNHO_UNIFICADO");
    if (["FECHADA", "CANCELADA"].includes(comanda.status)) throw new Error("COMANDA_FECHADA");

    // O CNPJ real vem do catalogo validado no banco, nunca do corpo HTTP.
    const produto=await tx.itemCatalogo.findFirst({
      where:{id:dados.itemCatalogoId,ativo:true,empresa:{organizacaoId,ativo:true}},
      select:{empresaId:true},
    });
    if(!produto)throw Error("ITEM_NAO_ENCONTRADO");
    const empresaAlvoId=produto.empresaId;
    if(empresaAlvoId!==empresaId){
      if(!pdvUnificadoHabilitado)throw Error("PDV_UNIFICADO_DESATIVADO");
      const autorizadas=await empresasPermitidasNaCentral(organizacaoId,usuarioId,tx);
      if(!autorizadas.includes(empresaAlvoId))throw Error("EMPRESA_SEM_ACESSO");
    }
    const [linha] = await prepararItens(tx, {
      empresaId:empresaAlvoId,
      organizacaoId,
      clienteId: comanda.clienteId,
      itens: [dados],
    });

    const item = await tx.comandaItem.create({
      data: {
        comandaId,
        empresaId:empresaAlvoId,
        itemCatalogoId: linha.item.id,
        petId: linha.pet?.id || null,
        descricao: linha.item.nome,
        quantidade: linha.quantidade,
        valorUnitario: linha.valorUnitario,
        desconto: linha.desconto,
        valorTotal: linha.valorTotal,
      },
    });
    await tx.comanda.update({ where: { id: comandaId }, data: { status: "ABERTA" } });
    return item;
  });
}

export async function cancelarItemComanda({ empresaId, organizacaoId, usuarioId, pdvUnificadoHabilitado=false, comandaId, itemId }) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.comandaItem.findFirst({
      where: {
        id: itemId,
        comandaId,
        status: "ATIVO",
        comanda: { organizacaoId },
      },
    });
    if (!item) throw new Error("ITEM_COMANDA_NAO_ENCONTRADO");
    if(item.empresaId!==empresaId){
      if(!pdvUnificadoHabilitado)throw Error("PDV_UNIFICADO_DESATIVADO");
      const autorizadas=await empresasPermitidasNaCentral(organizacaoId,usuarioId,tx);
      if(!autorizadas.includes(item.empresaId))throw Error("EMPRESA_SEM_ACESSO");
    }
    const origem = await tx.comanda.findUnique({where:{id:comandaId},select:{rascunhoUnificado:true}});
    if (origem?.rascunhoUnificado) throw new Error("COMANDA_RASCUNHO_UNIFICADO");
    return tx.comandaItem.update({ where: { id: item.id }, data: { status: "CANCELADO" } });
  });
}

export async function fecharComandaEmpresa({ empresaId, organizacaoId, usuarioId, comandaId, dados }) {
  const venda = await prisma.$transaction(async (tx) => {
    const comanda = await tx.comanda.findFirst({
      where: { id: comandaId, organizacaoId, AND: [escopoComandaEmpresa(empresaId)] },
      include: {
        itens: {
          where: { empresaId, status: "ATIVO" },
          include: {
            itemCatalogo: { include: { produto: { include: { estoque: true } }, servico: true } },
            pet: true,
          },
        },
      },
    });
    if (!comanda) throw new Error("COMANDA_NAO_ENCONTRADA");
    if (comanda.rascunhoUnificado) throw new Error("COMANDA_RASCUNHO_UNIFICADO");
    if (!comanda.itens.length) throw new Error("COMANDA_SEM_ITENS_EMPRESA");

    // Valide também linhas antigas antes da conversão transacional em venda.
    for (const line of comanda.itens) {
      const qtd=number(line.quantidade);
      if (line.itemCatalogo.tipo==="SERVICO") {
        if (!Number.isInteger(qtd) || qtd<1) throw new Error("QUANTIDADE_SERVICO_INTEIRA");
        if (!comanda.clienteId) throw new Error("CLIENTE_OBRIGATORIO_SERVICO");
        if (!line.pet?.id || line.pet.clienteId!==comanda.clienteId) throw new Error("PET_OBRIGATORIO_SERVICO");
      }
    }
    const preparados = comanda.itens.map((item) => ({
      item: item.itemCatalogo,
      pet: item.pet,
      quantidade: number(item.quantidade),
      desconto: number(item.desconto),
      valorUnitario: number(item.valorUnitario),
      valorTotal: number(item.valorTotal),
      comandaItemId: item.id,
    }));

    const venda = await criarVendaNoTx(tx, {
      empresaId,
      organizacaoId,
      usuarioId,
      clienteId: comanda.clienteId,
      comandaId: comanda.id,
      sessaoCaixaId: dados.sessaoCaixaId,
      itensEntrada: [],
      pagamentos: dados.pagamentos,
      desconto: dados.desconto,
      acrescimo: dados.acrescimo,
      observacoes: dados.observacoes,
      itensPreparados: preparados,
    });

    await tx.comandaItem.updateMany({
      where: { id: { in: comanda.itens.map((item) => item.id) } },
      data: { status: "FATURADO" },
    });

    const restantes = await tx.comandaItem.count({
      where: { comandaId: comanda.id, status: "ATIVO" },
    });

    await tx.comanda.update({
      where: { id: comanda.id },
      data: {
        status: restantes > 0 ? "PARCIALMENTE_FECHADA" : "FECHADA",
        fechadaEm: restantes > 0 ? null : new Date(),
      },
    });

    return tx.venda.findUnique({
      where: { id: venda.id },
      include: { pagamentos: true, itens: true },
    });
  });
  await criarDocumentoAutomaticoVenda({ empresaId, organizacaoId, usuarioId, vendaId: venda.id });
  return venda;
}


export async function listarPacotesPendentes({ empresaId, organizacaoId }) {
  return prisma.pacoteCliente.findMany({
    where: {
      empresaId,
      organizacaoId,
      vendaId: null,
      status: "ATIVO",
    },
    orderBy: { createdAt: "desc" },
    include: {
      cliente: { select: { id: true, nome: true } },
      pet: { select: { id: true, nome: true } },
      modelo: { select: { id: true, nome: true } },
    },
  });
}

export async function receberPacote({ empresaId, organizacaoId, usuarioId, pacoteId, dados }) {
  const venda = await prisma.$transaction(async (tx) => {
    await validarSessao(tx, empresaId, dados.sessaoCaixaId);

    const pacote = await tx.pacoteCliente.findFirst({
      where: {
        id: pacoteId,
        empresaId,
        organizacaoId,
        vendaId: null,
        status: "ATIVO",
      },
      include: {
        cliente: { select: { id: true, nome: true } },
        pet: { select: { id: true, nome: true } },
      },
    });
    if (!pacote) throw new Error("PACOTE_NAO_ENCONTRADO_PDV");

    const total = roundMoney(pacote.valorPacote);
    const totalPagamentos = roundMoney(
      dados.pagamentos.reduce((sum, pagamento) => sum + number(pagamento.valor), 0)
    );
    if (Math.abs(total - totalPagamentos) > 0.009) throw new Error("PAGAMENTO_DIVERGENTE");

    const venda = await tx.venda.create({
      data: {
        empresaId,
        clienteId: pacote.clienteId,
        usuarioId,
        status: "FINALIZADA",
        subtotal: total,
        desconto: 0,
        acrescimo: 0,
        valorTotal: total,
        observacoes: `Venda do pacote ${pacote.nome}`,
        finalizadaEm: new Date(),
      },
    });

    await tx.vendaItem.create({
      data: {
        vendaId: venda.id,
        itemCatalogoId: null,
        petId: pacote.petId || null,
        descricao: `Pacote: ${pacote.nome}`,
        quantidade: 1,
        valorUnitario: total,
        desconto: 0,
        valorTotal: total,
      },
    });

    for (const pagamento of dados.pagamentos) {
      const pagamentoCriado = await tx.pagamento.create({
        data: {
          vendaId: venda.id,
          sessaoCaixaId: dados.sessaoCaixaId,
          forma: pagamento.forma,
          status: pagamento.forma === "CREDITO_CLIENTE" ? "PENDENTE" : "APROVADO",
          valor: roundMoney(pagamento.valor),
          parcelas: pagamento.parcelas || 1,
          transacaoExternaId: pagamento.transacaoExternaId || null,
          codigoAutorizacao: pagamento.codigoAutorizacao || null,
          observacoes: pagamento.observacoes || null,
          pagoEm: pagamento.forma === "CREDITO_CLIENTE" ? null : new Date(),
        },
      });
      if (pagamento.forma === "CREDITO_CLIENTE") {
        await criarRecebivelFiadoNoTx(tx, {
          organizacaoId, empresaId, clienteId: pacote.clienteId, venda, pagamento: pagamentoCriado,
          vencimentoEm: pagamento.vencimentoEm,
          descricao: `Pacote ${pacote.nome} · Fiado`,
        });
      }
    }

    await tx.pacoteCliente.update({
      where: { id: pacote.id },
      data: { vendaId: venda.id },
    });

    return tx.venda.findUnique({
      where: { id: venda.id },
      include: { cliente: true, itens: true, pagamentos: true, pacotesCliente: true },
    });
  });
  await criarDocumentoAutomaticoVenda({ empresaId, organizacaoId, usuarioId, vendaId: venda.id });
  return venda;
}
