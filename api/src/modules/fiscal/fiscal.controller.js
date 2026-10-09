import * as service from "./fiscal.service.js";
import {
  configuracaoEmpresaSchema,
  configuracaoItemSchema,
  criarDocumentoSchema,
  cancelarDocumentoSchema,
} from "./fiscal.schema.js";

function parse(schema, body, res) {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Dados inválidos.",
      errors: result.error.flatten().fieldErrors,
    });
    return null;
  }
  return result.data;
}

function mapError(error, res, next) {
  const errors = {
    ITEM_NAO_ENCONTRADO: [404, "Item não encontrado neste CNPJ."],
    VENDA_NAO_ENCONTRADA: [404, "Venda não encontrada neste CNPJ."],
    VENDA_NAO_FINALIZADA: [409, "Somente vendas finalizadas podem gerar documento fiscal."],
    DOCUMENTO_NAO_ENCONTRADO: [404, "Documento fiscal não encontrado."],
    DOCUMENTO_DUPLICADO: [409, "Já existe um documento deste tipo para esta venda. Cancele ou reutilize o documento existente."],
    DOCUMENTO_NAO_PROCESSAVEL: [409, "Este documento não pode ser processado no status atual."],
    DOCUMENTO_NAO_CANCELAVEL: [409, "Este documento não pode ser cancelado no status atual."],
    DOCUMENTO_SEM_ITENS_COMPATIVEIS: [409, "A venda não possui itens compatíveis com o tipo de documento selecionado."],
    CONFIGURACAO_FISCAL_INCOMPLETA: [409, "A configuração fiscal do CNPJ está incompleta."],
    ITEM_FISCAL_INCOMPLETO: [409, "Há itens sem configuração fiscal obrigatória para este documento."],
    PROVEDOR_NAO_CONFIGURADO: [409, "Configure um provedor fiscal antes de enviar NF-e, NFC-e ou NFS-e."],
    PROVEDOR_NAO_IMPLEMENTADO: [409, "O provedor selecionado ainda não possui adaptador ativo no PetRise. Use homologação com o provedor 'development' ou conecte um provedor homologado."],
    SIMULADOR_PROIBIDO_PRODUCAO: [409, "O simulador fiscal não pode ser usado em ambiente de produção."],
    CANCELAMENTO_PROVEDOR_NAO_IMPLEMENTADO: [409, "O cancelamento deste documento precisa ser enviado ao provedor fiscal antes de ser concluído no PetRise."],
  };
  const mapped = errors[error.message];
  if (mapped) return res.status(mapped[0]).json({ success: false, message: mapped[1], detalhes: error.detalhes || undefined });
  return next(error);
}

export async function resumo(req, res, next) {
  try {
    return res.json({ success: true, resumo: await service.obterResumo({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id }) });
  } catch (error) { next(error); }
}

export async function configuracao(req, res, next) {
  try {
    return res.json({ success: true, configuracao: await service.obterConfiguracao(req.empresa.id) });
  } catch (error) { next(error); }
}

export async function salvarConfiguracao(req, res, next) {
  try {
    const dados = parse(configuracaoEmpresaSchema, req.body, res); if (!dados) return;
    const configuracao = await service.salvarConfiguracao({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, usuarioId: req.usuario.id, dados });
    return res.json({ success: true, configuracao });
  } catch (error) { mapError(error, res, next); }
}

export async function itens(req, res, next) {
  try {
    return res.json({ success: true, dados: await service.listarItens({ empresaId: req.empresa.id, busca: req.query.busca?.trim(), tipo: req.query.tipo, pendente: req.query.pendente === "true" }) });
  } catch (error) { next(error); }
}

export async function salvarItem(req, res, next) {
  try {
    const dados = parse(configuracaoItemSchema, req.body, res); if (!dados) return;
    const item = await service.salvarConfiguracaoItem({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, usuarioId: req.usuario.id, itemId: req.params.id, dados });
    return res.json({ success: true, item });
  } catch (error) { mapError(error, res, next); }
}

export async function vendas(req, res, next) {
  try {
    return res.json({ success: true, dados: await service.listarVendas({ empresaId: req.empresa.id, busca: req.query.busca?.trim(), limite: req.query.limite }) });
  } catch (error) { next(error); }
}

export async function validarVenda(req, res, next) {
  try {
    return res.json({ success: true, validacao: await service.validarVendaParaDocumento({ empresaId: req.empresa.id, vendaId: req.params.id, tipo: req.query.tipo || "RECIBO" }) });
  } catch (error) { mapError(error, res, next); }
}

export async function documentos(req, res, next) {
  try {
    return res.json({ success: true, dados: await service.listarDocumentos({ empresaId: req.empresa.id, status: req.query.status, tipo: req.query.tipo, busca: req.query.busca?.trim(), limite: req.query.limite }) });
  } catch (error) { next(error); }
}

export async function documento(req, res, next) {
  try {
    return res.json({ success: true, documento: await service.buscarDocumento({ empresaId: req.empresa.id, id: req.params.id }) });
  } catch (error) { mapError(error, res, next); }
}

export async function criarDocumento(req, res, next) {
  try {
    const dados = parse(criarDocumentoSchema, req.body, res); if (!dados) return;
    let documento = await service.criarDocumento({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, usuarioId: req.usuario.id, vendaId: dados.vendaId, tipo: dados.tipo });
    if (dados.processarAgora) documento = await service.processarDocumento({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, usuarioId: req.usuario.id, id: documento.id });
    return res.status(201).json({ success: true, documento });
  } catch (error) { mapError(error, res, next); }
}

export async function processarDocumento(req, res, next) {
  try {
    return res.json({ success: true, documento: await service.processarDocumento({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, usuarioId: req.usuario.id, id: req.params.id }) });
  } catch (error) { mapError(error, res, next); }
}

export async function cancelarDocumento(req, res, next) {
  try {
    const dados = parse(cancelarDocumentoSchema, req.body, res); if (!dados) return;
    return res.json({ success: true, documento: await service.cancelarDocumento({ empresaId: req.empresa.id, organizacaoId: req.organizacao.id, usuarioId: req.usuario.id, id: req.params.id, motivo: dados.motivo }) });
  } catch (error) { mapError(error, res, next); }
}
