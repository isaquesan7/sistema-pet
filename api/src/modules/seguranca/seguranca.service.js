import crypto from "node:crypto";
import prisma from "../../config/prisma.js";
import { deleteObject, presignObject, putObject, storageConfigured } from "../../config/storage.js";

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain",
  "application/json", "application/octet-stream",
]);

function safeFilename(name) {
  return String(name || "arquivo").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 100) || "arquivo";
}

function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value, (_k, item) => typeof item === "bigint" ? item.toString() : item));
}

async function assertRefs({ organizacaoId, clienteId, petId }) {
  if (clienteId) {
    const cliente = await prisma.cliente.findFirst({ where: { id: clienteId, organizacaoId } });
    if (!cliente) throw new Error("CLIENTE_NAO_ENCONTRADO");
  }
  if (petId) {
    const pet = await prisma.pet.findFirst({ where: { id: petId, cliente: { organizacaoId } } });
    if (!pet) throw new Error("PET_NAO_ENCONTRADO");
  }
}

export async function uploadArquivo({ organizacaoId, empresaId, usuarioId, data }) {
  if (!storageConfigured()) throw new Error("STORAGE_NAO_CONFIGURADO");
  if (!ALLOWED_MIME.has(data.mimeType)) throw new Error("TIPO_ARQUIVO_NAO_PERMITIDO");
  await assertRefs({ organizacaoId, clienteId: data.clienteId, petId: data.petId });

  let body;
  try { body = Buffer.from(data.base64.replace(/^data:[^;]+;base64,/, ""), "base64"); }
  catch { throw new Error("ARQUIVO_BASE64_INVALIDO"); }
  if (!body.length) throw new Error("ARQUIVO_VAZIO");
  const max = (Number(process.env.STORAGE_MAX_UPLOAD_MB) || 15) * 1024 * 1024;
  if (body.length > max) throw new Error("ARQUIVO_MUITO_GRANDE");

  const id = crypto.randomUUID();
  const key = `org/${organizacaoId}/${data.tipo.toLowerCase()}/${new Date().toISOString().slice(0,10)}/${id}-${safeFilename(data.nomeOriginal)}`;
  const registro = await prisma.arquivoPetRise.create({
    data: {
      id, organizacaoId, empresaId, criadoPorUsuarioId: usuarioId, clienteId: data.clienteId || null,
      petId: data.petId || null, tipo: data.tipo, chave: key, nomeOriginal: data.nomeOriginal,
      mimeType: data.mimeType, tamanhoBytes: BigInt(body.length), metadata: data.metadata || undefined,
    },
  });

  try {
    await putObject({ key, body, contentType: data.mimeType });
    return prisma.arquivoPetRise.update({ where: { id: registro.id }, data: { status: "ATIVO", confirmadoEm: new Date() } });
  } catch (error) {
    await prisma.arquivoPetRise.update({ where: { id: registro.id }, data: { status: "EXCLUIDO", excluidoEm: new Date(), metadata: { ...(data.metadata || {}), uploadError: String(error.message || error) } } });
    throw error;
  }
}

export async function listarArquivos({ organizacaoId, clienteId, petId, tipo, limite = 100 }) {
  return prisma.arquivoPetRise.findMany({
    where: { organizacaoId, status: "ATIVO", ...(clienteId ? { clienteId } : {}), ...(petId ? { petId } : {}), ...(tipo ? { tipo } : {}) },
    orderBy: { createdAt: "desc" }, take: Math.min(Math.max(Number(limite) || 100, 1), 200),
    select: { id: true, tipo: true, nomeOriginal: true, mimeType: true, tamanhoBytes: true, clienteId: true, petId: true, metadata: true, confirmadoEm: true, createdAt: true },
  });
}

export async function urlArquivo({ organizacaoId, id }) {
  const arquivo = await prisma.arquivoPetRise.findFirst({ where: { id, organizacaoId, status: "ATIVO" } });
  if (!arquivo) throw new Error("ARQUIVO_NAO_ENCONTRADO");
  return { arquivo, url: presignObject({ key: arquivo.chave, method: "GET" }) };
}

export async function excluirArquivo({ organizacaoId, id }) {
  const arquivo = await prisma.arquivoPetRise.findFirst({ where: { id, organizacaoId, status: "ATIVO" } });
  if (!arquivo) throw new Error("ARQUIVO_NAO_ENCONTRADO");
  await deleteObject(arquivo.chave);
  return prisma.arquivoPetRise.update({ where: { id }, data: { status: "EXCLUIDO", excluidoEm: new Date() } });
}

export async function listarAuditoria({ organizacaoId, empresaId, busca, limite = 100 }) {
  return prisma.auditoria.findMany({
    where: {
      organizacaoId,
      ...(empresaId ? { empresaId } : {}),
      ...(busca ? { OR: [
        { acao: { contains: busca, mode: "insensitive" } },
        { entidade: { contains: busca, mode: "insensitive" } },
        { entidadeId: { contains: busca, mode: "insensitive" } },
        { usuario: { nome: { contains: busca, mode: "insensitive" } } },
      ] } : {}),
    },
    orderBy: { createdAt: "desc" }, take: Math.min(Math.max(Number(limite) || 100, 1), 300),
    include: { usuario: { select: { id: true, nome: true, email: true } }, empresa: { select: { id: true, nomeFantasia: true } } },
  });
}

async function clienteCompleto(organizacaoId, clienteId) {
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, organizacaoId },
    include: {
      conta: { select: { id: true, email: true, telefone: true, status: true, emailVerificado: true, telefoneVerificado: true, createdAt: true, ultimoAcesso: true } },
      pets: { include: {
        especie: true, raca: true, pesos: true, vacinasAplicadas: true, vermifugacoes: true,
        atendimentosClinicos: { include: { prescricoes: { include: { itens: true } }, exames: true, procedimentos: true, documentos: true } },
        agendamentosBanhoTosa: true, ordensBanhoTosa: { include: { itens: true, anexos: true } },
      } },
      vendas: { include: { itens: true, pagamentos: true } },
      pacotesCliente: { include: { itens: true } },
      titulosFinanceiros: true,
      transacoesOnline: true,
    },
  });
  if (!cliente) throw new Error("CLIENTE_NAO_ENCONTRADO");
  return cliente;
}

export async function exportarCliente({ organizacaoId, empresaId, usuarioId, clienteId, motivo }) {
  if (!storageConfigured()) throw new Error("STORAGE_NAO_CONFIGURADO");
  const solicitacao = await prisma.solicitacaoLGPD.create({ data: { organizacaoId, clienteId, solicitadoPorUsuarioId: usuarioId, tipo: "EXPORTACAO", status: "PROCESSANDO", motivo: motivo || null } });
  try {
    const cliente = await clienteCompleto(organizacaoId, clienteId);
    const payload = { geradoEm: new Date().toISOString(), organizacaoId, titular: jsonSafe(cliente) };
    const body = Buffer.from(JSON.stringify(payload, null, 2), "utf8");
    const id = crypto.randomUUID();
    const key = `org/${organizacaoId}/exportacao-lgpd/${clienteId}/${id}.json`;
    await putObject({ key, body, contentType: "application/json" });
    const arquivo = await prisma.arquivoPetRise.create({ data: {
      id, organizacaoId, empresaId, criadoPorUsuarioId: usuarioId, clienteId, tipo: "EXPORTACAO_LGPD", status: "ATIVO",
      chave: key, nomeOriginal: `exportacao-lgpd-${clienteId}.json`, mimeType: "application/json", tamanhoBytes: BigInt(body.length), confirmadoEm: new Date(),
      metadata: { solicitacaoId: solicitacao.id },
    } });
    const done = await prisma.solicitacaoLGPD.update({ where: { id: solicitacao.id }, data: { status: "CONCLUIDA", exportArquivoId: arquivo.id, processadoEm: new Date(), resultado: { registros: 1, formato: "json" } } });
    return { solicitacao: done, arquivo, url: presignObject({ key, method: "GET", expiresIn: 900 }) };
  } catch (error) {
    await prisma.solicitacaoLGPD.update({ where: { id: solicitacao.id }, data: { status: "ERRO", erro: String(error.message || error), processadoEm: new Date() } });
    throw error;
  }
}

export async function anonimizarCliente({ organizacaoId, usuarioId, clienteId, motivo }) {
  const cliente = await prisma.cliente.findFirst({ where: { id: clienteId, organizacaoId }, include: { conta: true } });
  if (!cliente) throw new Error("CLIENTE_NAO_ENCONTRADO");
  const solicitacao = await prisma.solicitacaoLGPD.create({ data: { organizacaoId, clienteId, solicitadoPorUsuarioId: usuarioId, tipo: "ANONIMIZACAO", status: "PROCESSANDO", motivo: motivo || null } });
  try {
    const token = cliente.id.slice(-8).toUpperCase();
    await prisma.$transaction(async (tx) => {
      if (cliente.conta) {
        await tx.sessaoCliente.updateMany({ where: { contaClienteId: cliente.conta.id, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.contaCliente.update({ where: { id: cliente.conta.id }, data: { email: null, telefone: null, status: "INATIVA", emailVerificado: false, telefoneVerificado: false } });
      }
      await tx.cliente.update({ where: { id: clienteId }, data: {
        nome: `Titular anonimizado ${token}`, cpfCnpj: null, telefone: null, whatsapp: null, email: null, dataNascimento: null,
        cep: null, logradouro: null, numero: null, complemento: null, bairro: null, cidade: null, estado: null,
        observacoes: "Dados pessoais anonimizados por processo LGPD. Históricos operacionais, clínicos, financeiros e fiscais foram preservados.", ativo: false,
      } });
    }, { maxWait: 10000, timeout: 30000 });
    return prisma.solicitacaoLGPD.update({ where: { id: solicitacao.id }, data: { status: "CONCLUIDA", processadoEm: new Date(), resultado: { preservacao: ["clinico", "financeiro", "fiscal", "estoque", "banho_tosa"] } } });
  } catch (error) {
    await prisma.solicitacaoLGPD.update({ where: { id: solicitacao.id }, data: { status: "ERRO", erro: String(error.message || error), processadoEm: new Date() } });
    throw error;
  }
}

export async function listarSolicitacoes({ organizacaoId, limite = 100 }) {
  return prisma.solicitacaoLGPD.findMany({
    where: { organizacaoId }, orderBy: { createdAt: "desc" }, take: Math.min(Math.max(Number(limite) || 100, 1), 200),
    include: { cliente: { select: { id: true, nome: true } }, solicitadoPor: { select: { id: true, nome: true } }, exportArquivo: { select: { id: true, nomeOriginal: true, status: true } } },
  });
}
