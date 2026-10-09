import { z } from "zod";

const tiposEmpresa = ["LOJA_CONSULTORIO", "BANHO_TOSA", "OUTRA"];
const ciclos = ["MENSAL", "ANUAL"];
const statusAssinatura = ["TRIAL", "ATIVA", "INADIMPLENTE", "SUSPENSA", "CANCELADA"];
const modulos = ["PDV", "ESTOQUE", "CONSULTORIO", "BANHO_TOSA", "FINANCEIRO", "PORTAL_CLIENTE", "PONTO", "FISCAL", "RELATORIOS"];

const opcionalInteiro = z.union([z.number().int().positive(), z.null()]).optional();

export const onboardingSchema = z.object({
  planoSlug: z.string().trim().min(2).max(80),
  ciclo: z.enum(ciclos).default("MENSAL"),
  organizacao: z.object({
    nome: z.string().trim().min(2).max(120),
    telefone: z.string().trim().max(30).optional().nullable(),
    whatsapp: z.string().trim().max(30).optional().nullable(),
  }),
  empresa: z.object({
    nomeFantasia: z.string().trim().min(2).max(120),
    razaoSocial: z.string().trim().min(2).max(160),
    cnpj: z.string().trim().min(14).max(24),
    tipo: z.enum(tiposEmpresa).default("LOJA_CONSULTORIO"),
    telefone: z.string().trim().max(30).optional().nullable(),
    email: z.string().trim().email().optional().nullable().or(z.literal("")),
  }),
  administrador: z.object({
    nome: z.string().trim().min(2).max(120),
    email: z.string().trim().email(),
    senha: z.string().min(8).max(128),
    telefone: z.string().trim().max(30).optional().nullable(),
  }),
});

export const gerarFaturaSchema = z.object({
  planoId: z.string().trim().min(1).optional(),
  ciclo: z.enum(ciclos).optional(),
});

export const planoSchema = z.object({
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
  nome: z.string().trim().min(2).max(100),
  descricao: z.string().trim().max(1500).optional().nullable(),
  precoMensal: z.coerce.number().min(0),
  precoAnual: z.coerce.number().min(0),
  trialDias: z.coerce.number().int().min(0).max(365),
  limiteEmpresas: opcionalInteiro,
  limiteUsuarios: opcionalInteiro,
  limiteClientes: opcionalInteiro,
  limitePets: opcionalInteiro,
  limiteFuncionarios: opcionalInteiro,
  ativo: z.boolean().default(true),
  destaque: z.boolean().default(false),
  ordem: z.coerce.number().int().min(0).max(9999).default(0),
  modulos: z.array(z.enum(modulos)).min(1),
});

export const atualizarAssinaturaPlataformaSchema = z.object({
  planoId: z.string().trim().min(1).optional(),
  status: z.enum(statusAssinatura).optional(),
  ciclo: z.enum(ciclos).optional(),
  trialFimEm: z.string().datetime().optional().nullable(),
  proximaCobrancaEm: z.string().datetime().optional().nullable(),
  observacoesInternas: z.string().trim().max(5000).optional().nullable(),
});

export const faturaManualSchema = z.object({
  organizacaoId: z.string().trim().min(1),
  valor: z.coerce.number().positive(),
  vencimento: z.string().min(10),
  descricao: z.string().trim().max(500).optional().nullable(),
  planoDestinoId: z.string().trim().min(1).optional().nullable(),
  ciclo: z.enum(ciclos).default("MENSAL"),
});
