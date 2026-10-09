import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import prisma from "../../config/prisma.js";
import { assinaturaBloqueada, verificarLimiteRecurso } from "../saas/saas.service.js";

const CLIENT_ACCESS_EXPIRES = process.env.JWT_CLIENT_ACCESS_EXPIRES || "30m";
const CLIENT_REFRESH_DAYS = Number(process.env.JWT_CLIENT_REFRESH_EXPIRES_DAYS || 30);
const RESERVA_MINUTOS = Number(process.env.PORTAL_RESERVA_MINUTOS || 10);

function accessSecret() {
  return process.env.JWT_CLIENT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET;
}
function refreshSecret() {
  return process.env.JWT_CLIENT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET;
}
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function digits(value) {
  if (!value) return null;
  const normalized = String(value).replace(/\D/g, "");
  return normalized || null;
}
function text(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}
function money(value) {
  return Number(value || 0);
}
function dateOnly(value) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

async function organizationBySlug(slug, { requirePortal = true } = {}) {
  const organization = await prisma.organizacao.findUnique({
    where: { slug },
    include: { configuracao: true, modulos: true, assinaturaSaaS: true, empresas: { where: { ativo: true } } },
  });
  if (!organization || !organization.ativo) throw new Error("ORGANIZACAO_NAO_ENCONTRADA");
  if (requirePortal) {
    const access = assinaturaBloqueada(organization.assinaturaSaaS);
    if (access.bloqueada) throw new Error("ASSINATURA_PORTAL_INDISPONIVEL");
    const enabled = organization.modulos.some((item) => item.modulo === "PORTAL_CLIENTE" && item.contratado && item.habilitado);
    if (!enabled) throw new Error("PORTAL_DESABILITADO");
  }
  return organization;
}

function responseAccount(account) {
  return {
    id: account.id,
    email: account.email,
    telefone: account.telefone,
    cliente: {
      id: account.cliente.id,
      nome: account.cliente.nome,
      cpfCnpj: account.cliente.cpfCnpj,
      telefone: account.cliente.telefone,
      whatsapp: account.cliente.whatsapp,
      email: account.cliente.email,
      dataNascimento: account.cliente.dataNascimento,
      cep: account.cliente.cep,
      logradouro: account.cliente.logradouro,
      numero: account.cliente.numero,
      complemento: account.cliente.complemento,
      bairro: account.cliente.bairro,
      cidade: account.cliente.cidade,
      estado: account.cliente.estado,
    },
    organizacao: {
      id: account.organizacao.id,
      slug: account.organizacao.slug,
      nome: account.organizacao.nome,
      configuracao: account.organizacao.configuracao,
    },
  };
}

function accessToken(account) {
  return jwt.sign(
    { sub: account.id, clienteId: account.clienteId, organizacaoId: account.organizacaoId, tipo: "CLIENTE" },
    accessSecret(),
    { expiresIn: CLIENT_ACCESS_EXPIRES }
  );
}

function refreshToken(account, sessionId, remember) {
  const options = remember ? {} : { expiresIn: `${CLIENT_REFRESH_DAYS}d` };
  return jwt.sign(
    { sub: account.id, sid: sessionId, organizacaoId: account.organizacaoId, tipo: "CLIENTE" },
    refreshSecret(),
    options
  );
}

function sessionExpiry(remember) {
  if (remember) return null;
  const expires = new Date();
  expires.setDate(expires.getDate() + CLIENT_REFRESH_DAYS);
  return expires;
}

async function createSession(account, { ip, userAgent, remember }) {
  const session = await prisma.sessaoCliente.create({
    data: {
      organizacaoId: account.organizacaoId,
      contaClienteId: account.id,
      refreshTokenHash: "TEMPORARIO",
      userAgent,
      ip,
      lembrarConectado: Boolean(remember),
      expiresAt: sessionExpiry(Boolean(remember)),
    },
  });
  const refresh = refreshToken(account, session.id, Boolean(remember));
  await prisma.sessaoCliente.update({ where: { id: session.id }, data: { refreshTokenHash: hashToken(refresh) } });
  return { accessToken: accessToken(account), refreshToken: refresh, manterConectado: Boolean(remember) };
}

export async function publicConfig(slug) {
  const organization = await organizationBySlug(slug);
  return {
    id: organization.id,
    slug: organization.slug,
    nome: organization.nome,
    configuracao: organization.configuracao,
    modulos: organization.modulos.filter((m) => m.contratado && m.habilitado).map((m) => m.modulo),
    empresas: organization.empresas.map((e) => ({ id: e.id, tipo: e.tipo, nomeFantasia: e.nomeFantasia })),
  };
}

export async function register(data, meta) {
  const organization = await organizationBySlug(data.organizacaoSlug);
  const email = data.email.trim().toLowerCase();
  const phone = digits(data.telefone);
  const document = digits(data.cpfCnpj);

  const accountExisting = await prisma.contaCliente.findFirst({
    where: { organizacaoId: organization.id, OR: [{ email }, ...(phone ? [{ telefone: phone }] : [])] },
  });
  if (accountExisting) throw new Error("CONTA_JA_EXISTE");

  let client = null;
  if (document) {
    client = await prisma.cliente.findFirst({ where: { organizacaoId: organization.id, cpfCnpj: document }, include: { conta: true } });
  }
  if (!client) {
    client = await prisma.cliente.findFirst({
      where: {
        organizacaoId: organization.id,
        OR: [{ email }, ...(phone ? [{ telefone: phone }, { whatsapp: phone }] : [])],
      },
      include: { conta: true },
    });
  }
  if (client?.conta) throw new Error("CONTA_JA_EXISTE");
  if (!client) await verificarLimiteRecurso(organization.id, "clientes");

  const passwordHash = await bcrypt.hash(data.senha, 12);
  const account = await prisma.$transaction(async (tx) => {
    const currentClient = client || await tx.cliente.create({
      data: {
        organizacaoId: organization.id,
        nome: data.nome.trim(),
        cpfCnpj: document,
        telefone: phone,
        whatsapp: phone,
        email,
      },
    });

    if (client) {
      await tx.cliente.update({
        where: { id: client.id },
        data: {
          nome: client.nome || data.nome.trim(),
          email: client.email || email,
          telefone: client.telefone || phone,
          whatsapp: client.whatsapp || phone,
        },
      });
    }

    return tx.contaCliente.create({
      data: {
        organizacaoId: organization.id,
        clienteId: currentClient.id,
        email,
        telefone: phone,
        senhaHash: passwordHash,
        status: "ATIVA",
      },
      include: { cliente: true, organizacao: { include: { configuracao: true } } },
    });
  }, { maxWait: 10_000, timeout: 30_000 });

  const session = await createSession(account, { ...meta, remember: data.manterConectado });
  return { ...session, conta: responseAccount(account) };
}

export async function login(data, meta) {
  const organization = await organizationBySlug(data.organizacaoSlug);
  const loginValue = data.login.trim().toLowerCase();
  const numeric = digits(data.login);
  const account = await prisma.contaCliente.findFirst({
    where: {
      organizacaoId: organization.id,
      OR: [{ email: loginValue }, ...(numeric ? [{ telefone: numeric }] : [])],
    },
    include: { cliente: true, organizacao: { include: { configuracao: true } } },
  });
  if (!account || account.status !== "ATIVA") throw new Error("CREDENCIAIS_INVALIDAS");
  if (!(await bcrypt.compare(data.senha, account.senhaHash))) throw new Error("CREDENCIAIS_INVALIDAS");

  await prisma.contaCliente.update({ where: { id: account.id }, data: { ultimoAcesso: new Date() } });
  const session = await createSession(account, { ...meta, remember: data.manterConectado });
  return { ...session, conta: responseAccount(account) };
}

export async function refresh({ token, ip, userAgent }) {
  let payload;
  try { payload = jwt.verify(token, refreshSecret()); } catch { throw new Error("REFRESH_INVALIDO"); }
  if (payload.tipo !== "CLIENTE") throw new Error("REFRESH_INVALIDO");

  const session = await prisma.sessaoCliente.findUnique({ where: { id: payload.sid } });
  if (!session || session.contaClienteId !== payload.sub || session.revokedAt || (session.expiresAt && session.expiresAt <= new Date()) || session.refreshTokenHash !== hashToken(token)) {
    throw new Error("REFRESH_INVALIDO");
  }
  const account = await prisma.contaCliente.findUnique({
    where: { id: session.contaClienteId },
    include: { cliente: true, organizacao: { include: { configuracao: true } } },
  });
  if (!account || account.status !== "ATIVA") throw new Error("REFRESH_INVALIDO");

  const nextRefresh = refreshToken(account, session.id, session.lembrarConectado);
  await prisma.sessaoCliente.update({
    where: { id: session.id },
    data: { refreshTokenHash: hashToken(nextRefresh), ip: ip || session.ip, userAgent: userAgent || session.userAgent },
  });
  return { accessToken: accessToken(account), refreshToken: nextRefresh, manterConectado: session.lembrarConectado, conta: responseAccount(account) };
}

export async function logout(token) {
  if (!token) return;
  try {
    const payload = jwt.verify(token, refreshSecret(), { ignoreExpiration: true });
    if (payload.tipo !== "CLIENTE") return;
    const session = await prisma.sessaoCliente.findUnique({ where: { id: payload.sid } });
    if (session && !session.revokedAt) await prisma.sessaoCliente.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  } catch { /* idempotente */ }
}

export async function updateProfile(accountId, data) {
  const account = await prisma.contaCliente.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("CONTA_NAO_ENCONTRADA");
  const update = {};
  for (const field of ["nome", "logradouro", "numero", "complemento", "bairro", "cidade", "estado"]) {
    if (data[field] !== undefined) update[field] = text(data[field]);
  }
  if (data.telefone !== undefined) update.telefone = digits(data.telefone);
  if (data.whatsapp !== undefined) update.whatsapp = digits(data.whatsapp);
  if (data.cep !== undefined) update.cep = digits(data.cep);
  if (data.dataNascimento !== undefined) update.dataNascimento = data.dataNascimento ? dateOnly(data.dataNascimento) : null;

  await prisma.cliente.update({ where: { id: account.clienteId }, data: update });
  const updated = await prisma.contaCliente.findUnique({ where: { id: accountId }, include: { cliente: true, organizacao: { include: { configuracao: true } } } });
  return responseAccount(updated);
}

async function validatePetOwnership({ petId, clientId, organizationId }) {
  const pet = await prisma.pet.findFirst({ where: { id: petId, clienteId: clientId, cliente: { organizacaoId: organizationId }, ativo: true } });
  if (!pet) throw new Error("PET_NAO_ENCONTRADO");
  return pet;
}

export async function listPets({ clientId, organizationId }) {
  return prisma.pet.findMany({
    where: { clienteId: clientId, cliente: { organizacaoId: organizationId }, ativo: true },
    orderBy: { nome: "asc" },
    include: { especie: true, raca: true, pesos: { orderBy: { data: "desc" }, take: 1 } },
  });
}

export async function createPet({ clientId, organizationId, data }) {
  await verificarLimiteRecurso(organizationId, "pets");
  const species = await prisma.especie.findFirst({ where: { id: data.especieId, organizacaoId: organizationId, ativo: true } });
  if (!species) throw new Error("ESPECIE_NAO_ENCONTRADA");
  if (data.racaId) {
    const breed = await prisma.raca.findFirst({ where: { id: data.racaId, especieId: data.especieId, ativo: true } });
    if (!breed) throw new Error("RACA_NAO_ENCONTRADA");
  }
  return prisma.pet.create({
    data: {
      clienteId: clientId, especieId: data.especieId, racaId: data.racaId || null, nome: data.nome.trim(), sexo: data.sexo,
      dataNascimento: data.dataNascimento ? dateOnly(data.dataNascimento) : null, castrado: data.castrado ?? null, cor: text(data.cor), fotoUrl: text(data.fotoUrl),
      alergias: text(data.alergias), doencasPreexistentes: text(data.doencasPreexistentes), observacoes: text(data.observacoes),
    },
    include: { especie: true, raca: true },
  });
}

export async function updatePet({ petId, clientId, organizationId, data }) {
  await validatePetOwnership({ petId, clientId, organizationId });
  if (data.especieId) {
    const species = await prisma.especie.findFirst({ where: { id: data.especieId, organizacaoId: organizationId, ativo: true } });
    if (!species) throw new Error("ESPECIE_NAO_ENCONTRADA");
  }
  return prisma.pet.update({
    where: { id: petId },
    data: {
      ...(data.especieId ? { especieId: data.especieId } : {}),
      ...(Object.prototype.hasOwnProperty.call(data, "racaId") ? { racaId: data.racaId || null } : {}),
      ...(data.nome ? { nome: data.nome.trim() } : {}),
      ...(data.sexo ? { sexo: data.sexo } : {}),
      ...(Object.prototype.hasOwnProperty.call(data, "dataNascimento") ? { dataNascimento: data.dataNascimento ? dateOnly(data.dataNascimento) : null } : {}),
      ...(Object.prototype.hasOwnProperty.call(data, "castrado") ? { castrado: data.castrado } : {}),
      ...(Object.prototype.hasOwnProperty.call(data, "cor") ? { cor: text(data.cor) } : {}),
      ...(Object.prototype.hasOwnProperty.call(data, "fotoUrl") ? { fotoUrl: text(data.fotoUrl) } : {}),
      ...(Object.prototype.hasOwnProperty.call(data, "alergias") ? { alergias: text(data.alergias) } : {}),
      ...(Object.prototype.hasOwnProperty.call(data, "doencasPreexistentes") ? { doencasPreexistentes: text(data.doencasPreexistentes) } : {}),
      ...(Object.prototype.hasOwnProperty.call(data, "observacoes") ? { observacoes: text(data.observacoes) } : {}),
    },
    include: { especie: true, raca: true, pesos: { orderBy: { data: "desc" }, take: 1 } },
  });
}

export async function catalogs(organizationId) {
  const [species, breeds] = await Promise.all([
    prisma.especie.findMany({ where: { organizacaoId: organizationId, ativo: true }, orderBy: { nome: "asc" } }),
    prisma.raca.findMany({ where: { especie: { organizacaoId: organizationId }, ativo: true }, orderBy: { nome: "asc" } }),
  ]);
  return { especies: species, racas: breeds };
}

async function companyFor(organizationId, kind) {
  const type = kind === "BANHO_TOSA" ? "BANHO_TOSA" : "LOJA_CONSULTORIO";
  const company = await prisma.empresa.findFirst({ where: { organizacaoId: organizationId, tipo: type, ativo: true }, orderBy: { createdAt: "asc" } });
  if (!company) throw new Error("EMPRESA_NAO_CONFIGURADA");
  return company;
}

export async function services({ organizationId, kind }) {
  const company = await companyFor(organizationId, kind);
  const items = await prisma.itemCatalogo.findMany({
    where: { empresaId: company.id, tipo: "SERVICO", ativo: true, servico: { permiteAgendamento: true } },
    orderBy: { nome: "asc" },
    include: { servico: true, categoria: true },
  });
  return { empresa: { id: company.id, nomeFantasia: company.nomeFantasia, tipo: company.tipo }, itens: items };
}

async function expireReservations(organizationId) {
  const now = new Date();
  const expired = await prisma.agendamentoBanhoTosa.findMany({
    where: { empresa: { organizacaoId: organizationId }, status: "AGUARDANDO_PAGAMENTO", reservaExpiraEm: { lt: now } },
    select: { id: true },
  });
  if (!expired.length) return;
  const ids = expired.map((x) => x.id);
  await prisma.$transaction([
    prisma.agendamentoBanhoTosa.updateMany({ where: { id: { in: ids } }, data: { status: "CANCELADO" } }),
    prisma.transacaoOnline.updateMany({ where: { agendamentoBanhoTosaId: { in: ids }, status: "PENDENTE" }, data: { status: "EXPIRADO" } }),
  ]);
}

export async function blockedIntervals({ organizationId, kind, start, end }) {
  const company = await companyFor(organizationId, kind);
  const from = new Date(start); const to = new Date(end);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) throw new Error("PERIODO_INVALIDO");
  if (kind === "BANHO_TOSA") {
    await expireReservations(organizationId);
    const appointments = await prisma.agendamentoBanhoTosa.findMany({
      where: { empresaId: company.id, inicio: { lt: to }, fim: { gt: from }, status: { notIn: ["CANCELADO", "FALTOU"] } },
      select: { inicio: true, fim: true, status: true },
    });
    const capacity = Math.max(1, await prisma.funcionario.count({ where: { organizacaoId: organizationId, status: { not: "DESLIGADO" }, empresas: { some: { empresaId: company.id, ativo: true } } } }));
    return { empresa: company, capacidade: capacity, bloqueios: appointments };
  }
  const appointments = await prisma.atendimentoClinico.findMany({
    where: { empresaId: company.id, agendadoPara: { lt: to }, agendamentoFim: { gt: from }, status: { in: ["AGUARDANDO", "EM_ATENDIMENTO"] } },
    select: { agendadoPara: true, agendamentoFim: true, status: true },
  });
  return { empresa: company, capacidade: 1, bloqueios: appointments.map((a) => ({ inicio: a.agendadoPara, fim: a.agendamentoFim, status: a.status })) };
}

export async function scheduleClinic({ account, petId, itemCatalogoId, inicio, complaint }) {
  await validatePetOwnership({ petId, clientId: account.clienteId, organizationId: account.organizacaoId });
  const company = await companyFor(account.organizacaoId, "CONSULTORIO");
  const item = await prisma.itemCatalogo.findFirst({ where: { id: itemCatalogoId, empresaId: company.id, tipo: "SERVICO", ativo: true }, include: { servico: true } });
  if (!item?.servico?.permiteAgendamento) throw new Error("SERVICO_INDISPONIVEL");
  const start = new Date(inicio);
  const end = new Date(start.getTime() + Math.max(15, item.servico.duracaoMinutos || 30) * 60_000);
  if (start <= new Date()) throw new Error("HORARIO_INVALIDO");
  const conflict = await prisma.atendimentoClinico.findFirst({ where: { empresaId: company.id, status: { in: ["AGUARDANDO", "EM_ATENDIMENTO"] }, agendadoPara: { lt: end }, agendamentoFim: { gt: start } } });
  if (conflict) throw new Error("HORARIO_INDISPONIVEL");
  return prisma.atendimentoClinico.create({
    data: { empresaId: company.id, clienteId: account.clienteId, petId, itemAgendadoId: item.id, origem: "APP", agendadoPara: start, agendamentoFim: end, queixaPrincipal: text(complaint) },
    include: { pet: true, itemAgendado: true, empresa: true },
  });
}

function configuredProvider() {
  if ((process.env.PAYMENT_PROVIDER || "development").toLowerCase() === "development") {
    return process.env.NODE_ENV === "production" ? "NAO_CONFIGURADO" : "DESENVOLVIMENTO";
  }
  const map = { mercadopago: "MERCADO_PAGO", asaas: "ASAAS", pagseguro: "PAGSEGURO", stripe: "STRIPE" };
  return map[(process.env.PAYMENT_PROVIDER || "").toLowerCase()] || "NAO_CONFIGURADO";
}

export async function scheduleGrooming({ account, petId, itemCatalogoIds, inicio, notes, paymentMethod }) {
  await expireReservations(account.organizacaoId);
  await validatePetOwnership({ petId, clientId: account.clienteId, organizationId: account.organizacaoId });
  const company = await companyFor(account.organizacaoId, "BANHO_TOSA");
  const items = await prisma.itemCatalogo.findMany({
    where: { id: { in: itemCatalogoIds }, empresaId: company.id, tipo: "SERVICO", ativo: true, servico: { permiteAgendamento: true } },
    include: { servico: true },
  });
  if (items.length !== new Set(itemCatalogoIds).size) throw new Error("SERVICO_INDISPONIVEL");
  const start = new Date(inicio);
  const duration = items.reduce((sum, item) => sum + Math.max(15, item.servico?.duracaoMinutos || 60), 0);
  const end = new Date(start.getTime() + duration * 60_000);
  if (start <= new Date()) throw new Error("HORARIO_INVALIDO");

  const capacity = Math.max(1, await prisma.funcionario.count({ where: { organizacaoId: account.organizacaoId, status: { not: "DESLIGADO" }, empresas: { some: { empresaId: company.id, ativo: true } } } }));
  const overlap = await prisma.agendamentoBanhoTosa.count({ where: { empresaId: company.id, inicio: { lt: end }, fim: { gt: start }, status: { notIn: ["CANCELADO", "FALTOU"] } } });
  if (overlap >= capacity) throw new Error("HORARIO_INDISPONIVEL");

  const expiresAt = new Date(Date.now() + RESERVA_MINUTOS * 60_000);
  const total = items.reduce((sum, item) => sum + money(item.precoVenda), 0);
  const provider = configuredProvider();
  if (provider === "NAO_CONFIGURADO") throw new Error("GATEWAY_PAGAMENTO_NAO_CONFIGURADO");
  if (provider !== "DESENVOLVIMENTO") throw new Error("GATEWAY_PAGAMENTO_NAO_IMPLEMENTADO");

  return prisma.$transaction(async (tx) => {
    const appointment = await tx.agendamentoBanhoTosa.create({
      data: {
        empresaId: company.id, clienteId: account.clienteId, petId, inicio: start, fim: end, origem: "APP", status: "AGUARDANDO_PAGAMENTO",
        reservaExpiraEm: expiresAt, observacoesCliente: text(notes),
        itens: { create: items.map((item) => ({ itemCatalogoId: item.id, quantidade: 1, valorUnitario: item.precoVenda })) },
      },
      include: { itens: { include: { itemCatalogo: true } }, pet: true, empresa: true },
    });
    const transaction = await tx.transacaoOnline.create({
      data: {
        organizacaoId: account.organizacaoId, empresaId: company.id, contaClienteId: account.id, clienteId: account.clienteId,
        agendamentoBanhoTosaId: appointment.id, provedor: provider, forma: paymentMethod, valor: total, expiraEm: expiresAt,
        payload: { fase: 10, observacao: provider === "DESENVOLVIMENTO" ? "Simulador local; não representa cobrança real." : "Aguardando integração do provedor." },
      },
    });
    return { appointment, transaction, requiresPayment: true, developmentSimulator: provider === "DESENVOLVIMENTO" };
  }, { maxWait: 10_000, timeout: 30_000 });
}

export async function listAppointments({ account }) {
  await expireReservations(account.organizacaoId);
  const [clinic, grooming] = await Promise.all([
    prisma.atendimentoClinico.findMany({
      where: { clienteId: account.clienteId, empresa: { organizacaoId: account.organizacaoId }, agendadoPara: { not: null } },
      orderBy: { agendadoPara: "desc" }, take: 100,
      include: { pet: true, empresa: true, itemAgendado: true },
    }),
    prisma.agendamentoBanhoTosa.findMany({
      where: { clienteId: account.clienteId, empresa: { organizacaoId: account.organizacaoId } },
      orderBy: { inicio: "desc" }, take: 100,
      include: { pet: true, empresa: true, itens: { include: { itemCatalogo: true } }, ordem: true, transacoes: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  ]);
  return { consultorio: clinic, banhoTosa: grooming };
}

export async function cancelAppointment({ account, type, id }) {
  if (type === "CONSULTORIO") {
    const appointment = await prisma.atendimentoClinico.findFirst({ where: { id, clienteId: account.clienteId, empresa: { organizacaoId: account.organizacaoId } } });
    if (!appointment) throw new Error("AGENDAMENTO_NAO_ENCONTRADO");
    if (["EM_ATENDIMENTO", "FINALIZADO"].includes(appointment.status)) throw new Error("AGENDAMENTO_NAO_CANCELAVEL");
    return prisma.atendimentoClinico.update({ where: { id }, data: { status: "CANCELADO", canceladoEm: new Date() } });
  }
  const appointment = await prisma.agendamentoBanhoTosa.findFirst({ where: { id, clienteId: account.clienteId, empresa: { organizacaoId: account.organizacaoId } }, include: { transacoes: { orderBy: { createdAt: "desc" }, take: 1 }, ordem: true } });
  if (!appointment) throw new Error("AGENDAMENTO_NAO_ENCONTRADO");
  if (appointment.ordem) throw new Error("AGENDAMENTO_NAO_CANCELAVEL");
  if (appointment.transacoes[0]?.status === "APROVADO") throw new Error("CANCELAMENTO_EXIGE_REEMBOLSO");
  return prisma.$transaction(async (tx) => {
    await tx.transacaoOnline.updateMany({ where: { agendamentoBanhoTosaId: id, status: "PENDENTE" }, data: { status: "CANCELADO", canceladoEm: new Date() } });
    return tx.agendamentoBanhoTosa.update({ where: { id }, data: { status: "CANCELADO" } });
  });
}

export async function simulatePayment({ account, transactionId }) {
  if (process.env.NODE_ENV === "production") throw new Error("SIMULADOR_INDISPONIVEL");
  const transaction = await prisma.transacaoOnline.findFirst({ where: { id: transactionId, contaClienteId: account.id, organizacaoId: account.organizacaoId }, include: { agendamentoBanhoTosa: true } });
  if (!transaction) throw new Error("TRANSACAO_NAO_ENCONTRADA");
  if (transaction.provedor !== "DESENVOLVIMENTO") throw new Error("SIMULADOR_INDISPONIVEL");
  if (transaction.status === "APROVADO") return transaction;
  if (transaction.expiraEm && transaction.expiraEm <= new Date()) throw new Error("TRANSACAO_EXPIRADA");
  return prisma.$transaction(async (tx) => {
    const approved = await tx.transacaoOnline.update({ where: { id: transaction.id }, data: { status: "APROVADO", aprovadoEm: new Date(), referenciaExterna: `DEV-${Date.now()}` } });
    if (transaction.agendamentoBanhoTosaId) {
      await tx.agendamentoBanhoTosa.update({ where: { id: transaction.agendamentoBanhoTosaId }, data: { status: "CONFIRMADO", pagamentoConfirmadoEm: new Date(), reservaExpiraEm: null } });
    }
    return approved;
  });
}

export async function petHealth({ account, petId }) {
  await validatePetOwnership({ petId, clientId: account.clienteId, organizationId: account.organizacaoId });
  const [vaccines, worming, documents] = await Promise.all([
    prisma.vacinaAplicacao.findMany({ where: { petId }, orderBy: { aplicadaEm: "desc" }, take: 50 }),
    prisma.vermifugacaoAplicacao.findMany({ where: { petId }, orderBy: { aplicadaEm: "desc" }, take: 50 }),
    prisma.documentoClinico.findMany({ where: { atendimento: { petId, clienteId: account.clienteId }, visivelCliente: true, tipo: { in: ["RECEITA", "ATESTADO", "ORIENTACAO"] } }, orderBy: { emitidoEm: "desc" }, take: 50 }),
  ]);
  return { vacinas: vaccines, vermifugacoes: worming, documentos: documents };
}
