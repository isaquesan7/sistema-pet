import {
  atendimentoSchema,
  atendimentoAtualizarSchema,
  prescricaoSchema,
  vacinaSchema,
  vermifugacaoSchema,
  exameSchema,
  exameAtualizarSchema,
  procedimentoSchema,
  documentoSchema,
} from "./consultorio.schema.js";
import * as service from "./consultorio.service.js";
import { registrarAuditoria } from "../../utils/auditoria.js";

function parse(schema, body, res) {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(400).json({ success: false, message: "Dados inválidos.", errors: result.error.flatten().fieldErrors });
    return null;
  }
  return result.data;
}

function mapError(error, res, next) {
  // P2028 = transação interativa expirada/encerrada. Em desenvolvimento remoto
  // isso pode acontecer quando a latência com o Railway é alta.
  if (error?.code === "P2028") {
    return res.status(503).json({
      success: false,
      message: "A operação demorou mais que o esperado. Tente novamente.",
    });
  }

  const mapa = {
    ATENDIMENTO_NAO_ENCONTRADO: [404, "Atendimento clínico não encontrado."],
    CLIENTE_NAO_ENCONTRADO: [404, "Cliente não encontrado nesta organização."],
    PET_NAO_ENCONTRADO: [404, "Pet não encontrado ou não pertence ao tutor selecionado."],
    ITEM_NAO_ENCONTRADO: [404, "Produto/serviço não encontrado nesta empresa."],
    ITEM_DEVE_SER_PRODUTO: [400, "Selecione um produto do catálogo para esta operação."],
    ITEM_DEVE_SER_SERVICO: [400, "Selecione um serviço do catálogo para esta operação."],
    ITEM_ESTOQUE_OBRIGATORIO: [400, "Selecione um produto do catálogo para consumir estoque."],
    ITEM_NAO_CONTROLA_ESTOQUE: [409, "O item selecionado não possui controle de estoque."],
    ESTOQUE_INSUFICIENTE: [409, "Estoque insuficiente para registrar este consumo."],
    QUANTIDADE_INVALIDA: [400, "Quantidade inválida."],
    ATENDIMENTO_ENCERRADO: [409, "Este atendimento já está encerrado e não pode receber esta alteração."],
    EXAME_NAO_ENCONTRADO: [404, "Exame não encontrado neste atendimento."],
  };
  const item = mapa[error.message];
  if (item) return res.status(item[0]).json({ success: false, message: item[1] });
  next(error);
}

async function auditar(req, acao, entidade, entidadeId, dadosNovos = null) {
  await registrarAuditoria({
    organizacaoId: req.organizacao.id,
    empresaId: req.empresa.id,
    usuarioId: req.usuario.id,
    acao,
    entidade,
    entidadeId,
    dadosNovos,
    ip: req.ip,
  });
}

export async function resumo(req, res, next) {
  try {
    const dados = await service.resumo({ empresaId: req.empresa.id, inicio: req.query.inicio, fim: req.query.fim });
    res.json({ success: true, dados });
  } catch (error) { next(error); }
}

export async function listar(req, res, next) {
  try {
    const dados = await service.listarAtendimentos({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, busca: req.query.busca?.trim(), status: req.query.status, inicio: req.query.inicio, fim: req.query.fim });
    res.json({ success: true, dados });
  } catch (error) { next(error); }
}

export async function criar(req, res, next) {
  try {
    const dados = parse(atendimentoSchema, req.body, res); if (!dados) return;
    const atendimento = await service.criarAtendimento({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, usuarioId: req.usuario.id, dados });
    await auditar(req, "CRIAR_ATENDIMENTO", "AtendimentoClinico", atendimento.id, { clienteId: dados.clienteId, petId: dados.petId });
    res.status(201).json({ success: true, atendimento });
  } catch (error) { mapError(error, res, next); }
}

export async function buscar(req, res, next) {
  try {
    const atendimento = await service.buscarAtendimento({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, id: req.params.id });
    res.json({ success: true, atendimento });
  } catch (error) { mapError(error, res, next); }
}

export async function atualizar(req, res, next) {
  try {
    const dados = parse(atendimentoAtualizarSchema, req.body, res); if (!dados) return;
    const atendimento = await service.atualizarAtendimento({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, id: req.params.id, dados });
    await auditar(req, "ATUALIZAR_PRONTUARIO", "AtendimentoClinico", atendimento.id, dados);
    res.json({ success: true, atendimento });
  } catch (error) { mapError(error, res, next); }
}

export async function iniciar(req, res, next) {
  try {
    const atendimento = await service.iniciarAtendimento({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, usuarioId: req.usuario.id, id: req.params.id });
    await auditar(req, "INICIAR_ATENDIMENTO", "AtendimentoClinico", atendimento.id);
    res.json({ success: true, atendimento });
  } catch (error) { mapError(error, res, next); }
}

export async function finalizar(req, res, next) {
  try {
    const atendimento = await service.finalizarAtendimento({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, usuarioId: req.usuario.id, id: req.params.id });
    await auditar(req, "FINALIZAR_ATENDIMENTO", "AtendimentoClinico", atendimento.id);
    res.json({ success: true, atendimento });
  } catch (error) { mapError(error, res, next); }
}

export async function cancelar(req, res, next) {
  try {
    const atendimento = await service.cancelarAtendimento({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, id: req.params.id });
    await auditar(req, "CANCELAR_ATENDIMENTO", "AtendimentoClinico", atendimento.id);
    res.json({ success: true, atendimento });
  } catch (error) { mapError(error, res, next); }
}

export async function prescrever(req, res, next) {
  try {
    const dados = parse(prescricaoSchema, req.body, res); if (!dados) return;
    const prescricao = await service.criarPrescricao({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, usuarioId: req.usuario.id, atendimentoId: req.params.id, dados });
    await auditar(req, "CRIAR_PRESCRICAO", "PrescricaoClinica", prescricao.id);
    res.status(201).json({ success: true, prescricao });
  } catch (error) { mapError(error, res, next); }
}

export async function vacinar(req, res, next) {
  try {
    const dados = parse(vacinaSchema, req.body, res); if (!dados) return;
    const vacina = await service.aplicarVacina({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, usuarioId: req.usuario.id, atendimentoId: req.params.id, dados });
    await auditar(req, "APLICAR_VACINA", "VacinaAplicacao", vacina.id);
    res.status(201).json({ success: true, vacina });
  } catch (error) { mapError(error, res, next); }
}

export async function vermifugar(req, res, next) {
  try {
    const dados = parse(vermifugacaoSchema, req.body, res); if (!dados) return;
    const vermifugacao = await service.aplicarVermifugo({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, usuarioId: req.usuario.id, atendimentoId: req.params.id, dados });
    await auditar(req, "APLICAR_VERMIFUGO", "VermifugacaoAplicacao", vermifugacao.id);
    res.status(201).json({ success: true, vermifugacao });
  } catch (error) { mapError(error, res, next); }
}

export async function solicitarExame(req, res, next) {
  try {
    const dados = parse(exameSchema, req.body, res); if (!dados) return;
    const exame = await service.solicitarExame({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, atendimentoId: req.params.id, dados });
    await auditar(req, "SOLICITAR_EXAME", "ExameClinico", exame.id);
    res.status(201).json({ success: true, exame });
  } catch (error) { mapError(error, res, next); }
}

export async function atualizarExame(req, res, next) {
  try {
    const dados = parse(exameAtualizarSchema, req.body, res); if (!dados) return;
    const exame = await service.atualizarExame({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, atendimentoId: req.params.id, exameId: req.params.exameId, dados });
    await auditar(req, "ATUALIZAR_EXAME", "ExameClinico", exame.id, dados);
    res.json({ success: true, exame });
  } catch (error) { mapError(error, res, next); }
}

export async function procedimento(req, res, next) {
  try {
    const dados = parse(procedimentoSchema, req.body, res); if (!dados) return;
    const procedimento = await service.adicionarProcedimento({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, atendimentoId: req.params.id, dados });
    await auditar(req, "ADICIONAR_PROCEDIMENTO", "ProcedimentoClinico", procedimento.id);
    res.status(201).json({ success: true, procedimento });
  } catch (error) { mapError(error, res, next); }
}

export async function documento(req, res, next) {
  try {
    const dados = parse(documentoSchema, req.body, res); if (!dados) return;
    const documento = await service.criarDocumento({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, atendimentoId: req.params.id, dados });
    await auditar(req, "CRIAR_DOCUMENTO_CLINICO", "DocumentoClinico", documento.id);
    res.status(201).json({ success: true, documento });
  } catch (error) { mapError(error, res, next); }
}

export async function historicoPet(req, res, next) {
  try {
    const dados = await service.historicoPet({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, petId: req.params.petId });
    res.json({ success: true, dados });
  } catch (error) { mapError(error, res, next); }
}
