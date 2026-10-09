import bcrypt from "bcryptjs";
import prisma from "../../config/prisma.js";

export const MODULOS_SISTEMA = [
  "PDV", "ESTOQUE", "CONSULTORIO", "BANHO_TOSA", "FINANCEIRO",
  "PORTAL_CLIENTE", "PONTO", "FISCAL", "RELATORIOS",
];

function somenteDigitos(value) {
  return String(value || "").replace(/\D/g, "");
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56) || "pet-shop";
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + Number(days || 0));
  return result;
}

function addCycle(date, ciclo) {
  const result = new Date(date);
  if (ciclo === "ANUAL") result.setFullYear(result.getFullYear() + 1);
  else result.setMonth(result.getMonth() + 1);
  return result;
}

function dateOnly(date) {
  return new Date(`${new Date(date).toISOString().slice(0, 10)}T12:00:00.000Z`);
}

function number(value) {
  return value == null ? null : Number(value);
}

function serializePlano(plano) {
  if (!plano) return null;
  return {
    ...plano,
    precoMensal: number(plano.precoMensal),
    precoAnual: number(plano.precoAnual),
    modulos: (plano.modulos || []).map((item) => item.modulo || item),
  };
}

function serializeFatura(fatura) {
  return fatura ? { ...fatura, valor: number(fatura.valor), planoDestino: serializePlano(fatura.planoDestino) } : null;
}

export async function gerarSlugUnico(nome, tx = prisma) {
  const base = slugify(nome);
  let slug = base;
  let index = 2;
  while (await tx.organizacao.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${index++}`;
  }
  return slug;
}

export function assinaturaBloqueada(assinatura, now = new Date()) {
  if (!assinatura) return { bloqueada: true, motivo: "ASSINATURA_AUSENTE" };
  if (["SUSPENSA", "CANCELADA"].includes(assinatura.status)) {
    return { bloqueada: true, motivo: `ASSINATURA_${assinatura.status}` };
  }
  if (assinatura.status === "TRIAL" && assinatura.trialFimEm && new Date(assinatura.trialFimEm) < now) {
    return { bloqueada: true, motivo: "TRIAL_EXPIRADO" };
  }
  return { bloqueada: false, motivo: null };
}

async function sincronizarModulosComPlanoTx(tx, organizacaoId, planoId) {
  const plano = await tx.planoSaaS.findUnique({
    where: { id: planoId },
    include: { modulos: true },
  });
  if (!plano) throw new Error("PLANO_NAO_ENCONTRADO");
  const contratados = new Set(plano.modulos.map((item) => item.modulo));
  const existentes = await tx.moduloOrganizacao.findMany({ where: { organizacaoId } });
  const porModulo = new Map(existentes.map((item) => [item.modulo, item]));

  for (const modulo of MODULOS_SISTEMA) {
    const contratado = contratados.has(modulo);
    const atual = porModulo.get(modulo);
    const habilitado = contratado
      ? (atual?.contratado ? atual.habilitado : true)
      : false;
    await tx.moduloOrganizacao.upsert({
      where: { organizacaoId_modulo: { organizacaoId, modulo } },
      update: { contratado, habilitado },
      create: { organizacaoId, modulo, contratado, habilitado },
    });
  }
  return plano;
}

export async function sincronizarModulosComPlano(organizacaoId, planoId) {
  return prisma.$transaction((tx) => sincronizarModulosComPlanoTx(tx, organizacaoId, planoId), {
    maxWait: 10000,
    timeout: 30000,
  });
}

export async function listarPlanos({ somenteAtivos = true } = {}) {
  const planos = await prisma.planoSaaS.findMany({
    where: somenteAtivos ? { ativo: true } : undefined,
    include: { modulos: { orderBy: { modulo: "asc" } }, _count: { select: { assinaturas: true } } },
    orderBy: [{ ordem: "asc" }, { precoMensal: "asc" }],
  });
  return planos.map(serializePlano);
}

export async function criarOnboarding(dados, meta = {}) {
  const email = dados.administrador.email.trim().toLowerCase();
  const cnpj = somenteDigitos(dados.empresa.cnpj);
  if (cnpj.length !== 14) throw new Error("CNPJ_INVALIDO");

  const [usuarioExistente, empresaExistente, plano, permissoes] = await Promise.all([
    prisma.usuario.findUnique({ where: { email }, select: { id: true } }),
    prisma.empresa.findUnique({ where: { cnpj }, select: { id: true } }),
    prisma.planoSaaS.findUnique({ where: { slug: dados.planoSlug }, include: { modulos: true } }),
    prisma.permissao.findMany({ select: { id: true } }),
  ]);

  if (usuarioExistente) throw new Error("EMAIL_JA_CADASTRADO");
  if (empresaExistente) throw new Error("CNPJ_JA_CADASTRADO");
  if (!plano?.ativo) throw new Error("PLANO_NAO_ENCONTRADO");
  if (!permissoes.length) throw new Error("PLATAFORMA_NAO_INICIALIZADA");

  const senhaHash = await bcrypt.hash(dados.administrador.senha, 12);
  const agora = new Date();
  const trialFimEm = addDays(agora, plano.trialDias);
  const slug = await gerarSlugUnico(dados.organizacao.nome);

  return prisma.$transaction(async (tx) => {
    const organizacao = await tx.organizacao.create({
      data: {
        slug,
        nome: dados.organizacao.nome,
        configuracao: {
          create: {
            nomeExibicao: dados.organizacao.nome,
            telefone: dados.organizacao.telefone || null,
            whatsapp: dados.organizacao.whatsapp || null,
          },
        },
      },
    });

    for (const modulo of MODULOS_SISTEMA) {
      const contratado = plano.modulos.some((item) => item.modulo === modulo);
      await tx.moduloOrganizacao.create({
        data: { organizacaoId: organizacao.id, modulo, contratado, habilitado: contratado },
      });
    }

    const empresa = await tx.empresa.create({
      data: {
        organizacaoId: organizacao.id,
        tipo: dados.empresa.tipo,
        nomeFantasia: dados.empresa.nomeFantasia,
        razaoSocial: dados.empresa.razaoSocial,
        cnpj,
        telefone: dados.empresa.telefone || null,
        email: dados.empresa.email || null,
      },
    });

    const usuario = await tx.usuario.create({
      data: {
        nome: dados.administrador.nome,
        email,
        senhaHash,
        telefone: dados.administrador.telefone || null,
        organizacoes: { create: { organizacaoId: organizacao.id, papel: "PROPRIETARIO" } },
      },
    });

    const cargo = await tx.cargo.create({
      data: { empresaId: empresa.id, nome: "Administrador", descricao: "Administrador criado no onboarding PetRise." },
    });
    await tx.cargoPermissao.createMany({
      data: permissoes.map((permissao) => ({ cargoId: cargo.id, permissaoId: permissao.id })),
      skipDuplicates: true,
    });
    await tx.usuarioEmpresa.create({
      data: { usuarioId: usuario.id, empresaId: empresa.id, cargoId: cargo.id },
    });

    const assinatura = await tx.assinaturaSaaS.create({
      data: {
        organizacaoId: organizacao.id,
        planoId: plano.id,
        status: plano.trialDias > 0 ? "TRIAL" : "ATIVA",
        ciclo: dados.ciclo,
        provedor: (process.env.SAAS_BILLING_PROVIDER === "development" && process.env.NODE_ENV !== "production") ? "DESENVOLVIMENTO" : "MANUAL",
        trialFimEm: plano.trialDias > 0 ? trialFimEm : null,
        proximaCobrancaEm: plano.trialDias > 0 ? trialFimEm : addCycle(agora, dados.ciclo),
        eventos: {
          create: {
            usuarioId: usuario.id,
            tipo: "ONBOARDING_CONCLUIDO",
            descricao: `Organização criada no plano ${plano.nome}.`,
            dados: { ip: meta.ip || null, userAgent: meta.userAgent || null },
          },
        },
      },
    });

    return {
      organizacao: { id: organizacao.id, slug: organizacao.slug, nome: organizacao.nome },
      empresa: { id: empresa.id, nomeFantasia: empresa.nomeFantasia },
      administrador: { id: usuario.id, nome: usuario.nome, email: usuario.email },
      assinatura: { id: assinatura.id, status: assinatura.status, trialFimEm: assinatura.trialFimEm },
      plano: serializePlano(plano),
    };
  }, { maxWait: 10000, timeout: 30000 });
}

async function atualizarFaturasVencidas(organizacaoId) {
  const hoje = dateOnly(new Date());
  await prisma.faturaSaaS.updateMany({
    where: { organizacaoId, status: "PENDENTE", vencimento: { lt: hoje } },
    data: { status: "VENCIDA" },
  });

  const vencidas = await prisma.faturaSaaS.count({
    where: { organizacaoId, status: "VENCIDA" },
  });
  if (vencidas > 0) {
    await prisma.assinaturaSaaS.updateMany({
      where: { organizacaoId, status: "ATIVA" },
      data: { status: "INADIMPLENTE" },
    });
  }
}

export async function obterUsoOrganizacao(organizacaoId, plano = null) {
  const [empresas, usuarios, clientes, pets, funcionarios] = await Promise.all([
    prisma.empresa.count({ where: { organizacaoId, ativo: true } }),
    prisma.usuarioOrganizacao.count({ where: { organizacaoId, ativo: true } }),
    prisma.cliente.count({ where: { organizacaoId, ativo: true } }),
    prisma.pet.count({ where: { cliente: { organizacaoId }, ativo: true } }),
    prisma.funcionario.count({ where: { organizacaoId, status: { not: "DESLIGADO" } } }),
  ]);
  const p = plano || (await prisma.assinaturaSaaS.findUnique({ where: { organizacaoId }, include: { plano: true } }))?.plano;
  return {
    empresas: { usado: empresas, limite: p?.limiteEmpresas ?? null },
    usuarios: { usado: usuarios, limite: p?.limiteUsuarios ?? null },
    clientes: { usado: clientes, limite: p?.limiteClientes ?? null },
    pets: { usado: pets, limite: p?.limitePets ?? null },
    funcionarios: { usado: funcionarios, limite: p?.limiteFuncionarios ?? null },
  };
}

export async function verificarLimiteRecurso(organizacaoId, recurso) {
  const assinatura = await prisma.assinaturaSaaS.findUnique({ where: { organizacaoId }, include: { plano: true } });
  if (!assinatura?.plano) return;
  const map = {
    empresas: "limiteEmpresas",
    usuarios: "limiteUsuarios",
    clientes: "limiteClientes",
    pets: "limitePets",
    funcionarios: "limiteFuncionarios",
  };
  const campo = map[recurso];
  if (!campo || assinatura.plano[campo] == null) return;
  const uso = await obterUsoOrganizacao(organizacaoId, assinatura.plano);
  if (uso[recurso].usado >= assinatura.plano[campo]) {
    const error = new Error("LIMITE_PLANO_ATINGIDO");
    error.recurso = recurso;
    error.limite = assinatura.plano[campo];
    throw error;
  }
}

export async function obterAssinaturaOrganizacao(organizacaoId) {
  await atualizarFaturasVencidas(organizacaoId);
  const assinatura = await prisma.assinaturaSaaS.findUnique({
    where: { organizacaoId },
    include: {
      plano: { include: { modulos: { orderBy: { modulo: "asc" } } } },
      faturas: { include: { planoDestino: { include: { modulos: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
      eventos: { orderBy: { createdAt: "desc" }, take: 15 },
    },
  });
  if (!assinatura) return null;
  const acesso = assinaturaBloqueada(assinatura);
  const uso = await obterUsoOrganizacao(organizacaoId, assinatura.plano);
  return {
    ...assinatura,
    plano: serializePlano(assinatura.plano),
    faturas: assinatura.faturas.map(serializeFatura),
    uso,
    acesso,
  };
}

export async function gerarFaturaOrganizacao({ organizacaoId, planoId, ciclo }) {
  const assinatura = await prisma.assinaturaSaaS.findUnique({ where: { organizacaoId }, include: { plano: true } });
  if (!assinatura) throw new Error("ASSINATURA_NAO_ENCONTRADA");
  const destino = planoId ? await prisma.planoSaaS.findUnique({ where: { id: planoId }, include: { modulos: true } }) : assinatura.plano;
  if (!destino?.ativo) throw new Error("PLANO_NAO_ENCONTRADO");
  const cicloFinal = ciclo || assinatura.ciclo;
  const valor = cicloFinal === "ANUAL" ? destino.precoAnual : destino.precoMensal;

  const pendente = await prisma.faturaSaaS.findFirst({
    where: { assinaturaId: assinatura.id, planoDestinoId: destino.id, status: { in: ["PENDENTE", "VENCIDA"] } },
    orderBy: { createdAt: "desc" },
  });
  if (pendente) return serializeFatura(pendente);

  const vencimento = addDays(new Date(), 3);
  const provedor = (process.env.SAAS_BILLING_PROVIDER === "development" && process.env.NODE_ENV !== "production") ? "DESENVOLVIMENTO" : "MANUAL";
  const fatura = await prisma.faturaSaaS.create({
    data: {
      assinaturaId: assinatura.id,
      organizacaoId,
      planoDestinoId: destino.id,
      status: "PENDENTE",
      provedor,
      ciclo: cicloFinal,
      descricao: `Assinatura PetRise — ${destino.nome} (${cicloFinal === "ANUAL" ? "anual" : "mensal"})`,
      valor,
      vencimento: dateOnly(vencimento),
      payload: { finalidade: planoId && planoId !== assinatura.planoId ? "TROCA_PLANO" : "RENOVACAO" },
    },
    include: { planoDestino: { include: { modulos: true } } },
  });
  return serializeFatura(fatura);
}

async function aplicarPagamentoFaturaTx(tx, fatura, usuarioId = null) {
  const agora = new Date();
  const planoId = fatura.planoDestinoId || fatura.assinatura.planoId;
  await tx.faturaSaaS.update({ where: { id: fatura.id }, data: { status: "PAGA", pagoEm: agora } });
  await tx.assinaturaSaaS.update({
    where: { id: fatura.assinaturaId },
    data: {
      planoId,
      ciclo: fatura.ciclo,
      status: "ATIVA",
      trialFimEm: null,
      suspensaEm: null,
      canceladaEm: null,
      proximaCobrancaEm: addCycle(agora, fatura.ciclo),
    },
  });
  await sincronizarModulosComPlanoTx(tx, fatura.organizacaoId, planoId);
  await tx.eventoSaaS.create({
    data: { assinaturaId: fatura.assinaturaId, usuarioId, tipo: "FATURA_PAGA", descricao: `Fatura ${fatura.id} marcada como paga.`, dados: { valor: Number(fatura.valor), ciclo: fatura.ciclo } },
  });
}

export async function simularPagamentoTenant(organizacaoId, faturaId, usuarioId) {
  if (process.env.SAAS_BILLING_PROVIDER !== "development" || process.env.NODE_ENV === "production") throw new Error("SIMULACAO_INDISPONIVEL");
  return prisma.$transaction(async (tx) => {
    const fatura = await tx.faturaSaaS.findFirst({
      where: { id: faturaId, organizacaoId }, include: { assinatura: true },
    });
    if (!fatura) throw new Error("FATURA_NAO_ENCONTRADA");
    if (!["PENDENTE", "VENCIDA"].includes(fatura.status)) throw new Error("FATURA_NAO_PENDENTE");
    await aplicarPagamentoFaturaTx(tx, fatura, usuarioId);
    return { success: true };
  }, { maxWait: 10000, timeout: 30000 });
}

export async function listarOrganizacoesPlataforma({ busca = "", status = "" } = {}) {
  const hoje = dateOnly(new Date());
  await prisma.faturaSaaS.updateMany({ where: { status: "PENDENTE", vencimento: { lt: hoje } }, data: { status: "VENCIDA" } });
  const orgsVencidas = await prisma.faturaSaaS.findMany({ where: { status: "VENCIDA" }, distinct: ["organizacaoId"], select: { organizacaoId: true } });
  if (orgsVencidas.length) await prisma.assinaturaSaaS.updateMany({ where: { organizacaoId: { in: orgsVencidas.map((item) => item.organizacaoId) }, status: "ATIVA" }, data: { status: "INADIMPLENTE" } });
  const where = {};
  if (busca) {
    where.OR = [
      { nome: { contains: busca, mode: "insensitive" } },
      { slug: { contains: busca, mode: "insensitive" } },
      { empresas: { some: { nomeFantasia: { contains: busca, mode: "insensitive" } } } },
    ];
  }
  if (status) where.assinaturaSaaS = { status };
  const rows = await prisma.organizacao.findMany({
    where,
    include: {
      configuracao: true,
      assinaturaSaaS: { include: { plano: { include: { modulos: true } } } },
      _count: { select: { empresas: true, usuarios: true, clientes: true } },
      empresas: { select: { id: true, nomeFantasia: true, cnpj: true, ativo: true }, orderBy: { nomeFantasia: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({ ...row, assinaturaSaaS: row.assinaturaSaaS ? { ...row.assinaturaSaaS, plano: serializePlano(row.assinaturaSaaS.plano), acesso: assinaturaBloqueada(row.assinaturaSaaS) } : null }));
}

export async function dashboardPlataforma() {
  const [total, trials, ativas, inadimplentes, suspensas, faturasPendentes, assinaturas] = await Promise.all([
    prisma.organizacao.count(),
    prisma.assinaturaSaaS.count({ where: { status: "TRIAL" } }),
    prisma.assinaturaSaaS.count({ where: { status: "ATIVA" } }),
    prisma.assinaturaSaaS.count({ where: { status: "INADIMPLENTE" } }),
    prisma.assinaturaSaaS.count({ where: { status: "SUSPENSA" } }),
    prisma.faturaSaaS.aggregate({ where: { status: { in: ["PENDENTE", "VENCIDA"] } }, _sum: { valor: true }, _count: true }),
    prisma.assinaturaSaaS.findMany({ where: { status: "ATIVA" }, include: { plano: true } }),
  ]);
  const mrr = assinaturas.reduce((sum, item) => {
    const valor = item.ciclo === "ANUAL" ? Number(item.plano.precoAnual || 0) / 12 : Number(item.plano.precoMensal || 0);
    return sum + valor;
  }, 0);
  return { totalOrganizacoes: total, trials, ativas, inadimplentes, suspensas, mrr, faturasPendentes: faturasPendentes._count, valorPendente: Number(faturasPendentes._sum.valor || 0) };
}

export async function atualizarAssinaturaPlataforma(organizacaoId, dados, usuarioId) {
  return prisma.$transaction(async (tx) => {
    const atual = await tx.assinaturaSaaS.findUnique({ where: { organizacaoId } });
    if (!atual) throw new Error("ASSINATURA_NAO_ENCONTRADA");
    if (dados.planoId) {
      const plano = await tx.planoSaaS.findUnique({ where: { id: dados.planoId } });
      if (!plano) throw new Error("PLANO_NAO_ENCONTRADO");
      await sincronizarModulosComPlanoTx(tx, organizacaoId, dados.planoId);
    }
    const data = {
      ...(dados.planoId ? { planoId: dados.planoId } : {}),
      ...(dados.status ? { status: dados.status } : {}),
      ...(dados.ciclo ? { ciclo: dados.ciclo } : {}),
      ...(Object.hasOwn(dados, "trialFimEm") ? { trialFimEm: dados.trialFimEm ? new Date(dados.trialFimEm) : null } : {}),
      ...(Object.hasOwn(dados, "proximaCobrancaEm") ? { proximaCobrancaEm: dados.proximaCobrancaEm ? new Date(dados.proximaCobrancaEm) : null } : {}),
      ...(Object.hasOwn(dados, "observacoesInternas") ? { observacoesInternas: dados.observacoesInternas || null } : {}),
      ...(dados.status === "SUSPENSA" ? { suspensaEm: new Date() } : {}),
      ...(dados.status === "CANCELADA" ? { canceladaEm: new Date() } : {}),
      ...(dados.status && !["SUSPENSA", "CANCELADA"].includes(dados.status) ? { suspensaEm: null, canceladaEm: null } : {}),
    };
    const assinatura = await tx.assinaturaSaaS.update({ where: { organizacaoId }, data, include: { plano: { include: { modulos: true } } } });
    await tx.eventoSaaS.create({ data: { assinaturaId: assinatura.id, usuarioId, tipo: "ASSINATURA_ALTERADA_PLATAFORMA", dados } });
    return { ...assinatura, plano: serializePlano(assinatura.plano) };
  }, { maxWait: 10000, timeout: 30000 });
}

export async function salvarPlano(dados, planoId = null) {
  return prisma.$transaction(async (tx) => {
    const data = {
      slug: dados.slug,
      nome: dados.nome,
      descricao: dados.descricao || null,
      precoMensal: dados.precoMensal,
      precoAnual: dados.precoAnual,
      trialDias: dados.trialDias,
      limiteEmpresas: dados.limiteEmpresas ?? null,
      limiteUsuarios: dados.limiteUsuarios ?? null,
      limiteClientes: dados.limiteClientes ?? null,
      limitePets: dados.limitePets ?? null,
      limiteFuncionarios: dados.limiteFuncionarios ?? null,
      ativo: dados.ativo,
      destaque: dados.destaque,
      ordem: dados.ordem,
    };
    const plano = planoId
      ? await tx.planoSaaS.update({ where: { id: planoId }, data })
      : await tx.planoSaaS.create({ data });
    await tx.planoModuloSaaS.deleteMany({ where: { planoId: plano.id } });
    await tx.planoModuloSaaS.createMany({ data: dados.modulos.map((modulo) => ({ planoId: plano.id, modulo })) });
    return tx.planoSaaS.findUnique({ where: { id: plano.id }, include: { modulos: true, _count: { select: { assinaturas: true } } } });
  }, { maxWait: 10000, timeout: 30000 }).then(serializePlano);
}

export async function listarFaturasPlataforma({ status = "" } = {}) {
  await prisma.faturaSaaS.updateMany({ where: { status: "PENDENTE", vencimento: { lt: dateOnly(new Date()) } }, data: { status: "VENCIDA" } });
  const rows = await prisma.faturaSaaS.findMany({
    where: status ? { status } : undefined,
    include: { organizacao: { select: { id: true, nome: true, slug: true } }, planoDestino: { include: { modulos: true } }, assinatura: { select: { planoId: true } } },
    orderBy: { createdAt: "desc" }, take: 300,
  });
  return rows.map(serializeFatura);
}

export async function criarFaturaManualPlataforma(dados) {
  const assinatura = await prisma.assinaturaSaaS.findUnique({ where: { organizacaoId: dados.organizacaoId } });
  if (!assinatura) throw new Error("ASSINATURA_NAO_ENCONTRADA");
  if (dados.planoDestinoId) {
    const plano = await prisma.planoSaaS.findUnique({ where: { id: dados.planoDestinoId } });
    if (!plano) throw new Error("PLANO_NAO_ENCONTRADO");
  }
  const fatura = await prisma.faturaSaaS.create({
    data: {
      assinaturaId: assinatura.id,
      organizacaoId: dados.organizacaoId,
      planoDestinoId: dados.planoDestinoId || null,
      valor: dados.valor,
      vencimento: dateOnly(dados.vencimento),
      descricao: dados.descricao || "Cobrança manual PetRise",
      ciclo: dados.ciclo,
      provedor: "MANUAL",
    },
    include: { planoDestino: { include: { modulos: true } } },
  });
  return serializeFatura(fatura);
}

export async function liquidarFaturaPlataforma(faturaId, usuarioId) {
  return prisma.$transaction(async (tx) => {
    const fatura = await tx.faturaSaaS.findUnique({ where: { id: faturaId }, include: { assinatura: true } });
    if (!fatura) throw new Error("FATURA_NAO_ENCONTRADA");
    if (!["PENDENTE", "VENCIDA"].includes(fatura.status)) throw new Error("FATURA_NAO_PENDENTE");
    await aplicarPagamentoFaturaTx(tx, fatura, usuarioId);
    return { success: true };
  }, { maxWait: 10000, timeout: 30000 });
}

export async function cancelarFaturaPlataforma(faturaId, usuarioId) {
  const fatura = await prisma.faturaSaaS.findUnique({ where: { id: faturaId } });
  if (!fatura) throw new Error("FATURA_NAO_ENCONTRADA");
  if (fatura.status === "PAGA") throw new Error("FATURA_JA_PAGA");
  await prisma.$transaction([
    prisma.faturaSaaS.update({ where: { id: faturaId }, data: { status: "CANCELADA", canceladoEm: new Date() } }),
    prisma.eventoSaaS.create({ data: { assinaturaId: fatura.assinaturaId, usuarioId, tipo: "FATURA_CANCELADA", descricao: `Fatura ${faturaId} cancelada pela plataforma.` } }),
  ]);
  return { success: true };
}
