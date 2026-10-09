import * as service from "./saas.service.js";
import { onboardingSchema, gerarFaturaSchema, planoSchema, atualizarAssinaturaPlataformaSchema, faturaManualSchema } from "./saas.schema.js";

function validation(res, parsed) {
  if (parsed.success) return false;
  res.status(400).json({ success: false, message: "Dados inválidos.", errors: parsed.error.flatten().fieldErrors });
  return true;
}

function businessError(res, error) {
  const messages = {
    CNPJ_INVALIDO: "Informe um CNPJ válido com 14 dígitos.",
    EMAIL_JA_CADASTRADO: "Este e-mail já possui uma conta no PetRise.",
    CNPJ_JA_CADASTRADO: "Este CNPJ já está cadastrado no PetRise.",
    PLANO_NAO_ENCONTRADO: "Plano não encontrado ou indisponível.",
    PLATAFORMA_NAO_INICIALIZADA: "As permissões da plataforma ainda não foram inicializadas. Execute o seed.",
    ASSINATURA_NAO_ENCONTRADA: "Assinatura não encontrada.",
    FATURA_NAO_ENCONTRADA: "Fatura não encontrada.",
    FATURA_NAO_PENDENTE: "Esta fatura não está pendente de pagamento.",
    FATURA_JA_PAGA: "Uma fatura paga não pode ser cancelada desta forma.",
    SIMULACAO_INDISPONIVEL: "A simulação de cobrança só fica disponível com SAAS_BILLING_PROVIDER=development.",
  };
  if (messages[error?.message]) {
    res.status(400).json({ success: false, message: messages[error.message], code: error.message });
    return true;
  }
  return false;
}

export async function planosPublicos(req, res, next) {
  try { return res.json({ success: true, dados: await service.listarPlanos({ somenteAtivos: true }) }); } catch (e) { next(e); }
}

export async function onboarding(req, res, next) {
  try {
    const parsed = onboardingSchema.safeParse(req.body);
    if (validation(res, parsed)) return;
    const dados = await service.criarOnboarding(parsed.data, { ip: req.ip, userAgent: req.get("user-agent") });
    return res.status(201).json({ success: true, message: "Sua conta PetRise foi criada.", dados });
  } catch (e) { if (!businessError(res, e)) next(e); }
}

export async function minhaAssinatura(req, res, next) {
  try { return res.json({ success: true, assinatura: await service.obterAssinaturaOrganizacao(req.organizacao.id), billingDevelopment: process.env.SAAS_BILLING_PROVIDER === "development" && process.env.NODE_ENV !== "production" }); } catch (e) { next(e); }
}

export async function gerarFatura(req, res, next) {
  try {
    const parsed = gerarFaturaSchema.safeParse(req.body || {});
    if (validation(res, parsed)) return;
    const fatura = await service.gerarFaturaOrganizacao({ organizacaoId: req.organizacao.id, ...parsed.data });
    return res.status(201).json({ success: true, fatura });
  } catch (e) { if (!businessError(res, e)) next(e); }
}

export async function simularPagamento(req, res, next) {
  try {
    await service.simularPagamentoTenant(req.organizacao.id, req.params.id, req.usuario.id);
    return res.json({ success: true, message: "Pagamento de desenvolvimento aprovado." });
  } catch (e) { if (!businessError(res, e)) next(e); }
}

export async function painelPlataforma(req, res, next) {
  try { return res.json({ success: true, dados: await service.dashboardPlataforma() }); } catch (e) { next(e); }
}

export async function organizacoesPlataforma(req, res, next) {
  try { return res.json({ success: true, dados: await service.listarOrganizacoesPlataforma({ busca: String(req.query.busca || ""), status: String(req.query.status || "") }) }); } catch (e) { next(e); }
}

export async function planosPlataforma(req, res, next) {
  try { return res.json({ success: true, dados: await service.listarPlanos({ somenteAtivos: false }) }); } catch (e) { next(e); }
}

export async function criarPlano(req, res, next) {
  try { const parsed = planoSchema.safeParse(req.body); if (validation(res, parsed)) return; return res.status(201).json({ success: true, plano: await service.salvarPlano(parsed.data) }); } catch (e) { if (!businessError(res, e)) next(e); }
}

export async function atualizarPlano(req, res, next) {
  try { const parsed = planoSchema.safeParse(req.body); if (validation(res, parsed)) return; return res.json({ success: true, plano: await service.salvarPlano(parsed.data, req.params.id) }); } catch (e) { if (!businessError(res, e)) next(e); }
}

export async function atualizarAssinatura(req, res, next) {
  try { const parsed = atualizarAssinaturaPlataformaSchema.safeParse(req.body); if (validation(res, parsed)) return; return res.json({ success: true, assinatura: await service.atualizarAssinaturaPlataforma(req.params.organizacaoId, parsed.data, req.usuario.id) }); } catch (e) { if (!businessError(res, e)) next(e); }
}

export async function faturasPlataforma(req, res, next) {
  try { return res.json({ success: true, dados: await service.listarFaturasPlataforma({ status: String(req.query.status || "") }) }); } catch (e) { next(e); }
}

export async function criarFaturaManual(req, res, next) {
  try { const parsed = faturaManualSchema.safeParse(req.body); if (validation(res, parsed)) return; return res.status(201).json({ success: true, fatura: await service.criarFaturaManualPlataforma(parsed.data) }); } catch (e) { if (!businessError(res, e)) next(e); }
}

export async function liquidarFatura(req, res, next) {
  try { await service.liquidarFaturaPlataforma(req.params.id, req.usuario.id); return res.json({ success: true }); } catch (e) { if (!businessError(res, e)) next(e); }
}

export async function cancelarFatura(req, res, next) {
  try { await service.cancelarFaturaPlataforma(req.params.id, req.usuario.id); return res.json({ success: true }); } catch (e) { if (!businessError(res, e)) next(e); }
}
