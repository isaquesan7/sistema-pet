import { z } from "zod";

const texto = z.string().trim().optional().nullable();

export const atualizarConfiguracaoSchema = z.object({
  nomeExibicao: texto,
  logoUrl: texto,
  corPrimaria: texto,
  corSecundaria: texto,
  telefone: texto,
  whatsapp: texto,
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  site: texto,
  timezone: z.string().trim().min(1).optional(),
  locale: z.string().trim().min(2).optional(),
  moeda: z.string().trim().length(3).optional(),
});

export const atualizarModuloSchema = z.object({
  habilitado: z.boolean(),
  configuracao: z.record(z.string(), z.unknown()).optional().nullable(),
});
