import prisma from "../../config/prisma.js";

function somenteNumeros(valor) {
  if (!valor) return null;
  const v = String(valor).replace(/\D/g, "");
  return v || null;
}

function data(valor) {
  return valor ? new Date(`${valor}T00:00:00.000Z`) : null;
}

async function validarEmpresaDaOrganizacao(organizacaoId, empresaId) {
  const empresa = await prisma.empresa.findFirst({
    where: { id: empresaId, organizacaoId, ativo: true },
    select: { id: true },
  });
  if (!empresa) throw new Error("EMPRESA_INVALIDA");
}

export async function listarFuncoes(organizacaoId) {
  return prisma.funcaoFuncionario.findMany({
    where: { organizacaoId },
    orderBy: { nome: "asc" },
  });
}

export async function criarFuncao(organizacaoId, dados) {
  const existente = await prisma.funcaoFuncionario.findFirst({
    where: {
      organizacaoId,
      nome: { equals: dados.nome, mode: "insensitive" },
    },
  });
  if (existente) throw new Error("FUNCAO_JA_EXISTE");
  return prisma.funcaoFuncionario.create({
    data: {
      organizacaoId,
      nome: dados.nome,
      descricao: dados.descricao || null,
      ativo: dados.ativo ?? true,
    },
  });
}

export async function atualizarFuncao(organizacaoId, id, dados) {
  const atual = await prisma.funcaoFuncionario.findFirst({
    where: { id, organizacaoId },
  });
  if (!atual) throw new Error("FUNCAO_INVALIDA");

  if (dados.nome && dados.nome !== atual.nome) {
    const duplicada = await prisma.funcaoFuncionario.findFirst({
      where: {
        organizacaoId,
        id: { not: id },
        nome: { equals: dados.nome, mode: "insensitive" },
      },
    });
    if (duplicada) throw new Error("FUNCAO_JA_EXISTE");
  }

  return prisma.funcaoFuncionario.update({
    where: { id },
    data: {
      ...(dados.nome ? { nome: dados.nome.trim() } : {}),
      ...(Object.prototype.hasOwnProperty.call(dados, "descricao")
        ? { descricao: dados.descricao || null }
        : {}),
      ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
    },
  });
}

export async function listarFuncionarios(organizacaoId, busca) {
  return prisma.funcionario.findMany({
    where: {
      organizacaoId,
      ...(busca
        ? {
            OR: [
              { nome: { contains: busca, mode: "insensitive" } },
              { cpf: { contains: somenteNumeros(busca) || busca } },
              { matricula: { contains: busca, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { nome: "asc" },
    include: {
      funcao: true,
      usuario: { select: { id: true, nome: true, email: true, status: true } },
      empresas: {
        include: { empresa: { select: { id: true, nomeFantasia: true, tipo: true } } },
      },
    },
  });
}

async function validarRelacoes(organizacaoId, dados) {
  if (dados.funcaoId) {
    const funcao = await prisma.funcaoFuncionario.findFirst({
      where: { id: dados.funcaoId, organizacaoId },
    });
    if (!funcao) throw new Error("FUNCAO_INVALIDA");
  }

  if (dados.usuarioId) {
    const vinculo = await prisma.usuarioOrganizacao.findUnique({
      where: {
        usuarioId_organizacaoId: {
          usuarioId: dados.usuarioId,
          organizacaoId,
        },
      },
    });
    if (!vinculo?.ativo) throw new Error("USUARIO_INVALIDO");
  }

  for (const empresa of dados.empresas || []) {
    await validarEmpresaDaOrganizacao(organizacaoId, empresa.empresaId);
  }
}

export async function criarFuncionario(organizacaoId, dados) {
  await validarRelacoes(organizacaoId, dados);
  const cpf = somenteNumeros(dados.cpf);

  if (cpf) {
    const existente = await prisma.funcionario.findFirst({ where: { organizacaoId, cpf } });
    if (existente) throw new Error("CPF_JA_CADASTRADO");
  }

  return prisma.$transaction(async (tx) => {
    const funcionario = await tx.funcionario.create({
      data: {
        organizacaoId,
        usuarioId: dados.usuarioId || null,
        funcaoId: dados.funcaoId || null,
        nome: dados.nome,
        cpf,
        email: dados.email || null,
        telefone: somenteNumeros(dados.telefone),
        matricula: dados.matricula || null,
        dataAdmissao: data(dados.dataAdmissao),
        dataDemissao: data(dados.dataDemissao),
        salarioBase: dados.salarioBase ?? null,
        status: dados.status ?? "ATIVO",
        observacoes: dados.observacoes || null,
      },
    });

    if (dados.empresas?.length) {
      await tx.funcionarioEmpresa.createMany({
        data: dados.empresas.map((item) => ({
          funcionarioId: funcionario.id,
          empresaId: item.empresaId,
          principal: item.principal ?? false,
        })),
      });
    }

    return tx.funcionario.findUnique({
      where: { id: funcionario.id },
      include: { funcao: true, empresas: { include: { empresa: true } } },
    });
  });
}

export async function atualizarFuncionario(organizacaoId, id, dados) {
  const atual = await prisma.funcionario.findFirst({ where: { id, organizacaoId } });
  if (!atual) throw new Error("FUNCIONARIO_NAO_ENCONTRADO");
  await validarRelacoes(organizacaoId, dados);

  const cpf = Object.prototype.hasOwnProperty.call(dados, "cpf")
    ? somenteNumeros(dados.cpf)
    : undefined;

  if (cpf && cpf !== atual.cpf) {
    const duplicado = await prisma.funcionario.findFirst({
      where: { organizacaoId, cpf, id: { not: id } },
    });
    if (duplicado) throw new Error("CPF_JA_CADASTRADO");
  }

  return prisma.$transaction(async (tx) => {
    await tx.funcionario.update({
      where: { id },
      data: {
        ...(Object.prototype.hasOwnProperty.call(dados, "usuarioId") ? { usuarioId: dados.usuarioId || null } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "funcaoId") ? { funcaoId: dados.funcaoId || null } : {}),
        ...(dados.nome ? { nome: dados.nome } : {}),
        ...(cpf !== undefined ? { cpf } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "email") ? { email: dados.email || null } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "telefone") ? { telefone: somenteNumeros(dados.telefone) } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "matricula") ? { matricula: dados.matricula || null } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "dataAdmissao") ? { dataAdmissao: data(dados.dataAdmissao) } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "dataDemissao") ? { dataDemissao: data(dados.dataDemissao) } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "salarioBase") ? { salarioBase: dados.salarioBase } : {}),
        ...(dados.status ? { status: dados.status } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "observacoes") ? { observacoes: dados.observacoes || null } : {}),
      },
    });

    if (dados.empresas) {
      await tx.funcionarioEmpresa.deleteMany({ where: { funcionarioId: id } });
      if (dados.empresas.length) {
        await tx.funcionarioEmpresa.createMany({
          data: dados.empresas.map((item) => ({
            funcionarioId: id,
            empresaId: item.empresaId,
            principal: item.principal ?? false,
          })),
        });
      }
    }

    return tx.funcionario.findUnique({
      where: { id },
      include: { funcao: true, empresas: { include: { empresa: true } } },
    });
  });
}

export async function salvarJornadas(organizacaoId, funcionarioId, jornadas) {
  const funcionario = await prisma.funcionario.findFirst({ where: { id: funcionarioId, organizacaoId } });
  if (!funcionario) throw new Error("FUNCIONARIO_NAO_ENCONTRADO");
  for (const jornada of jornadas) {
    await validarEmpresaDaOrganizacao(organizacaoId, jornada.empresaId);
  }

  return prisma.$transaction(async (tx) => {
    for (const jornada of jornadas) {
      await tx.jornadaTrabalho.upsert({
        where: {
          funcionarioId_empresaId_diaSemana: {
            funcionarioId,
            empresaId: jornada.empresaId,
            diaSemana: jornada.diaSemana,
          },
        },
        update: jornada,
        create: { funcionarioId, ...jornada },
      });
    }
    return tx.jornadaTrabalho.findMany({
      where: { funcionarioId },
      orderBy: [{ diaSemana: "asc" }, { empresaId: "asc" }],
    });
  });
}

export async function statusPonto(organizacaoId, funcionarioId, empresaId) {
  const funcionario = await prisma.funcionario.findFirst({
    where: {
      id: funcionarioId,
      organizacaoId,
      status: { not: "DESLIGADO" },
      empresas: { some: { empresaId, ativo: true } },
    },
  });
  if (!funcionario) throw new Error("FUNCIONARIO_NAO_ENCONTRADO");

  const ultimo = await prisma.registroPonto.findFirst({
    where: { funcionarioId, empresaId },
    orderBy: { registradoEm: "desc" },
  });

  let tiposPermitidos;
  if (!ultimo || ultimo.tipo === "SAIDA") {
    tiposPermitidos = ["ENTRADA"];
  } else if (ultimo.tipo === "ENTRADA") {
    tiposPermitidos = ["INICIO_PAUSA", "SAIDA"];
  } else if (ultimo.tipo === "INICIO_PAUSA") {
    tiposPermitidos = ["FIM_PAUSA"];
  } else {
    // Após o retorno, a ação mais comum é a saída, mas uma nova pausa continua possível.
    tiposPermitidos = ["SAIDA", "INICIO_PAUSA"];
  }

  return {
    ultimoRegistro: ultimo,
    proximoTipo: tiposPermitidos[0],
    tiposPermitidos,
  };
}

export async function proximoTipoPonto(organizacaoId, funcionarioId, empresaId) {
  const status = await statusPonto(organizacaoId, funcionarioId, empresaId);
  return status.proximoTipo;
}

export async function baterPonto({
  organizacaoId,
  empresaId,
  funcionarioId,
  usuarioId,
  tipo,
  origem,
  ip,
  userAgent,
}) {
  const status = await statusPonto(organizacaoId, funcionarioId, empresaId);
  const tipoEscolhido = tipo || status.proximoTipo;

  if (!status.tiposPermitidos.includes(tipoEscolhido)) {
    throw new Error("TIPO_PONTO_INVALIDO");
  }

  return prisma.registroPonto.create({
    data: {
      funcionarioId,
      empresaId,
      registradoPorId: usuarioId || null,
      tipo: tipoEscolhido,
      origem,
      ip,
      userAgent,
    },
  });
}

export async function listarRegistros({ organizacaoId, funcionarioId, empresaId, inicio, fim }) {
  const funcionario = await prisma.funcionario.findFirst({ where: { id: funcionarioId, organizacaoId } });
  if (!funcionario) throw new Error("FUNCIONARIO_NAO_ENCONTRADO");
  if (empresaId) await validarEmpresaDaOrganizacao(organizacaoId, empresaId);

  return prisma.registroPonto.findMany({
    where: {
      funcionarioId,
      ...(empresaId ? { empresaId } : {}),
      ...(inicio || fim
        ? {
            registradoEm: {
              ...(inicio ? { gte: new Date(inicio) } : {}),
              ...(fim ? { lte: new Date(fim) } : {}),
            },
          }
        : {}),
    },
    orderBy: { registradoEm: "desc" },
    include: {
      empresa: { select: { id: true, nomeFantasia: true } },
      ajustes: {
        orderBy: { createdAt: "desc" },
        include: { usuario: { select: { id: true, nome: true } } },
      },
    },
  });
}

export async function ajustarPonto({ organizacaoId, registroId, usuarioId, horarioNovo, motivo }) {
  const registro = await prisma.registroPonto.findFirst({
    where: {
      id: registroId,
      funcionario: { organizacaoId },
    },
  });
  if (!registro) throw new Error("REGISTRO_NAO_ENCONTRADO");

  const ultimoAjuste = await prisma.ajustePonto.findFirst({
    where: { registroId },
    orderBy: { createdAt: "desc" },
  });

  return prisma.ajustePonto.create({
    data: {
      registroId,
      usuarioId,
      horarioAnterior: ultimoAjuste?.horarioNovo ?? registro.registradoEm,
      horarioNovo: new Date(horarioNovo),
      motivo,
    },
  });
}
