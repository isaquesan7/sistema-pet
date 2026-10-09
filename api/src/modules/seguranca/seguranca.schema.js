import { z } from "zod";

const tiposArquivo = ["LOGO", "FOTO_PET", "BANHO_TOSA", "CLINICO", "DOCUMENTO", "EXPORTACAO_LGPD", "OUTRO"];

export const uploadArquivoSchema = z.object({
  tipo: z.enum(tiposArquivo).default("OUTRO"),
  nomeOriginal: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().min(3).max(120),
  base64: z.string().min(4),
  clienteId: z.string().trim().optional().nullable(),
  petId: z.string().trim().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const anonimizarClienteSchema = z.object({
  confirmacao: z.literal("ANONIMIZAR"),
  motivo: z.string().trim().max(1000).optional().nullable(),
});

export const exportarClienteSchema = z.object({
  motivo: z.string().trim().max(1000).optional().nullable(),
});
