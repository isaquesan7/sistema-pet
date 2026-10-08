import { z } from "zod";

const positive = z.union([z.number(), z.string()]).transform(Number).refine((v) => Number.isFinite(v) && v > 0, "Valor deve ser maior que zero.");
const nonNegative = z.union([z.number(), z.string()]).transform(Number).refine((v) => Number.isFinite(v) && v >= 0, "Valor inválido.");
const textOptional = z.string().trim().optional().nullable();

export const fornecedorSchema = z.object({
  razaoSocial: textOptional,
  nomeFantasia: z.string().trim().min(2).max(160),
  cpfCnpj: textOptional,
  telefone: textOptional,
  whatsapp: textOptional,
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  cep: textOptional,
  logradouro: textOptional,
  numero: textOptional,
  complemento: textOptional,
  bairro: textOptional,
  cidade: textOptional,
  estado: textOptional,
  observacoes: textOptional,
  ativo: z.boolean().optional(),
});

export const entradaSchema = z.object({
  fornecedorId: z.string().optional().nullable(),
  numeroDocumento: textOptional,
  dataEntrada: z.string().optional().nullable(),
  observacao: textOptional,
  itens: z.array(z.object({
    itemCatalogoId: z.string().min(1),
    quantidade: positive,
    custoUnitario: nonNegative,
    numeroLote: textOptional,
    dataFabricacao: z.string().optional().nullable(),
    dataValidade: z.string().optional().nullable(),
  })).min(1),
});

export const ajusteSchema = z.object({
  itemCatalogoId: z.string().min(1),
  tipo: z.enum(["AJUSTE_POSITIVO", "AJUSTE_NEGATIVO", "PERDA", "CONSUMO_INTERNO", "DEVOLUCAO_CLIENTE", "DEVOLUCAO_FORNECEDOR"]),
  quantidade: positive,
  loteId: z.string().optional().nullable(),
  observacao: z.string().trim().min(3).max(500),
});

export const inventarioSchema = z.object({
  descricao: textOptional,
  observacao: textOptional,
});

export const contagemSchema = z.object({ quantidadeContada: nonNegative });

export const cancelarEntradaSchema = z.object({ motivo: z.string().trim().min(3).max(500) });
