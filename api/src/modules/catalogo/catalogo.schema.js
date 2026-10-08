import { z } from "zod";

const decimal = z.union([z.number(), z.string()]).transform(Number);
const textoOpcional = z.string().trim().optional().nullable();

export const categoriaSchema = z.object({
  tipo: z.enum(["PRODUTO", "SERVICO"]),
  nome: z.string().trim().min(2).max(120),
  descricao: textoOpcional,
  parentId: z.string().optional().nullable(),
  ordem: z.number().int().min(0).optional(),
  ativo: z.boolean().optional(),
});

export const categoriaAtualizarSchema = categoriaSchema.partial();

const produtoSchema = z.object({
  unidade: z.enum([
    "UNIDADE",
    "QUILOGRAMA",
    "GRAMA",
    "LITRO",
    "MILILITRO",
    "PACOTE",
    "CAIXA",
  ]).optional(),
  marca: textoOpcional,
  estoqueMinimo: decimal.optional(),
  controlaEstoque: z.boolean().optional(),
  controlaLote: z.boolean().optional(),
  controlaValidade: z.boolean().optional(),
}).optional();

const servicoSchema = z.object({
  duracaoMinutos: z.number().int().positive().optional().nullable(),
  geraComissao: z.boolean().optional(),
  percentualComissao: decimal.optional().nullable(),
  permiteAgendamento: z.boolean().optional(),
  exigePet: z.boolean().optional(),
  exigeProfissional: z.boolean().optional(),
}).optional();

export const itemSchema = z
  .object({
    tipo: z.enum(["PRODUTO", "SERVICO"]),
    categoriaId: z.string().optional().nullable(),
    nome: z.string().trim().min(2).max(180),
    descricao: textoOpcional,
    codigoInterno: textoOpcional,
    codigoBarras: textoOpcional,
    custoReferencia: decimal.default(0),
    precoVenda: decimal.optional(),
    markupPercentual: decimal.optional(),
    ativo: z.boolean().optional(),
    produto: produtoSchema,
    servico: servicoSchema,
  })
  .refine((dados) => dados.precoVenda !== undefined || dados.markupPercentual !== undefined, {
    message: "Informe o preço de venda ou o markup percentual.",
    path: ["precoVenda"],
  });

export const itemAtualizarSchema = z.object({
  categoriaId: z.string().optional().nullable(),
  nome: z.string().trim().min(2).max(180).optional(),
  descricao: textoOpcional,
  codigoInterno: textoOpcional,
  codigoBarras: textoOpcional,
  custoReferencia: decimal.optional(),
  precoVenda: decimal.optional(),
  markupPercentual: decimal.optional(),
  ativo: z.boolean().optional(),
  produto: produtoSchema,
  servico: servicoSchema,
});

export const calculoPrecoSchema = z.object({
  custo: decimal,
  precoVenda: decimal.optional(),
  markupPercentual: decimal.optional(),
});
