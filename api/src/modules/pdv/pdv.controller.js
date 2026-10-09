import {
  abrirCaixaSchema,
  caixaSchema,
  cancelarVendaSchema,
  comandaItemSchema,
  comandaSchema,
  fecharCaixaSchema,
  fecharComandaSchema,
  movimentacaoCaixaSchema,
  receberPacoteSchema,
  vendaSchema,
} from "./pdv.schema.js";
import * as service from "./pdv.service.js";

function parse(schema, body, res) {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Dados inválidos.",
      errors: result.error.flatten().fieldErrors,
    });
    return null;
  }
  return result.data;
}

function mapError(error, res, next) {
  const messages = {
    CLIENTE_OBRIGATORIO: [400, "Selecione um cliente."],
    CLIENTE_OBRIGATORIO_CREDITO: [400, "Para vender no fiado, selecione o cliente responsável pela conta."],
    CLIENTE_NAO_ENCONTRADO: [404, "Cliente não encontrado nesta organização."],
    PET_NAO_ENCONTRADO: [404, "Pet não encontrado ou não pertence ao cliente selecionado."],
    PET_OBRIGATORIO_SERVICO: [400, "Este serviço exige um pet vinculado."],
    ITEM_NAO_ENCONTRADO: [404, "Um dos produtos/serviços não foi encontrado nesta empresa."],
    VALORES_INVALIDOS: [400, "Quantidade ou valores inválidos."],
    DESCONTO_INVALIDO: [400, "O desconto informado é inválido."],
    PAGAMENTO_DIVERGENTE: [400, "A soma dos pagamentos deve ser igual ao total da venda."],
    CAIXA_NAO_ABERTO: [409, "Abra um caixa antes de finalizar a operação."],
    CAIXA_NAO_ENCONTRADO: [404, "Caixa não encontrado nesta empresa."],
    CAIXA_JA_ABERTO: [409, "Este caixa já possui uma sessão aberta."],
    CAIXA_JA_EXISTE: [409, "Já existe um caixa com este nome nesta empresa."],
    VENDA_NAO_ENCONTRADA: [404, "Venda não encontrada."],
    VENDA_NAO_CANCELAVEL: [409, "Esta venda não pode mais ser cancelada."],
    VENDA_POSSUI_RECEBIMENTO_FIADO: [409, "Esta venda possui recebimento de fiado já registrado. Regularize o recebimento no Financeiro antes de cancelar."],
    VENDA_POSSUI_DOCUMENTO_FISCAL: [409, "Esta venda possui documento fiscal autorizado. Cancele o documento no módulo Fiscal antes de cancelar a venda."],
    COMANDA_NAO_ENCONTRADA: [404, "Comanda não encontrada."],
    COMANDA_FECHADA: [409, "Esta comanda está fechada ou cancelada."],
    ITEM_COMANDA_NAO_ENCONTRADO: [404, "Item ativo da comanda não encontrado para esta empresa."],
    COMANDA_SEM_ITENS_EMPRESA: [409, "A comanda não possui itens pendentes do CNPJ selecionado."],
    PACOTE_NAO_ENCONTRADO_PDV: [404, "Pacote pendente de recebimento não encontrado neste CNPJ."],
  };

  if (error.message === "ESTOQUE_INSUFICIENTE") {
    return res.status(409).json({
      success: false,
      message: `Estoque insuficiente para ${error.itemNome || "um dos produtos"}.`,
    });
  }

  if (error.message === "ESTOQUE_LOTE_INSUFICIENTE") {
    return res.status(409).json({
      success: false,
      message: `Saldo por lote insuficiente para ${error.itemNome || "um dos produtos"}. Registre a entrada/lote no Estoque.`,
    });
  }

  const mapped = messages[error.message];
  if (mapped) return res.status(mapped[0]).json({ success: false, message: mapped[1] });
  next(error);
}

function podeAplicarDesconto(req, dados) {
  const descontoItens = (dados.itens || []).some((item) => Number(item.desconto || 0) > 0);
  const descontoVenda = Number(dados.desconto || 0) > 0;
  return !(descontoItens || descontoVenda) || req.permissoes?.includes("pdv.aplicar_desconto");
}

export async function resumo(req, res, next) {
  try {
    return res.json({ success: true, resumo: await service.resumo(req.empresa.id) });
  } catch (error) { next(error); }
}

export async function listarCaixas(req, res, next) {
  try {
    return res.json({ success: true, dados: await service.listarCaixas(req.empresa.id) });
  } catch (error) { next(error); }
}

export async function criarCaixa(req, res, next) {
  try {
    const dados = parse(caixaSchema, req.body, res); if (!dados) return;
    const caixa = await service.criarCaixa(req.empresa.id, dados);
    return res.status(201).json({ success: true, caixa });
  } catch (error) { mapError(error, res, next); }
}

export async function sessaoAberta(req, res, next) {
  try {
    return res.json({ success: true, sessao: await service.obterSessaoAberta(req.empresa.id) });
  } catch (error) { next(error); }
}

export async function abrirCaixa(req, res, next) {
  try {
    const dados = parse(abrirCaixaSchema, req.body, res); if (!dados) return;
    const sessao = await service.abrirCaixa({
      empresaId: req.empresa.id,
      usuarioId: req.usuario.id,
      caixaId: req.params.id,
      dados,
    });
    return res.status(201).json({ success: true, sessao });
  } catch (error) { mapError(error, res, next); }
}

export async function movimentarCaixa(req, res, next) {
  try {
    const dados = parse(movimentacaoCaixaSchema, req.body, res); if (!dados) return;
    const movimentacao = await service.movimentarCaixa({
      empresaId: req.empresa.id,
      usuarioId: req.usuario.id,
      sessaoId: req.params.id,
      dados,
    });
    return res.status(201).json({ success: true, movimentacao });
  } catch (error) { mapError(error, res, next); }
}

export async function fecharCaixa(req, res, next) {
  try {
    const dados = parse(fecharCaixaSchema, req.body, res); if (!dados) return;
    const sessao = await service.fecharCaixa({
      empresaId: req.empresa.id,
      usuarioId: req.usuario.id,
      sessaoId: req.params.id,
      dados,
    });
    return res.json({ success: true, sessao });
  } catch (error) { mapError(error, res, next); }
}

export async function listarItens(req, res, next) {
  try {
    const dados = await service.listarItensPdv({
      empresaId: req.empresa.id,
      organizacaoId: req.organizacao.id,
      busca: req.query.busca?.trim(),
    });
    return res.json({ success: true, dados });
  } catch (error) { next(error); }
}

export async function criarVenda(req, res, next) {
  try {
    const dados = parse(vendaSchema, req.body, res); if (!dados) return;
    if (!podeAplicarDesconto(req, dados)) {
      return res.status(403).json({ success: false, message: "Você não possui permissão para aplicar descontos." });
    }
    const venda = await service.criarVenda({
      empresaId: req.empresa.id,
      organizacaoId: req.organizacao.id,
      usuarioId: req.usuario.id,
      dados,
    });
    return res.status(201).json({ success: true, venda });
  } catch (error) { mapError(error, res, next); }
}

export async function listarVendas(req, res, next) {
  try {
    const dados = await service.listarVendas({
      empresaId: req.empresa.id,
      busca: req.query.busca?.trim(),
      limite: req.query.limite,
    });
    return res.json({ success: true, dados });
  } catch (error) { next(error); }
}

export async function buscarVenda(req, res, next) {
  try {
    return res.json({ success: true, venda: await service.buscarVenda({ empresaId: req.empresa.id, id: req.params.id }) });
  } catch (error) { mapError(error, res, next); }
}

export async function cancelarVenda(req, res, next) {
  try {
    const dados = parse(cancelarVendaSchema, req.body, res); if (!dados) return;
    const venda = await service.cancelarVenda({
      empresaId: req.empresa.id,
      usuarioId: req.usuario.id,
      id: req.params.id,
      motivo: dados.motivo,
    });
    return res.json({ success: true, venda });
  } catch (error) { mapError(error, res, next); }
}

export async function listarComandas(req, res, next) {
  try {
    const dados = await service.listarComandas({
      organizacaoId: req.organizacao.id,
      busca: req.query.busca?.trim(),
      status: req.query.status || undefined,
    });
    return res.json({ success: true, dados });
  } catch (error) { next(error); }
}

export async function criarComanda(req, res, next) {
  try {
    const dados = parse(comandaSchema, req.body, res); if (!dados) return;
    const comanda = await service.criarComanda({ organizacaoId: req.organizacao.id, dados });
    return res.status(201).json({ success: true, comanda });
  } catch (error) { mapError(error, res, next); }
}

export async function buscarComanda(req, res, next) {
  try {
    return res.json({ success: true, comanda: await service.buscarComanda({ organizacaoId: req.organizacao.id, id: req.params.id }) });
  } catch (error) { mapError(error, res, next); }
}

export async function adicionarItemComanda(req, res, next) {
  try {
    const dados = parse(comandaItemSchema, req.body, res); if (!dados) return;
    if (!podeAplicarDesconto(req, { itens: [dados] })) {
      return res.status(403).json({ success: false, message: "Você não possui permissão para aplicar descontos." });
    }
    const item = await service.adicionarItemComanda({
      empresaId: req.empresa.id,
      organizacaoId: req.organizacao.id,
      comandaId: req.params.id,
      dados,
    });
    return res.status(201).json({ success: true, item });
  } catch (error) { mapError(error, res, next); }
}

export async function cancelarItemComanda(req, res, next) {
  try {
    const item = await service.cancelarItemComanda({
      empresaId: req.empresa.id,
      organizacaoId: req.organizacao.id,
      comandaId: req.params.id,
      itemId: req.params.itemId,
    });
    return res.json({ success: true, item });
  } catch (error) { mapError(error, res, next); }
}

export async function fecharComanda(req, res, next) {
  try {
    const dados = parse(fecharComandaSchema, req.body, res); if (!dados) return;
    if (!podeAplicarDesconto(req, dados)) {
      return res.status(403).json({ success: false, message: "Você não possui permissão para aplicar descontos." });
    }
    const venda = await service.fecharComandaEmpresa({
      empresaId: req.empresa.id,
      organizacaoId: req.organizacao.id,
      usuarioId: req.usuario.id,
      comandaId: req.params.id,
      dados,
    });
    return res.status(201).json({ success: true, venda });
  } catch (error) { mapError(error, res, next); }
}


export async function listarPacotesPendentes(req, res, next) {
  try {
    const dados = await service.listarPacotesPendentes({
      empresaId: req.empresa.id,
      organizacaoId: req.organizacao.id,
    });
    return res.json({ success: true, dados });
  } catch (error) { next(error); }
}

export async function receberPacote(req, res, next) {
  try {
    const dados = parse(receberPacoteSchema, req.body, res); if (!dados) return;
    const venda = await service.receberPacote({
      empresaId: req.empresa.id,
      organizacaoId: req.organizacao.id,
      usuarioId: req.usuario.id,
      pacoteId: req.params.id,
      dados,
    });
    return res.status(201).json({ success: true, venda });
  } catch (error) { mapError(error, res, next); }
}
