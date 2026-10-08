import {
  pacoteModeloSchema,
  pacoteModeloAtualizarSchema,
  pacoteClienteSchema,
  consumoSchema,
} from "./pacotes.schema.js";
import * as service from "./pacotes.service.js";

function parse(schema, body, res) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Dados inválidos.",
      errors: parsed.error.flatten().fieldErrors,
    });
    return null;
  }
  return parsed.data;
}

function erro(error, res, next) {
  const mapa = {
    ITEM_PACOTE_INVALIDO: [400, "Um ou mais itens não pertencem à empresa selecionada."],
    CLIENTE_NAO_ENCONTRADO: [404, "Cliente não encontrado."],
    PET_NAO_ENCONTRADO: [404, "Pet não encontrado."],
    MODELO_NAO_ENCONTRADO: [404, "Modelo de pacote não encontrado."],
    MODELO_FORA_VIGENCIA: [409, "O modelo de pacote está fora do período de vigência."],
    PERIODO_INVALIDO: [400, "A data final não pode ser anterior à data inicial."],
    PACOTE_NAO_ENCONTRADO: [404, "Pacote do cliente não encontrado."],
    PACOTE_FORA_VIGENCIA: [409, "O pacote ainda não está vigente."],
    PACOTE_EXPIRADO: [409, "O pacote está expirado."],
    PACOTE_NAO_ATIVO: [409, "Somente pacotes ativos podem ser cancelados."],
    PACOTE_PERSONALIZADO_INCOMPLETO: [400, "Pacote personalizado exige nome, valor e itens."],
    ITEM_PACOTE_CLIENTE_NAO_ENCONTRADO: [404, "Crédito do pacote não encontrado ou pacote inativo."],
    SALDO_PACOTE_INSUFICIENTE: [409, "Saldo insuficiente neste item do pacote."],
  };
  const r = mapa[error.message];
  if (r) return res.status(r[0]).json({ success: false, message: r[1] });
  next(error);
}

export async function listarModelos(req, res, next) {
  try {
    return res.json({
      success: true,
      dados: await service.listarModelos(req.organizacao.id, req.empresa.id),
    });
  } catch (error) {
    next(error);
  }
}

export async function criarModelo(req, res, next) {
  try {
    const dados = parse(pacoteModeloSchema, req.body, res);
    if (!dados) return;
    return res.status(201).json({
      success: true,
      pacote: await service.criarModelo(req.organizacao.id, req.empresa.id, dados),
    });
  } catch (error) {
    erro(error, res, next);
  }
}

export async function atualizarModelo(req, res, next) {
  try {
    const dados = parse(pacoteModeloAtualizarSchema, req.body, res);
    if (!dados) return;
    return res.json({
      success: true,
      pacote: await service.atualizarModelo(
        req.organizacao.id,
        req.empresa.id,
        req.params.id,
        dados
      ),
    });
  } catch (error) {
    erro(error, res, next);
  }
}

export async function listarClientes(req, res, next) {
  try {
    const dados = await service.listarPacotesCliente({
      organizacaoId: req.organizacao.id,
      empresaId: req.empresa.id,
      clienteId: req.query.clienteId,
      status: req.query.status,
    });
    return res.json({ success: true, dados });
  } catch (error) {
    next(error);
  }
}

export async function buscarCliente(req, res, next) {
  try {
    return res.json({
      success: true,
      pacote: await service.buscarPacoteCliente({
        organizacaoId: req.organizacao.id,
        empresaId: req.empresa.id,
        id: req.params.id,
      }),
    });
  } catch (error) {
    erro(error, res, next);
  }
}

export async function criarCliente(req, res, next) {
  try {
    const dados = parse(pacoteClienteSchema, req.body, res);
    if (!dados) return;
    return res.status(201).json({
      success: true,
      pacote: await service.criarPacoteCliente(
        req.organizacao.id,
        req.empresa.id,
        dados
      ),
    });
  } catch (error) {
    erro(error, res, next);
  }
}

export async function consumir(req, res, next) {
  try {
    const dados = parse(consumoSchema, req.body, res);
    if (!dados) return;
    return res.status(201).json({
      success: true,
      consumo: await service.consumir({
        organizacaoId: req.organizacao.id,
        empresaId: req.empresa.id,
        usuarioId: req.usuario.id,
        pacoteItemId: req.params.itemId,
        dados,
      }),
    });
  } catch (error) {
    erro(error, res, next);
  }
}

export async function cancelarCliente(req, res, next) {
  try {
    return res.json({
      success: true,
      pacote: await service.cancelarPacoteCliente({
        organizacaoId: req.organizacao.id,
        empresaId: req.empresa.id,
        id: req.params.id,
      }),
    });
  } catch (error) {
    erro(error, res, next);
  }
}
