import prisma from "../config/prisma.js";

const CHAVES_SENSIVEIS = /(senha|password|token|secret|authorization|cookie|pixCopiaCola|certificado)/i;

function limparSensivel(valor, profundidade = 0) {
  if (valor === null || valor === undefined) return valor;
  if (profundidade > 8) return "[TRUNCADO]";
  if (Array.isArray(valor)) return valor.map((item) => limparSensivel(item, profundidade + 1));
  if (typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor).map(([chave, item]) => [
      chave,
      CHAVES_SENSIVEIS.test(chave) ? "[REDACTED]" : limparSensivel(item, profundidade + 1),
    ]));
  }
  return valor;
}

function paraJsonSeguro(valor) {
  if (valor === null || valor === undefined) return null;
  return JSON.parse(JSON.stringify(limparSensivel(valor), (_chave, item) => typeof item === "bigint" ? item.toString() : item));
}

export async function registrarAuditoria({
  organizacaoId, empresaId = null, usuarioId = null, acao, entidade, entidadeId = null,
  dadosAnteriores = null, dadosNovos = null, ip = null,
}) {
  try {
    await prisma.auditoria.create({
      data: {
        organizacaoId, empresaId, usuarioId, acao, entidade, entidadeId,
        dadosAnteriores: paraJsonSeguro(dadosAnteriores),
        dadosNovos: paraJsonSeguro(dadosNovos),
        ip,
      },
    });
  } catch (error) {
    // Auditoria não deve derrubar a operação principal, mas a falha fica no log operacional.
    console.error("Falha ao registrar auditoria:", error);
  }
}
