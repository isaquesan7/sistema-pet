import { atualizarConfiguracaoSchema, atualizarModuloSchema } from "./organizacoes.schema.js";
import * as service from "./organizacoes.service.js";
import { registrarAuditoria } from "../../utils/auditoria.js";

const MODULOS = new Set([
  "PDV",
  "ESTOQUE",
  "CONSULTORIO",
  "BANHO_TOSA",
  "FINANCEIRO",
  "PORTAL_CLIENTE",
  "PONTO",
  "FISCAL",
  "RELATORIOS",
]);

export async function atual(req, res, next) {
  try {
    const organizacao = await service.obterOrganizacao(req.organizacao.id);
    return res.json({ success: true, organizacao });
  } catch (error) {
    next(error);
  }
}

export async function atualizarConfiguracao(req, res, next) {
  try {
    const parsed = atualizarConfiguracaoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Dados inválidos.",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const anterior = req.organizacao.configuracao;
    const configuracao = await service.atualizarConfiguracao(req.organizacao.id, parsed.data);

    await registrarAuditoria({
      organizacaoId: req.organizacao.id,
      empresaId: req.empresa.id,
      usuarioId: req.usuario.id,
      acao: "ATUALIZAR_CONFIGURACAO",
      entidade: "ConfiguracaoOrganizacao",
      entidadeId: configuracao.id,
      dadosAnteriores: anterior,
      dadosNovos: configuracao,
      ip: req.ip,
    });

    return res.json({ success: true, configuracao });
  } catch (error) {
    next(error);
  }
}

export async function listarModulos(req, res, next) {
  try {
    const dados = await service.listarModulos(req.organizacao.id);
    return res.json({ success: true, dados });
  } catch (error) {
    next(error);
  }
}

export async function atualizarModulo(req, res, next) {
  try {
    const modulo = String(req.params.modulo || "").toUpperCase();
    if (!MODULOS.has(modulo)) {
      return res.status(400).json({ success: false, message: "Módulo inválido." });
    }

    const parsed = atualizarModuloSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Dados inválidos.",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const anterior = req.organizacao.modulos?.find((item) => item.modulo === modulo) || null;
    const registro = await service.atualizarModulo(req.organizacao.id, modulo, parsed.data);

    await registrarAuditoria({
      organizacaoId: req.organizacao.id,
      empresaId: req.empresa.id,
      usuarioId: req.usuario.id,
      acao: "ATUALIZAR_MODULO",
      entidade: "ModuloOrganizacao",
      entidadeId: `${req.organizacao.id}:${modulo}`,
      dadosAnteriores: anterior,
      dadosNovos: registro,
      ip: req.ip,
    });

    return res.json({ success: true, modulo: registro });
  } catch (error) {
    next(error);
  }
}
