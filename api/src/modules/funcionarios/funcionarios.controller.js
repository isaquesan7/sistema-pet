import {
  funcaoSchema,
  funcaoAtualizarSchema,
  funcionarioSchema,
  funcionarioAtualizarSchema,
  jornadaSchema,
  baterPontoSchema,
  ajustePontoSchema,
  analisarAjustePontoSchema,
  fecharPontoSchema,
  reabrirPontoSchema,
} from "./funcionarios.schema.js";
import * as service from "./funcionarios.service.js";
import { verificarLimiteRecurso } from "../saas/saas.service.js";

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
    FUNCAO_JA_EXISTE: [409, "Já existe uma função com este nome."],
    FUNCAO_INVALIDA: [400, "Função inválida."],
    USUARIO_INVALIDO: [400, "Usuário não pertence à organização."],
    EMPRESA_INVALIDA: [400, "Empresa inválida para esta organização."],
    FUNCIONARIO_NAO_ENCONTRADO: [404, "Funcionário não encontrado."],
    CPF_JA_CADASTRADO: [409, "CPF já cadastrado para outro funcionário."],
    REGISTRO_NAO_ENCONTRADO: [404, "Registro de ponto não encontrado."],
    TIPO_PONTO_INVALIDO: [409, "Esta batida não é válida para o estado atual do ponto."],
    AJUSTE_PENDENTE_EXISTENTE: [409, "Já existe uma solicitação de ajuste pendente para esta batida."],
    AJUSTE_NAO_ENCONTRADO: [404, "Solicitação de ajuste não encontrada."],
    AJUSTE_JA_ANALISADO: [409, "Esta solicitação de ajuste já foi analisada."],
    STATUS_AJUSTE_INVALIDO: [400, "Status de ajuste inválido."],
    COMPETENCIA_INVALIDA: [400, "Competência inválida. Use o formato AAAA-MM."],
    COMPETENCIA_FECHADA: [409, "Esta competência já foi fechada. Reabra o fechamento antes de alterar o ponto."],
    COMPETENCIA_EM_ANDAMENTO: [409, "A competência ainda está em andamento e não pode ser fechada."],
    FECHAMENTO_BLOQUEADO: [409, "O fechamento possui pendências que precisam ser resolvidas."],
    FECHAMENTO_JA_REALIZADO: [409, "O ponto deste funcionário já está fechado nesta competência."],
    FECHAMENTO_FORA_ORDEM: [409, "Existe uma competência posterior já fechada. Regularize os fechamentos em ordem cronológica."],
    FECHAMENTO_NAO_ENCONTRADO: [404, "Fechamento de ponto não encontrado."],
    FECHAMENTO_NAO_FECHADO: [409, "Este fechamento já está aberto."],
    REABERTURA_FORA_ORDEM: [409, "Existe uma competência posterior fechada. Reabra primeiro a competência mais recente."],
  };
  if (error.message === "LIMITE_PLANO_ATINGIDO") {
    return res.status(403).json({ success: false, message: `Seu plano atingiu o limite de ${error.limite} funcionários.`, code: error.message });
  }
  const r = mapa[error.message];
  if (r) return res.status(r[0]).json({ success: false, message: r[1], ...(error.detalhes ? { detalhes: error.detalhes } : {}) });
  next(error);
}

export async function listarFuncoes(req, res, next) {
  try { return res.json({ success: true, dados: await service.listarFuncoes(req.organizacao.id) }); }
  catch (error) { next(error); }
}

export async function criarFuncao(req, res, next) {
  try {
    const dados = parse(funcaoSchema, req.body, res); if (!dados) return;
    return res.status(201).json({ success: true, funcao: await service.criarFuncao(req.organizacao.id, dados) });
  } catch (error) { erro(error, res, next); }
}

export async function atualizarFuncao(req, res, next) {
  try {
    const dados = parse(funcaoAtualizarSchema, req.body, res); if (!dados) return;
    return res.json({ success: true, funcao: await service.atualizarFuncao(req.organizacao.id, req.params.id, dados) });
  } catch (error) { erro(error, res, next); }
}

export async function listar(req, res, next) {
  try { return res.json({ success: true, dados: await service.listarFuncionarios(req.organizacao.id, req.query.busca) }); }
  catch (error) { next(error); }
}

export async function criar(req, res, next) {
  try {
    const dados = parse(funcionarioSchema, req.body, res); if (!dados) return;
    await verificarLimiteRecurso(req.organizacao.id, "funcionarios");
    return res.status(201).json({ success: true, funcionario: await service.criarFuncionario(req.organizacao.id, dados) });
  } catch (error) { erro(error, res, next); }
}

export async function atualizar(req, res, next) {
  try {
    const dados = parse(funcionarioAtualizarSchema, req.body, res); if (!dados) return;
    return res.json({ success: true, funcionario: await service.atualizarFuncionario(req.organizacao.id, req.params.id, dados) });
  } catch (error) { erro(error, res, next); }
}

export async function salvarJornadas(req, res, next) {
  try {
    const dados = parse(jornadaSchema, req.body, res); if (!dados) return;
    return res.json({ success: true, jornadas: await service.salvarJornadas(req.organizacao.id, req.params.id, dados.jornadas) });
  } catch (error) { erro(error, res, next); }
}

export async function statusPonto(req, res, next) {
  try {
    const status = await service.statusPonto(req.organizacao.id, req.params.id, req.empresa.id);
    return res.json({ success: true, ...status });
  } catch (error) { erro(error, res, next); }
}

export async function baterPonto(req, res, next) {
  try {
    const dados = parse(baterPontoSchema, req.body || {}, res); if (!dados) return;
    const registro = await service.baterPonto({
      organizacaoId: req.organizacao.id,
      empresaId: req.empresa.id,
      funcionarioId: req.params.id,
      usuarioId: req.usuario.id,
      tipo: dados.tipo,
      origem: "WEB",
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
    return res.status(201).json({ success: true, registro });
  } catch (error) { erro(error, res, next); }
}

export async function registros(req, res, next) {
  try {
    const dados = await service.listarRegistros({
      organizacaoId: req.organizacao.id,
      funcionarioId: req.params.id,
      empresaId: req.query.empresaId,
      inicio: req.query.inicio,
      fim: req.query.fim,
    });
    return res.json({ success: true, dados });
  } catch (error) { erro(error, res, next); }
}

export async function ajustarPonto(req, res, next) {
  try {
    const dados = parse(ajustePontoSchema, req.body, res); if (!dados) return;
    const ajuste = await service.ajustarPonto({
      organizacaoId: req.organizacao.id,
      registroId: req.params.registroId,
      usuarioId: req.usuario.id,
      horarioNovo: dados.horarioNovo,
      motivo: dados.motivo,
    });
    return res.status(201).json({ success: true, ajuste });
  } catch (error) { erro(error, res, next); }
}

export async function listarAjustesPonto(req, res, next) {
  try {
    const dados = await service.listarAjustesPonto({
      organizacaoId: req.organizacao.id,
      empresaId: req.empresa.id,
      status: req.query.status,
      competencia: req.query.competencia,
    });
    return res.json({ success: true, dados });
  } catch (error) { erro(error, res, next); }
}

export async function analisarAjustePonto(req, res, next) {
  try {
    const dados = parse(analisarAjustePontoSchema, req.body, res); if (!dados) return;
    const ajuste = await service.analisarAjustePonto({
      organizacaoId: req.organizacao.id,
      empresaId: req.empresa.id,
      ajusteId: req.params.ajusteId,
      usuarioId: req.usuario.id,
      decisao: dados.decisao,
      observacao: dados.observacao,
    });
    return res.json({ success: true, ajuste });
  } catch (error) { erro(error, res, next); }
}

export async function fechamentoMensal(req, res, next) {
  try {
    const dados = await service.fechamentoMensal({
      organizacaoId: req.organizacao.id,
      empresaId: req.empresa.id,
      competencia: req.query.competencia,
    });
    return res.json({ success: true, ...dados });
  } catch (error) { erro(error, res, next); }
}

export async function fecharPontoFuncionario(req, res, next) {
  try {
    const dados = parse(fecharPontoSchema, req.body, res); if (!dados) return;
    const fechamento = await service.fecharPontoFuncionario({
      organizacaoId: req.organizacao.id,
      empresaId: req.empresa.id,
      funcionarioId: req.params.id,
      usuarioId: req.usuario.id,
      competencia: dados.competencia,
      observacoes: dados.observacoes,
    });
    return res.json({ success: true, fechamento });
  } catch (error) { erro(error, res, next); }
}

export async function fecharCompetencia(req, res, next) {
  try {
    const dados = parse(fecharPontoSchema, req.body, res); if (!dados) return;
    const resultado = await service.fecharCompetencia({
      organizacaoId: req.organizacao.id,
      empresaId: req.empresa.id,
      usuarioId: req.usuario.id,
      competencia: dados.competencia,
      observacoes: dados.observacoes,
    });
    return res.json({ success: true, ...resultado });
  } catch (error) { erro(error, res, next); }
}

export async function reabrirFechamento(req, res, next) {
  try {
    const dados = parse(reabrirPontoSchema, req.body, res); if (!dados) return;
    const fechamento = await service.reabrirFechamento({
      organizacaoId: req.organizacao.id,
      empresaId: req.empresa.id,
      fechamentoId: req.params.fechamentoId,
      usuarioId: req.usuario.id,
      motivo: dados.motivo,
    });
    return res.json({ success: true, fechamento });
  } catch (error) { erro(error, res, next); }
}

export async function exportarFechamento(req, res, next) {
  try {
    const competencia = req.query.competencia;
    const csv = await service.exportarFechamentoCsv({
      organizacaoId: req.organizacao.id,
      empresaId: req.empresa.id,
      competencia,
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="ponto-${competencia}.csv"`);
    return res.send(csv);
  } catch (error) { erro(error, res, next); }
}
