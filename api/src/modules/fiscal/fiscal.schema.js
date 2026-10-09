import { z } from "zod";

const optionalText = (max = 180) => z.string().trim().max(max).optional().nullable();
const optionalCode = (max = 30) => z.string().trim().max(max).optional().nullable();
const optionalPercent = z.union([z.number(), z.string()]).transform(Number).refine((value) => Number.isFinite(value) && value >= 0 && value <= 100, "Alíquota inválida.").optional().nullable();

export const configuracaoEmpresaSchema = z.object({
  regime: z.enum(["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL", "MEI", "OUTRO"]),
  ambiente: z.enum(["HOMOLOGACAO", "PRODUCAO"]),
  provedorFiscal: optionalCode(80),
  provedorContaReferencia: optionalCode(160),
  serieNfe: optionalCode(20),
  serieNfce: optionalCode(20),
  serieNfse: optionalCode(20),
  tipoDocumentoPadrao: z.enum(["NFCE", "NFE", "NFSE", "RECIBO"]).optional().nullable(),
  emissaoAutomaticaVenda: z.boolean().optional(),
  naturezaOperacaoPadrao: optionalText(160),
  codigoMunicipioIbge: z.string().trim().regex(/^\d{7}$/, "Código IBGE deve possuir 7 dígitos.").optional().nullable().or(z.literal("")),
  certificadoReferencia: optionalText(240),
  certificadoValidoAte: z.string().optional().nullable().or(z.literal("")),
});

export const configuracaoItemSchema = z.object({
  ncm: z.string().trim().regex(/^\d{8}$/, "NCM deve possuir 8 dígitos.").optional().nullable().or(z.literal("")),
  cest: z.string().trim().regex(/^\d{7}$/, "CEST deve possuir 7 dígitos.").optional().nullable().or(z.literal("")),
  cfop: z.string().trim().regex(/^\d{4}$/, "CFOP deve possuir 4 dígitos.").optional().nullable().or(z.literal("")),
  origemMercadoria: z.string().trim().regex(/^\d$/, "Origem deve possuir 1 dígito.").optional().nullable().or(z.literal("")),
  cstCsosn: optionalCode(4),
  codigoServicoMunicipal: optionalCode(40),
  aliquotaIcms: optionalPercent,
  aliquotaIss: optionalPercent,
});

export const criarDocumentoSchema = z.object({
  vendaId: z.string().min(1),
  tipo: z.enum(["NFCE", "NFE", "NFSE", "RECIBO"]),
  processarAgora: z.boolean().optional().default(false),
});

export const cancelarDocumentoSchema = z.object({
  motivo: z.string().trim().min(5).max(500),
});
