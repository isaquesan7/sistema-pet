import { registrarAuditoria } from "../../utils/auditoria.js";
import { anonimizarClienteSchema, exportarClienteSchema, uploadArquivoSchema } from "./seguranca.schema.js";
import * as service from "./seguranca.service.js";

function fail(error, res, next) {
  const map = {
    CLIENTE_NAO_ENCONTRADO: [404, "Cliente não encontrado."], PET_NAO_ENCONTRADO: [404, "Pet não encontrado."],
    ARQUIVO_NAO_ENCONTRADO: [404, "Arquivo não encontrado."], STORAGE_NAO_CONFIGURADO: [503, "Armazenamento de arquivos não configurado."],
    TIPO_ARQUIVO_NAO_PERMITIDO: [400, "Tipo de arquivo não permitido."], ARQUIVO_BASE64_INVALIDO: [400, "Conteúdo do arquivo inválido."],
    ARQUIVO_VAZIO: [400, "O arquivo está vazio."], ARQUIVO_MUITO_GRANDE: [413, "Arquivo maior que o limite permitido."],
  };
  const exact = map[error?.message];
  if (exact) return res.status(exact[0]).json({ success: false, message: exact[1] });
  if (String(error?.message || "").startsWith("STORAGE_")) return res.status(502).json({ success: false, message: "Falha ao acessar o armazenamento de arquivos." });
  next(error);
}

export async function upload(req, res, next) {
  try {
    const parsed = uploadArquivoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Dados de arquivo inválidos.", errors: parsed.error.flatten().fieldErrors });
    const arquivo = await service.uploadArquivo({ organizacaoId: req.organizacao.id, empresaId: req.empresa.id, usuarioId: req.usuario.id, data: parsed.data });
    await registrarAuditoria({ organizacaoId: req.organizacao.id, empresaId: req.empresa.id, usuarioId: req.usuario.id, acao: "ARQUIVO_UPLOAD", entidade: "ArquivoPetRise", entidadeId: arquivo.id, dadosNovos: { tipo: arquivo.tipo, nomeOriginal: arquivo.nomeOriginal, tamanhoBytes: String(arquivo.tamanhoBytes || "") }, ip: req.ip });
    return res.status(201).json({ success: true, arquivo: { ...arquivo, tamanhoBytes: arquivo.tamanhoBytes?.toString() || null } });
  } catch (error) { fail(error, res, next); }
}

export async function listarArquivos(req, res, next) {
  try {
    const dados = await service.listarArquivos({ organizacaoId: req.organizacao.id, clienteId: req.query.clienteId, petId: req.query.petId, tipo: req.query.tipo, limite: req.query.limite });
    return res.json({ success: true, dados: dados.map((x) => ({ ...x, tamanhoBytes: x.tamanhoBytes?.toString() || null })) });
  } catch (error) { fail(error, res, next); }
}

export async function obterUrl(req, res, next) {
  try { const dados = await service.urlArquivo({ organizacaoId: req.organizacao.id, id: req.params.id }); return res.json({ success: true, url: dados.url, expiraEmSegundos: Number(process.env.STORAGE_SIGNED_URL_TTL_SECONDS) || 300 }); }
  catch (error) { fail(error, res, next); }
}

export async function excluir(req, res, next) {
  try {
    const arquivo = await service.excluirArquivo({ organizacaoId: req.organizacao.id, id: req.params.id });
    await registrarAuditoria({ organizacaoId: req.organizacao.id, empresaId: req.empresa.id, usuarioId: req.usuario.id, acao: "ARQUIVO_EXCLUIR", entidade: "ArquivoPetRise", entidadeId: arquivo.id, ip: req.ip });
    return res.json({ success: true, message: "Arquivo excluído." });
  } catch (error) { fail(error, res, next); }
}

export async function auditoria(req, res, next) {
  try { const dados = await service.listarAuditoria({ organizacaoId: req.organizacao.id, empresaId: req.query.empresa === "atual" ? req.empresa.id : undefined, busca: String(req.query.busca || "").trim(), limite: req.query.limite }); return res.json({ success: true, dados }); }
  catch (error) { next(error); }
}

export async function solicitacoesLGPD(req, res, next) {
  try { return res.json({ success: true, dados: await service.listarSolicitacoes({ organizacaoId: req.organizacao.id, limite: req.query.limite }) }); }
  catch (error) { next(error); }
}

export async function exportarLGPD(req, res, next) {
  try {
    const parsed = exportarClienteSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ success: false, message: "Dados inválidos." });
    const resultado = await service.exportarCliente({ organizacaoId: req.organizacao.id, empresaId: req.empresa.id, usuarioId: req.usuario.id, clienteId: req.params.clienteId, motivo: parsed.data.motivo });
    await registrarAuditoria({ organizacaoId: req.organizacao.id, empresaId: req.empresa.id, usuarioId: req.usuario.id, acao: "LGPD_EXPORTAR", entidade: "Cliente", entidadeId: req.params.clienteId, dadosNovos: { solicitacaoId: resultado.solicitacao.id }, ip: req.ip });
    return res.status(201).json({ success: true, ...resultado, arquivo: { ...resultado.arquivo, tamanhoBytes: resultado.arquivo.tamanhoBytes?.toString() || null } });
  } catch (error) { fail(error, res, next); }
}

export async function anonimizarLGPD(req, res, next) {
  try {
    const parsed = anonimizarClienteSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Para confirmar, envie confirmacao: "ANONIMIZAR".' });
    const solicitacao = await service.anonimizarCliente({ organizacaoId: req.organizacao.id, usuarioId: req.usuario.id, clienteId: req.params.clienteId, motivo: parsed.data.motivo });
    await registrarAuditoria({ organizacaoId: req.organizacao.id, empresaId: req.empresa.id, usuarioId: req.usuario.id, acao: "LGPD_ANONIMIZAR", entidade: "Cliente", entidadeId: req.params.clienteId, dadosNovos: { solicitacaoId: solicitacao.id }, ip: req.ip });
    return res.json({ success: true, message: "Dados pessoais anonimizados. Históricos obrigatórios foram preservados.", solicitacao });
  } catch (error) { fail(error, res, next); }
}
