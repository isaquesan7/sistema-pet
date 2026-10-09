import {
  agendamentoSchema,
  agendamentoAtualizarSchema,
  ordemDiretaSchema,
  checkinSchema,
  statusOrdemSchema,
  fichaSchema,
  anexoSchema,
} from "./banho-tosa.schema.js";
import * as service from "./banho-tosa.service.js";
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
  if (error?.code === "P2028") return res.status(503).json({ success: false, message: "A operação demorou mais que o esperado. Tente novamente." });
  const mapa = {
    CLIENTE_NAO_ENCONTRADO: [404, "Cliente não encontrado."],
    PET_NAO_ENCONTRADO: [404, "Pet não encontrado ou não pertence ao tutor selecionado."],
    PROFISSIONAL_NAO_ENCONTRADO: [404, "Profissional não encontrado nesta empresa."],
    SERVICO_NAO_ENCONTRADO: [404, "Um ou mais serviços não pertencem ao CNPJ selecionado."],
    HORARIO_INDISPONIVEL: [409, "O profissional já possui outro agendamento neste horário."],
    PERIODO_INVALIDO: [400, "Horário inicial/final inválido."],
    AGENDAMENTO_NAO_ENCONTRADO: [404, "Agendamento não encontrado."],
    AGENDAMENTO_JA_CHECKIN: [409, "Este agendamento já possui check-in."],
    AGENDAMENTO_ENCERRADO: [409, "Este agendamento já está encerrado."],
    ORDEM_NAO_ENCONTRADA: [404, "Ordem de serviço não encontrada."],
    TRANSICAO_STATUS_INVALIDA: [409, "Esta mudança de etapa não é permitida."],
    ORDEM_JA_FATURADA: [409, "A ordem possui item já faturado. Cancele/estorne a venda antes de cancelar a OS."],
    CREDITO_PACOTE_INVALIDO: [409, "O crédito selecionado não pode ser usado neste serviço."],
    PACOTE_FORA_VIGENCIA: [409, "O pacote selecionado está fora da vigência."],
    SALDO_PACOTE_INSUFICIENTE: [409, "O pacote não possui saldo suficiente."],
    ANEXO_NAO_ENCONTRADO: [404, "Anexo não encontrado."],
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
  try { res.json({ success: true, dados: await service.resumo({ empresaId: req.empresa.id, data: req.query.data, inicio: req.query.inicio, fim: req.query.fim }) }); }
  catch (error) { next(error); }
}

export async function profissionais(req, res, next) {
  try { res.json({ success: true, dados: await service.listarProfissionais({ organizacaoId: req.organizacao.id, empresaId: req.empresa.id }) }); }
  catch (error) { next(error); }
}

export async function agenda(req, res, next) {
  try {
    const dados = await service.listarAgendamentos({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, data: req.query.data, inicio: req.query.inicio, fim: req.query.fim, status: req.query.status, profissionalId: req.query.profissionalId });
    res.json({ success: true, dados });
  } catch (error) { next(error); }
}

export async function criarAgendamento(req, res, next) {
  try {
    const dados = parse(agendamentoSchema, req.body, res); if (!dados) return;
    const agendamento = await service.criarAgendamento({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, dados });
    await auditar(req, "CRIAR_AGENDAMENTO_BANHO_TOSA", "AgendamentoBanhoTosa", agendamento.id, dados);
    res.status(201).json({ success: true, agendamento });
  } catch (error) { mapError(error, res, next); }
}

export async function atualizarAgendamento(req, res, next) {
  try {
    const dados = parse(agendamentoAtualizarSchema, req.body, res); if (!dados) return;
    const agendamento = await service.atualizarAgendamento({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, id: req.params.id, dados });
    await auditar(req, "ATUALIZAR_AGENDAMENTO_BANHO_TOSA", "AgendamentoBanhoTosa", agendamento.id, dados);
    res.json({ success: true, agendamento });
  } catch (error) { mapError(error, res, next); }
}

export async function checkin(req, res, next) {
  try {
    const dados = parse(checkinSchema, req.body, res); if (!dados) return;
    const ordem = await service.checkinAgendamento({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, usuarioId: req.usuario.id, id: req.params.id, dados });
    await auditar(req, "CHECKIN_BANHO_TOSA", "OrdemServicoBanhoTosa", ordem.id, { agendamentoId: req.params.id });
    res.status(201).json({ success: true, ordem });
  } catch (error) { mapError(error, res, next); }
}

export async function criarOrdem(req, res, next) {
  try {
    const dados = parse(ordemDiretaSchema, req.body, res); if (!dados) return;
    const ordem = await service.criarOrdemDireta({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, usuarioId: req.usuario.id, dados });
    await auditar(req, "CRIAR_OS_BANHO_TOSA", "OrdemServicoBanhoTosa", ordem.id, dados);
    res.status(201).json({ success: true, ordem });
  } catch (error) { mapError(error, res, next); }
}

export async function ordens(req, res, next) {
  try { res.json({ success: true, dados: await service.listarOrdens({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, data: req.query.data, inicio: req.query.inicio, fim: req.query.fim, status: req.query.status }) }); }
  catch (error) { next(error); }
}

export async function buscarOrdem(req, res, next) {
  try { res.json({ success: true, ordem: await service.buscarOrdem({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, id: req.params.id }) }); }
  catch (error) { mapError(error, res, next); }
}

export async function statusOrdem(req, res, next) {
  try {
    const dados = parse(statusOrdemSchema, req.body, res); if (!dados) return;
    const ordem = await service.atualizarStatusOrdem({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, id: req.params.id, dados });
    await auditar(req, "ALTERAR_STATUS_OS_BANHO_TOSA", "OrdemServicoBanhoTosa", ordem.id, dados);
    res.json({ success: true, ordem });
  } catch (error) { mapError(error, res, next); }
}

export async function creditos(req, res, next) {
  try {
    res.json({ success: true, dados: await service.listarCreditos({ organizacaoId: req.organizacao.id, empresaId: req.empresa.id, clienteId: req.query.clienteId, petId: req.query.petId }) });
  } catch (error) { next(error); }
}

export async function buscarFicha(req, res, next) {
  try { res.json({ success: true, ficha: await service.buscarFicha({ organizacaoId: req.organizacao.id, petId: req.params.petId }) }); }
  catch (error) { mapError(error, res, next); }
}

export async function salvarFicha(req, res, next) {
  try {
    const dados = parse(fichaSchema, req.body, res); if (!dados) return;
    const ficha = await service.salvarFicha({ organizacaoId: req.organizacao.id, petId: req.params.petId, dados });
    await auditar(req, "ATUALIZAR_FICHA_BANHO_TOSA", "FichaBanhoTosaPet", ficha.id, dados);
    res.json({ success: true, ficha });
  } catch (error) { mapError(error, res, next); }
}

export async function adicionarAnexo(req, res, next) {
  try {
    const dados = parse(anexoSchema, req.body, res); if (!dados) return;
    const anexo = await service.adicionarAnexo({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, ordemId: req.params.id, dados });
    res.status(201).json({ success: true, anexo });
  } catch (error) { mapError(error, res, next); }
}

export async function removerAnexo(req, res, next) {
  try {
    await service.removerAnexo({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, ordemId: req.params.id, anexoId: req.params.anexoId });
    res.json({ success: true });
  } catch (error) { mapError(error, res, next); }
}
