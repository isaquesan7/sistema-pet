import prisma from "../../config/prisma.js";

export async function obterOrganizacao(id) {
  return prisma.organizacao.findUnique({
    where: { id },
    include: {
      configuracao: true,
      modulos: { orderBy: { modulo: "asc" } },
      empresas: {
        where: { ativo: true },
        orderBy: { nomeFantasia: "asc" },
        select: {
          id: true,
          tipo: true,
          razaoSocial: true,
          nomeFantasia: true,
          cnpj: true,
          telefone: true,
          email: true,
          ativo: true,
        },
      },
    },
  });
}

export async function atualizarConfiguracao(organizacaoId, dados) {
  const normalizado = {
    ...dados,
    email: dados.email === "" ? null : dados.email,
    lgpdContatoEmail: dados.lgpdContatoEmail === "" ? null : dados.lgpdContatoEmail,
  };

  return prisma.configuracaoOrganizacao.upsert({
    where: { organizacaoId },
    update: normalizado,
    create: { organizacaoId, ...normalizado },
  });
}

export async function listarModulos(organizacaoId) {
  return prisma.moduloOrganizacao.findMany({
    where: { organizacaoId },
    orderBy: { modulo: "asc" },
  });
}

export async function atualizarModulo(organizacaoId, modulo, dados) {
  const atual = await prisma.moduloOrganizacao.findUnique({
    where: { organizacaoId_modulo: { organizacaoId, modulo } },
  });

  if (dados.habilitado && atual && !atual.contratado) {
    throw new Error("MODULO_NAO_CONTRATADO");
  }

  return prisma.moduloOrganizacao.upsert({
    where: { organizacaoId_modulo: { organizacaoId, modulo } },
    update: dados,
    create: { organizacaoId, modulo, contratado: false, ...dados, habilitado: false },
  });
}
