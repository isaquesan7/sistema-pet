import {
  funcaoSchema,
  funcaoAtualizarSchema,
  funcionarioSchema,
  funcionarioAtualizarSchema,
  jornadaSchema,
  baterPontoSchema,
  ajustePontoSchema,
} from "./funcionarios.schema.js";
import * as service from "./funcionarios.service.js";

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
  };
  const r = mapa[error.message];
  if (r) return res.status(r[0]).json({ success: false, message: r[1] });
  next(error);
}

export async function listarFuncoes(req, res, next) {
  try {
    return res.json({ success: true, dados: await service.listarFuncoes(req.organizacao.id) });
  } catch (error) { next(error); }
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
    return res.json({
      success: true,
      funcao: await service.atualizarFuncao(req.organizacao.id, req.params.id, dados),
    });
  } catch (error) { erro(error, res, next); }
}

export async function listar(req, res, next) {
  try {
    return res.json({ success: true, dados: await service.listarFuncionarios(req.organizacao.id, req.query.busca?.trim()) });
  } catch (error) { next(error); }
}

export async function criar(req, res, next) {
  try {
    const dados = parse(funcionarioSchema, req.body, res); if (!dados) return;
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
    return res.json({ success: true, dados: await service.salvarJornadas(req.organizacao.id, req.params.id, dados.jornadas) });
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
