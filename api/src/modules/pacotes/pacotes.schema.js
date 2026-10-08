import { z } from "zod";

const decimalPositivo = z
  .union([z.number(), z.string()])
  .transform(Number)
  .refine((v) => Number.isFinite(v) && v > 0, "Informe um valor maior que zero.");

const itemPacoteSchema = z.object({
  itemCatalogoId: z.string().min(1),
  quantidade: decimalPositivo,
});

export const pacoteModeloSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  descricao: z.string().trim().optional().nullable(),
  tipo: z.enum(["FIXO", "TEMPORARIO"]).default("FIXO"),
  valorPacote: decimalPositivo,
  validadeDias: z.number().int().positive().optional().nullable(),
  inicioVigencia: z.string().optional().nullable(),
  fimVigencia: z.string().optional().nullable(),
  visivelPortal: z.boolean().optional(),
  ativo: z.boolean().optional(),
  itens: z.array(itemPacoteSchema).min(1),
});

export const pacoteModeloAtualizarSchema = pacoteModeloSchema.partial();

export const pacoteClienteSchema = z.object({
  modeloId: z.string().optional().nullable(),
  clienteId: z.string().min(1),
  petId: z.string().optional().nullable(),
  nome: z.string().trim().min(2).max(160).optional(),
  valorPacote: decimalPositivo.optional(),
  inicioValidade: z.string().min(1, "Informe a data inicial."),
  fimValidade: z.string().optional().nullable(),
  observacoes: z.string().trim().optional().nullable(),
  itens: z.array(itemPacoteSchema).optional(),
});

export const consumoSchema = z.object({
  quantidade: decimalPositivo,
  petId: z.string().optional().nullable(),
  origemTipo: z.string().trim().optional().nullable(),
  origemId: z.string().trim().optional().nullable(),
  observacao: z.string().trim().optional().nullable(),
});
