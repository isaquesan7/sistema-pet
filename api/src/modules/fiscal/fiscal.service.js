import prisma from "../../config/prisma.js";

function n(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  return Math.round((n(value) + Number.EPSILON) * 100) / 100;
}

function clean(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isoDate(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function auditar(tx, { organizacaoId, empresaId, usuarioId, acao, entidade, entidadeId, dadosNovos }) {
  return tx.auditoria.create({
    data: {
      organizacaoId,
      empresaId,
      usuarioId,
      acao,
      entidade,
      entidadeId,
      dadosNovos: dadosNovos || undefined,
    },
  });
}

const vendaInclude = {
  empresa: true,
  cliente: true,
  itens: {
    include: {
      itemCatalogo: {
        include: {
          produto: true,
          servico: true,
          fiscalConfig: true,
        },
      },
      pet: { select: { id: true, nome: true } },
    },
  },
  pagamentos: true,
  documentosFiscais: { orderBy: { createdAt: "desc" } },
};

function itemKind(item) {
  return item?.itemCatalogo?.tipo || null;
}

function compatibleWithType(item, tipo) {
  if (tipo === "RECIBO") return true;
  if (tipo === "NFSE") return itemKind(item) === "SERVICO";
  if (["NFE", "NFCE"].includes(tipo)) return itemKind(item) === "PRODUTO";
  return false;
}

function documentSeries(config, tipo) {
  if (tipo === "NFE") return config?.serieNfe || null;
  if (tipo === "NFCE") return config?.serieNfce || null;
  if (tipo === "NFSE") return config?.serieNfse || null;
  return "INT";
}

function fiscalItemIssues(vendaItem, tipo) {
  const issues = [];
  const item = vendaItem.itemCatalogo;
  if (tipo === "RECIBO") return issues;
  if (!item) {
    issues.push(`O item “${vendaItem.descricao}” não está vinculado ao catálogo fiscal.`);
    return issues;
  }
  const fiscal = item.fiscalConfig;
  if (!fiscal) {
    issues.push(`“${item.nome}” não possui configuração fiscal.`);
    return issues;
  }
  if (["NFE", "NFCE"].includes(tipo)) {
    if (!fiscal.ncm) issues.push(`Informe o NCM de “${item.nome}”.`);
    if (!fiscal.cfop) issues.push(`Informe o CFOP de “${item.nome}”.`);
    if (!fiscal.origemMercadoria) issues.push(`Informe a origem da mercadoria de “${item.nome}”.`);
    if (!fiscal.cstCsosn) issues.push(`Informe CST/CSOSN de “${item.nome}”.`);
  }
  if (tipo === "NFSE") {
    if (!fiscal.codigoServicoMunicipal) issues.push(`Informe o código de serviço municipal de “${item.nome}”.`);
  }
  return issues;
}

function companyIssues(empresa, config, tipo) {
  const issues = [];
  const warnings = [];
  if (tipo === "RECIBO") return { issues, warnings };
  if (onlyDigits(empresa.cnpj).length !== 14) issues.push("O CNPJ da empresa está inválido ou incompleto.");
  if (!empresa.razaoSocial) issues.push("Informe a razão social da empresa.");
  if (!empresa.cidade || !empresa.estado) issues.push("Complete cidade e UF no cadastro da empresa.");
  if (!config) {
    issues.push("Crie a configuração fiscal deste CNPJ.");
    return { issues, warnings };
  }
  if (config.regime === "OUTRO") warnings.push("Revise o regime tributário antes de emitir em produção.");
  if (["NFE", "NFCE"].includes(tipo) && !documentSeries(config, tipo)) issues.push(`Informe a série de ${tipo === "NFE" ? "NF-e" : "NFC-e"}.`);
  if (tipo === "NFSE" && !config.codigoMunicipioIbge) issues.push("Informe o código IBGE do município para NFS-e.");
  if (!config.provedorFiscal) warnings.push("Nenhum provedor fiscal está configurado; o documento poderá ser preparado, mas não enviado.");
  if (config.certificadoValidoAte) {
    const expiration = new Date(config.certificadoValidoAte);
    const inThirtyDays = new Date(); inThirtyDays.setDate(inThirtyDays.getDate() + 30);
    if (expiration < new Date()) issues.push("O certificado fiscal informado está vencido.");
    else if (expiration < inThirtyDays) warnings.push("O certificado fiscal vence em menos de 30 dias.");
  }
  return { issues, warnings };
}

function saleCompatibleItems(venda, tipo) {
  return venda.itens.filter((item) => compatibleWithType(item, tipo));
}

function allocatedTotal(venda, items) {
  const saleSubtotal = n(venda.subtotal) || venda.itens.reduce((sum, item) => sum + n(item.valorTotal), 0);
  const subsetSubtotal = items.reduce((sum, item) => sum + n(item.valorTotal), 0);
  if (saleSubtotal <= 0) return money(subsetSubtotal);
  const ratio = subsetSubtotal / saleSubtotal;
  const globalAdjustment = n(venda.acrescimo) - n(venda.desconto);
  return money(subsetSubtotal + globalAdjustment * ratio);
}

function snapshotRecipient(cliente) {
  if (!cliente) return null;
  return {
    id: cliente.id,
    nome: cliente.nome,
    cpfCnpj: cliente.cpfCnpj || null,
    email: cliente.email || null,
    telefone: cliente.telefone || cliente.whatsapp || null,
    endereco: {
      cep: cliente.cep || null,
      logradouro: cliente.logradouro || null,
      numero: cliente.numero || null,
      complemento: cliente.complemento || null,
      bairro: cliente.bairro || null,
      cidade: cliente.cidade || null,
      estado: cliente.estado || null,
    },
  };
}

function snapshotItems(items) {
  return items.map((line) => {
    const item = line.itemCatalogo;
    const fiscal = item?.fiscalConfig;
    return {
      vendaItemId: line.id,
      itemCatalogoId: item?.id || null,
      tipo: item?.tipo || null,
      descricao: line.descricao,
      quantidade: n(line.quantidade),
      valorUnitario: money(line.valorUnitario),
      desconto: money(line.desconto),
      valorTotal: money(line.valorTotal),
      pet: line.pet || null,
      fiscal: fiscal ? {
        ncm: fiscal.ncm || null,
        cest: fiscal.cest || null,
        cfop: fiscal.cfop || null,
        origemMercadoria: fiscal.origemMercadoria || null,
        cstCsosn: fiscal.cstCsosn || null,
        codigoServicoMunicipal: fiscal.codigoServicoMunicipal || null,
        aliquotaIcms: fiscal.aliquotaIcms === null ? null : n(fiscal.aliquotaIcms),
        aliquotaIss: fiscal.aliquotaIss === null ? null : n(fiscal.aliquotaIss),
      } : null,
    };
  });
}

function snapshotPayments(payments) {
  return payments.map((payment) => ({
    id: payment.id,
    forma: payment.forma,
    status: payment.status,
    valor: money(payment.valor),
    parcelas: payment.parcelas || 1,
  }));
}

async function fetchSale(empresaId, vendaId) {
  const venda = await prisma.venda.findFirst({ where: { id: vendaId, empresaId }, include: vendaInclude });
  if (!venda) throw new Error("VENDA_NAO_ENCONTRADA");
  return venda;
}

export async function obterConfiguracao(empresaId) {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, include: { configuracaoFiscal: true } });
  if (!empresa) return null;
  return {
    empresa: {
      id: empresa.id,
      razaoSocial: empresa.razaoSocial,
      nomeFantasia: empresa.nomeFantasia,
      cnpj: empresa.cnpj,
      inscricaoEstadual: empresa.inscricaoEstadual,
      inscricaoMunicipal: empresa.inscricaoMunicipal,
      cidade: empresa.cidade,
      estado: empresa.estado,
    },
    ...(empresa.configuracaoFiscal || {
      empresaId,
      regime: "OUTRO",
      ambiente: "HOMOLOGACAO",
      provedorFiscal: null,
      provedorContaReferencia: null,
      serieNfe: null,
      serieNfce: null,
      serieNfse: null,
      tipoDocumentoPadrao: null,
      emissaoAutomaticaVenda: false,
      naturezaOperacaoPadrao: null,
      codigoMunicipioIbge: null,
      certificadoReferencia: null,
      certificadoValidoAte: null,
    }),
  };
}

export async function salvarConfiguracao({ empresaId, organizacaoId, usuarioId, dados }) {
  const payload = {
    regime: dados.regime,
    ambiente: dados.ambiente,
    provedorFiscal: clean(dados.provedorFiscal),
    provedorContaReferencia: clean(dados.provedorContaReferencia),
    serieNfe: clean(dados.serieNfe),
    serieNfce: clean(dados.serieNfce),
    serieNfse: clean(dados.serieNfse),
    tipoDocumentoPadrao: dados.tipoDocumentoPadrao || null,
    emissaoAutomaticaVenda: Boolean(dados.emissaoAutomaticaVenda),
    naturezaOperacaoPadrao: clean(dados.naturezaOperacaoPadrao),
    codigoMunicipioIbge: clean(dados.codigoMunicipioIbge),
    certificadoReferencia: clean(dados.certificadoReferencia),
    certificadoValidoAte: isoDate(dados.certificadoValidoAte),
  };
  return prisma.$transaction(async (tx) => {
    const config = await tx.configuracaoFiscalEmpresa.upsert({
      where: { empresaId },
      update: payload,
      create: { empresaId, ...payload },
    });
    await auditar(tx, { organizacaoId, empresaId, usuarioId, acao: "CONFIGURAR", entidade: "CONFIGURACAO_FISCAL", entidadeId: config.id, dadosNovos: { ...payload, certificadoReferencia: payload.certificadoReferencia ? "[CONFIGURADO]" : null } });
    return config;
  });
}

function itemFiscalReady(item) {
  const fiscal = item.fiscalConfig;
  if (item.tipo === "PRODUTO") return Boolean(fiscal?.ncm && fiscal?.cfop && fiscal?.origemMercadoria && fiscal?.cstCsosn);
  if (item.tipo === "SERVICO") return Boolean(fiscal?.codigoServicoMunicipal);
  return false;
}

export async function listarItens({ empresaId, busca, tipo, pendente }) {
  const items = await prisma.itemCatalogo.findMany({
    where: {
      empresaId,
      ...(tipo ? { tipo } : {}),
      ...(busca ? { OR: [
        { nome: { contains: busca, mode: "insensitive" } },
        { codigoInterno: { contains: busca, mode: "insensitive" } },
        { codigoBarras: { contains: busca } },
      ] } : {}),
    },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    include: { fiscalConfig: true, produto: true, servico: true, categoria: true },
  });
  const decorated = items.map((item) => ({ ...item, fiscalPronto: itemFiscalReady(item) }));
  return pendente ? decorated.filter((item) => !item.fiscalPronto) : decorated;
}

export async function salvarConfiguracaoItem({ empresaId, organizacaoId, usuarioId, itemId, dados }) {
  const item = await prisma.itemCatalogo.findFirst({ where: { id: itemId, empresaId } });
  if (!item) throw new Error("ITEM_NAO_ENCONTRADO");
  const payload = {
    ncm: clean(dados.ncm),
    cest: clean(dados.cest),
    cfop: clean(dados.cfop),
    origemMercadoria: clean(dados.origemMercadoria),
    cstCsosn: clean(dados.cstCsosn),
    codigoServicoMunicipal: clean(dados.codigoServicoMunicipal),
    aliquotaIcms: dados.aliquotaIcms === undefined || dados.aliquotaIcms === null ? null : n(dados.aliquotaIcms),
    aliquotaIss: dados.aliquotaIss === undefined || dados.aliquotaIss === null ? null : n(dados.aliquotaIss),
  };
  return prisma.$transaction(async (tx) => {
    await tx.configuracaoFiscalItem.upsert({
      where: { itemCatalogoId: itemId },
      update: payload,
      create: { itemCatalogoId: itemId, ...payload },
    });
    await auditar(tx, { organizacaoId, empresaId, usuarioId, acao: "CONFIGURAR", entidade: "CONFIGURACAO_FISCAL_ITEM", entidadeId: itemId, dadosNovos: payload });
    return tx.itemCatalogo.findUnique({ where: { id: itemId }, include: { fiscalConfig: true, produto: true, servico: true, categoria: true } });
  });
}

export async function validarVendaParaDocumento({ empresaId, vendaId, tipo }) {
  const venda = await fetchSale(empresaId, vendaId);
  if (venda.status !== "FINALIZADA") throw new Error("VENDA_NAO_FINALIZADA");
  const config = await prisma.configuracaoFiscalEmpresa.findUnique({ where: { empresaId } });
  const items = saleCompatibleItems(venda, tipo);
  const issues = [];
  const warnings = [];
  if (!items.length) issues.push("A venda não possui itens compatíveis com este tipo de documento.");
  const company = companyIssues(venda.empresa, config, tipo);
  issues.push(...company.issues);
  warnings.push(...company.warnings);
  for (const item of items) issues.push(...fiscalItemIssues(item, tipo));
  const incompatible = venda.itens.filter((item) => !compatibleWithType(item, tipo));
  if (incompatible.length && tipo !== "RECIBO") warnings.push(`${incompatible.length} item(ns) de outro tipo não farão parte deste documento.`);
  return {
    ok: issues.length === 0,
    tipo,
    issues: [...new Set(issues)],
    warnings: [...new Set(warnings)],
    itensCompativeis: items.length,
    itensIgnorados: incompatible.length,
    valorDocumento: allocatedTotal(venda, items),
    ambiente: config?.ambiente || "HOMOLOGACAO",
    provedor: config?.provedorFiscal || null,
  };
}

async function buildDocumentSnapshot(empresaId, vendaId, tipo) {
  const venda = await fetchSale(empresaId, vendaId);
  if (venda.status !== "FINALIZADA") throw new Error("VENDA_NAO_FINALIZADA");
  const items = saleCompatibleItems(venda, tipo);
  if (!items.length) throw new Error("DOCUMENTO_SEM_ITENS_COMPATIVEIS");
  const config = await prisma.configuracaoFiscalEmpresa.findUnique({ where: { empresaId } });
  return {
    venda,
    config,
    items,
    valorTotal: allocatedTotal(venda, items),
    destinatario: snapshotRecipient(venda.cliente),
    itens: snapshotItems(items),
    pagamentos: snapshotPayments(venda.pagamentos),
  };
}

export async function criarDocumento({ empresaId, organizacaoId, usuarioId, vendaId, tipo }) {
  const tiposConflitantes = ["NFE", "NFCE"].includes(tipo) ? ["NFE", "NFCE"] : [tipo];
  const existing = await prisma.documentoFiscal.findFirst({
    where: { empresaId, vendaId, tipo: { in: tiposConflitantes }, status: { not: "CANCELADO" } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) throw new Error("DOCUMENTO_DUPLICADO");
  const snapshot = await buildDocumentSnapshot(empresaId, vendaId, tipo);
  return prisma.$transaction(async (tx) => {
    const documento = await tx.documentoFiscal.create({
      data: {
        empresaId,
        vendaId,
        usuarioId,
        tipo,
        status: "PENDENTE",
        ambiente: snapshot.config?.ambiente || "HOMOLOGACAO",
        serie: documentSeries(snapshot.config, tipo),
        valorTotal: snapshot.valorTotal,
        destinatarioSnapshot: snapshot.destinatario || undefined,
        itensSnapshot: snapshot.itens,
        pagamentosSnapshot: snapshot.pagamentos,
      },
    });
    await auditar(tx, { organizacaoId, empresaId, usuarioId, acao: "CRIAR", entidade: "DOCUMENTO_FISCAL", entidadeId: documento.id, dadosNovos: { tipo, vendaId, valorTotal: snapshot.valorTotal, ambiente: documento.ambiente } });
    return documento;
  });
}

function providerName(config) {
  return String(config?.provedorFiscal || "").trim().toLowerCase();
}

function buildProviderPayload(snapshot, tipo, config) {
  return {
    schema: "petrise-fiscal-v1",
    ambiente: config?.ambiente || "HOMOLOGACAO",
    tipo,
    naturezaOperacao: config?.naturezaOperacaoPadrao || (tipo === "NFSE" ? "Prestação de serviços" : "Venda de mercadorias"),
    emitente: {
      razaoSocial: snapshot.venda.empresa.razaoSocial,
      nomeFantasia: snapshot.venda.empresa.nomeFantasia,
      cnpj: onlyDigits(snapshot.venda.empresa.cnpj),
      inscricaoEstadual: snapshot.venda.empresa.inscricaoEstadual || null,
      inscricaoMunicipal: snapshot.venda.empresa.inscricaoMunicipal || null,
      endereco: {
        cep: snapshot.venda.empresa.cep || null,
        logradouro: snapshot.venda.empresa.logradouro || null,
        numero: snapshot.venda.empresa.numero || null,
        complemento: snapshot.venda.empresa.complemento || null,
        bairro: snapshot.venda.empresa.bairro || null,
        cidade: snapshot.venda.empresa.cidade || null,
        estado: snapshot.venda.empresa.estado || null,
        codigoMunicipioIbge: config?.codigoMunicipioIbge || null,
      },
    },
    destinatario: snapshot.destinatario,
    itens: snapshot.itens,
    pagamentos: snapshot.pagamentos,
    valorTotal: snapshot.valorTotal,
    referencia: { vendaId: snapshot.venda.id, vendaNumero: snapshot.venda.numero },
  };
}

export async function processarDocumento({ empresaId, organizacaoId, usuarioId, id }) {
  const documento = await prisma.documentoFiscal.findFirst({ where: { id, empresaId } });
  if (!documento) throw new Error("DOCUMENTO_NAO_ENCONTRADO");
  if (!["PENDENTE", "ERRO", "REJEITADO"].includes(documento.status)) throw new Error("DOCUMENTO_NAO_PROCESSAVEL");
  const snapshot = await buildDocumentSnapshot(empresaId, documento.vendaId, documento.tipo);
  const validacao = await validarVendaParaDocumento({ empresaId, vendaId: documento.vendaId, tipo: documento.tipo });
  if (!validacao.ok) {
    const error = new Error(documento.tipo === "RECIBO" ? "CONFIGURACAO_FISCAL_INCOMPLETA" : "ITEM_FISCAL_INCOMPLETO");
    error.detalhes = validacao;
    throw error;
  }
  const config = snapshot.config;
  const payload = buildProviderPayload(snapshot, documento.tipo, config);
  const now = new Date();

  if (documento.tipo === "RECIBO") {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.documentoFiscal.update({
        where: { id },
        data: {
          status: "AUTORIZADO",
          ambiente: config?.ambiente || "HOMOLOGACAO",
          simulado: false,
          numero: `REC-${snapshot.venda.numero}`,
          serie: "INT",
          valorTotal: snapshot.valorTotal,
          protocolo: `INT-${Date.now()}`,
          provedorReferencia: "PETRISE-RECIBO",
          destinatarioSnapshot: snapshot.destinatario || undefined,
          itensSnapshot: snapshot.itens,
          pagamentosSnapshot: snapshot.pagamentos,
          payloadEnvio: payload,
          respostaProvedor: { tipo: "RECIBO_INTERNO", aviso: "Recibo interno. Não substitui documento fiscal exigido pela legislação." },
          tentativas: { increment: 1 },
          ultimaTentativaEm: now,
          mensagemErro: null,
          emitidoEm: now,
        },
      });
      await auditar(tx, { organizacaoId, empresaId, usuarioId, acao: "EMITIR", entidade: "DOCUMENTO_FISCAL", entidadeId: id, dadosNovos: { tipo: documento.tipo, status: "AUTORIZADO", interno: true } });
      return updated;
    });
  }

  if (!config) throw new Error("CONFIGURACAO_FISCAL_INCOMPLETA");
  const provider = providerName(config);
  if (!provider) throw new Error("PROVEDOR_NAO_CONFIGURADO");
  if (["development", "simulador", "mock"].includes(provider)) {
    if (config.ambiente === "PRODUCAO") throw new Error("SIMULADOR_PROIBIDO_PRODUCAO");
    const simulatedReference = `SIM-${documento.tipo}-${snapshot.venda.numero}-${Date.now()}`;
    return prisma.$transaction(async (tx) => {
      const updated = await tx.documentoFiscal.update({
        where: { id },
        data: {
          status: "AUTORIZADO",
          ambiente: "HOMOLOGACAO",
          simulado: true,
          numero: `HOM-${snapshot.venda.numero}`,
          serie: documentSeries(config, documento.tipo) || "HOM",
          chave: null,
          valorTotal: snapshot.valorTotal,
          protocolo: simulatedReference,
          provedorReferencia: simulatedReference,
          destinatarioSnapshot: snapshot.destinatario || undefined,
          itensSnapshot: snapshot.itens,
          pagamentosSnapshot: snapshot.pagamentos,
          payloadEnvio: payload,
          respostaProvedor: { simulated: true, status: "AUTORIZADO", message: "Documento simulado em homologação. Não possui validade fiscal." },
          tentativas: { increment: 1 },
          ultimaTentativaEm: now,
          mensagemErro: null,
          emitidoEm: now,
        },
      });
      await auditar(tx, { organizacaoId, empresaId, usuarioId, acao: "EMITIR", entidade: "DOCUMENTO_FISCAL", entidadeId: id, dadosNovos: { tipo: documento.tipo, status: "AUTORIZADO", simulado: true } });
      return updated;
    });
  }

  await prisma.documentoFiscal.update({
    where: { id },
    data: {
      status: "ERRO",
      ambiente: config.ambiente,
      payloadEnvio: payload,
      tentativas: { increment: 1 },
      ultimaTentativaEm: now,
      mensagemErro: `Adaptador do provedor “${config.provedorFiscal}” ainda não está conectado.`,
    },
  });
  throw new Error("PROVEDOR_NAO_IMPLEMENTADO");
}

export async function cancelarDocumento({ empresaId, organizacaoId, usuarioId, id, motivo }) {
  const documento = await prisma.documentoFiscal.findFirst({ where: { id, empresaId } });
  if (!documento) throw new Error("DOCUMENTO_NAO_ENCONTRADO");
  if (!["PENDENTE", "ERRO", "REJEITADO", "AUTORIZADO"].includes(documento.status)) throw new Error("DOCUMENTO_NAO_CANCELAVEL");
  if (documento.status === "AUTORIZADO" && !documento.simulado && documento.tipo !== "RECIBO") {
    throw new Error("CANCELAMENTO_PROVEDOR_NAO_IMPLEMENTADO");
  }
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const updated = await tx.documentoFiscal.update({
      where: { id },
      data: {
        status: "CANCELADO",
        canceladoEm: now,
        motivoCancelamento: motivo,
        cancelamentoProtocolo: documento.simulado || documento.tipo === "RECIBO" ? `CANC-${Date.now()}` : null,
      },
    });
    await auditar(tx, { organizacaoId, empresaId, usuarioId, acao: "CANCELAR", entidade: "DOCUMENTO_FISCAL", entidadeId: id, dadosNovos: { motivo, tipo: documento.tipo } });
    return updated;
  });
}

export async function listarDocumentos({ empresaId, status, tipo, busca, limite = 100 }) {
  return prisma.documentoFiscal.findMany({
    where: {
      empresaId,
      ...(status ? { status } : {}),
      ...(tipo ? { tipo } : {}),
      ...(busca ? { OR: [
        { numero: { contains: busca, mode: "insensitive" } },
        { chave: { contains: busca } },
        { venda: { cliente: { nome: { contains: busca, mode: "insensitive" } } } },
      ] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Number(limite) || 100, 300),
    include: {
      venda: { select: { id: true, numero: true, valorTotal: true, finalizadaEm: true, cliente: { select: { id: true, nome: true, cpfCnpj: true } } } },
    },
  });
}

export async function buscarDocumento({ empresaId, id }) {
  const document = await prisma.documentoFiscal.findFirst({
    where: { id, empresaId },
    include: { venda: { include: { cliente: true, itens: true, pagamentos: true } }, empresa: true },
  });
  if (!document) throw new Error("DOCUMENTO_NAO_ENCONTRADO");
  return document;
}

export async function listarVendas({ empresaId, busca, limite = 100 }) {
  const vendas = await prisma.venda.findMany({
    where: {
      empresaId,
      status: "FINALIZADA",
      ...(busca ? { OR: [
        { cliente: { nome: { contains: busca, mode: "insensitive" } } },
        { itens: { some: { descricao: { contains: busca, mode: "insensitive" } } } },
      ] } : {}),
    },
    orderBy: { finalizadaEm: "desc" },
    take: Math.min(Number(limite) || 100, 300),
    include: {
      cliente: { select: { id: true, nome: true, cpfCnpj: true } },
      itens: { include: { itemCatalogo: { select: { id: true, tipo: true } } } },
      documentosFiscais: { orderBy: { createdAt: "desc" } },
    },
  });
  return vendas.map((venda) => {
    const hasProducts = venda.itens.some((item) => item.itemCatalogo?.tipo === "PRODUTO");
    const hasServices = venda.itens.some((item) => item.itemCatalogo?.tipo === "SERVICO");
    const tiposPossiveis = ["RECIBO", ...(hasProducts ? ["NFCE", "NFE"] : []), ...(hasServices ? ["NFSE"] : [])];
    return { ...venda, tiposPossiveis };
  });
}

export async function obterResumo({ empresaId }) {
  const [config, totalItems, items, docs, pendingSales] = await Promise.all([
    prisma.configuracaoFiscalEmpresa.findUnique({ where: { empresaId } }),
    prisma.itemCatalogo.count({ where: { empresaId, ativo: true } }),
    prisma.itemCatalogo.findMany({ where: { empresaId, ativo: true }, include: { fiscalConfig: true } }),
    prisma.documentoFiscal.groupBy({ by: ["status"], where: { empresaId }, _count: { _all: true } }),
    prisma.venda.count({ where: { empresaId, status: "FINALIZADA", documentosFiscais: { none: { status: { not: "CANCELADO" } } } } }),
  ]);
  const countByStatus = Object.fromEntries(docs.map((row) => [row.status, row._count._all]));
  const configuredItems = items.filter(itemFiscalReady).length;
  return {
    configurado: Boolean(config),
    ambiente: config?.ambiente || "HOMOLOGACAO",
    provedor: config?.provedorFiscal || null,
    emissaoAutomaticaVenda: Boolean(config?.emissaoAutomaticaVenda),
    tipoDocumentoPadrao: config?.tipoDocumentoPadrao || null,
    itens: { total: totalItems, configurados: configuredItems, pendentes: Math.max(0, totalItems - configuredItems) },
    documentos: {
      autorizados: countByStatus.AUTORIZADO || 0,
      pendentes: countByStatus.PENDENTE || 0,
      erros: (countByStatus.ERRO || 0) + (countByStatus.REJEITADO || 0),
      cancelados: countByStatus.CANCELADO || 0,
    },
    vendasSemDocumento: pendingSales,
  };
}

export async function criarDocumentoAutomaticoVenda({ empresaId, organizacaoId, usuarioId, vendaId }) {
  try {
    const config = await prisma.configuracaoFiscalEmpresa.findUnique({ where: { empresaId } });
    if (!config?.emissaoAutomaticaVenda || !config.tipoDocumentoPadrao) return null;
    const tiposConflitantes = ["NFE", "NFCE"].includes(config.tipoDocumentoPadrao) ? ["NFE", "NFCE"] : [config.tipoDocumentoPadrao];
    const existing = await prisma.documentoFiscal.findFirst({ where: { empresaId, vendaId, tipo: { in: tiposConflitantes }, status: { not: "CANCELADO" } } });
    if (existing) return existing;
    return await criarDocumento({ empresaId, organizacaoId, usuarioId, vendaId, tipo: config.tipoDocumentoPadrao });
  } catch (error) {
    console.warn("PetRise: não foi possível criar o documento fiscal automático da venda.", { vendaId, empresaId, code: error.message });
    return null;
  }
}
