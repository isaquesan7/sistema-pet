import prisma from "../../config/prisma.js";

function somenteNumeros(valor) {
  if (!valor) return null;
  const numeros = String(valor).replace(/\D/g, "");
  return numeros || null;
}

function limparTexto(valor) {
  if (valor === undefined) return undefined;
  if (valor === null) return null;
  const texto = String(valor).trim();
  return texto === "" ? null : texto;
}

function prepararDados(dados) {
  const resultado = {};

  if ("nome" in dados) resultado.nome = dados.nome.trim();
  if ("cpfCnpj" in dados) resultado.cpfCnpj = somenteNumeros(dados.cpfCnpj);
  if ("telefone" in dados) resultado.telefone = somenteNumeros(dados.telefone);
  if ("whatsapp" in dados) resultado.whatsapp = somenteNumeros(dados.whatsapp);
  if ("email" in dados) {
    resultado.email = dados.email ? dados.email.trim().toLowerCase() : null;
  }
  if ("dataNascimento" in dados) {
    resultado.dataNascimento = dados.dataNascimento
      ? new Date(`${dados.dataNascimento}T00:00:00.000Z`)
      : null;
  }

  for (const campo of [
    "cep",
    "logradouro",
    "numero",
    "complemento",
    "bairro",
    "cidade",
    "estado",
    "observacoes",
  ]) {
    if (campo in dados) resultado[campo] = limparTexto(dados[campo]);
  }

  return resultado;
}

export async function criarCliente(organizacaoId, dados) {
  const data = prepararDados(dados);

  if (data.cpfCnpj) {
    const existente = await prisma.cliente.findFirst({
      where: { organizacaoId, cpfCnpj: data.cpfCnpj },
    });
    if (existente) throw new Error("DOCUMENTO_JA_CADASTRADO");
  }

  return prisma.cliente.create({
    data: { ...data, organizacaoId },
    include: {
      pets: true,
      conta: {
        select: {
          id: true,
          status: true,
          emailVerificado: true,
          telefoneVerificado: true,
        },
      },
    },
  });
}

export async function listarClientes({
  organizacaoId,
  busca,
  pagina = 1,
  limite = 20,
}) {
  const skip = (pagina - 1) * limite;
  const buscaNumerica = busca ? somenteNumeros(busca) : null;

  const where = {
    organizacaoId,
    ativo: true,
    ...(busca
      ? {
          OR: [
            { nome: { contains: busca, mode: "insensitive" } },
            { email: { contains: busca, mode: "insensitive" } },
            { telefone: { contains: buscaNumerica || busca } },
            { whatsapp: { contains: buscaNumerica || busca } },
            { cpfCnpj: { contains: buscaNumerica || busca } },
            {
              pets: {
                some: { nome: { contains: busca, mode: "insensitive" } },
              },
            },
          ],
        }
      : {}),
  };

  const [clientes, total] = await prisma.$transaction([
    prisma.cliente.findMany({
      where,
      skip,
      take: limite,
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        cpfCnpj: true,
        telefone: true,
        whatsapp: true,
        email: true,
        ativo: true,
        pets: {
          where: { ativo: true },
          select: {
            id: true,
            nome: true,
            fotoUrl: true,
            especie: { select: { id: true, nome: true } },
            raca: { select: { id: true, nome: true } },
          },
        },
        conta: { select: { id: true, status: true } },
      },
    }),
    prisma.cliente.count({ where }),
  ]);

  return {
    dados: clientes,
    paginacao: {
      pagina,
      limite,
      total,
      paginas: Math.ceil(total / limite),
    },
  };
}

export async function buscarClientePorId(organizacaoId, id) {
  const cliente = await prisma.cliente.findFirst({
    where: { id, organizacaoId },
    include: {
      pets: {
        where: { ativo: true },
        include: {
          especie: true,
          raca: true,
          pesos: { orderBy: { data: "desc" }, take: 5 },
        },
      },
      conta: {
        select: {
          id: true,
          email: true,
          telefone: true,
          status: true,
          emailVerificado: true,
          telefoneVerificado: true,
          ultimoAcesso: true,
        },
      },
    },
  });

  if (!cliente) throw new Error("CLIENTE_NAO_ENCONTRADO");
  return cliente;
}

export async function atualizarCliente(organizacaoId, id, dados) {
  const atual = await prisma.cliente.findFirst({
    where: { id, organizacaoId },
  });
  if (!atual) throw new Error("CLIENTE_NAO_ENCONTRADO");

  const data = prepararDados(dados);

  if (data.cpfCnpj && data.cpfCnpj !== atual.cpfCnpj) {
    const documentoExistente = await prisma.cliente.findFirst({
      where: {
        organizacaoId,
        cpfCnpj: data.cpfCnpj,
        NOT: { id },
      },
    });
    if (documentoExistente) throw new Error("DOCUMENTO_JA_CADASTRADO");
  }

  return prisma.cliente.update({
    where: { id },
    data,
    include: { pets: { where: { ativo: true } } },
  });
}
