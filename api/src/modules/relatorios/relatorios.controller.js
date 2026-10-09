import * as service from "./relatorios.service.js";

function params(req) {
  return {
    organizacaoId: req.organizacao.id,
    empresaId: req.empresa.id,
    usuarioId: req.usuario.id,
    escopo: req.query.escopo,
    dataInicio: req.query.dataInicio,
    dataFim: req.query.dataFim,
  };
}

export async function painel(req, res, next) {
  try {
    const dados = await service.gerarPainel(params(req));
    return res.json({ success: true, dados });
  } catch (error) {
    next(error);
  }
}

export async function exportar(req, res, next) {
  try {
    const tipo = String(req.query.tipo || "vendas").toLowerCase();
    const arquivo = await service.exportarCsv({ ...params(req), tipo });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"${arquivo.nome}\"`);
    return res.send(`\uFEFF${arquivo.conteudo}`);
  } catch (error) {
    if (error.message === "RELATORIO_EXPORTACAO_INVALIDO") {
      return res.status(400).json({ success: false, message: "Tipo de relatório inválido para exportação." });
    }
    next(error);
  }
}
