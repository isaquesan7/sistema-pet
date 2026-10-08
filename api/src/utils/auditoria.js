import prisma from "../config/prisma.js";

function paraJsonSeguro(valor) {
  if (valor === null || valor === undefined) return null;

  return JSON.parse(
    JSON.stringify(valor, (_chave, item) => {
      if (typeof item === "bigint") return item.toString();
      return item;
    })
  );
}

export async function registrarAuditoria({
  organizacaoId,
  empresaId = null,
  usuarioId = null,
  acao,
  entidade,
  entidadeId = null,
  dadosAnteriores = null,
  dadosNovos = null,
  ip = null,
}) {
  try {
    await prisma.auditoria.create({
      data: {
        organizacaoId,
        empresaId,
        usuarioId,
        acao,
        entidade,
        entidadeId,
        dadosAnteriores: paraJsonSeguro(dadosAnteriores),
        dadosNovos: paraJsonSeguro(dadosNovos),
        ip,
      },
    });
  } catch (error) {
    // Auditoria não deve derrubar a operação principal.
    console.error("Falha ao registrar auditoria:", error);
  }
}
