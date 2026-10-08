import { z } from "zod";

const money = z.union([z.number(), z.string()]).transform(Number).refine(Number.isFinite, "Valor inválido.");
const positive = z.union([z.number(), z.string()]).transform(Number).refine((value) => Number.isFinite(value) && value > 0, "Valor deve ser maior que zero.");
const nonNegative = z.union([z.number(), z.string()]).transform(Number).refine((value) => Number.isFinite(value) && value >= 0, "Valor não pode ser negativo.");
const textOptional = z.string().trim().optional().nullable();

export const caixaSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  descricao: textOptional,
});

export const abrirCaixaSchema = z.object({
  valorAbertura: nonNegative.default(0),
  observacoes: textOptional,
});

export const fecharCaixaSchema = z.object({
  valorFechamento: nonNegative,
  observacoes: textOptional,
});

export const movimentacaoCaixaSchema = z.object({
  tipo: z.enum(["SUPRIMENTO", "SANGRIA"]),
  valor: positive,
  descricao: z.string().trim().min(2).max(180),
});

const itemVendaSchema = z.object({
  itemCatalogoId: z.string().min(1),
  petId: z.string().optional().nullable(),
  quantidade: positive.default(1),
  desconto: nonNegative.default(0),
});

const pagamentoSchema = z.object({
  forma: z.enum([
    "DINHEIRO",
    "PIX",
    "CARTAO_DEBITO",
    "CARTAO_CREDITO",
    "TRANSFERENCIA",
    "CREDITO_CLIENTE",
    "OUTRO",
  ]),
  valor: positive,
  parcelas: z.number().int().min(1).max(36).optional().nullable(),
  transacaoExternaId: textOptional,
  codigoAutorizacao: textOptional,
  observacoes: textOptional,
});

export const vendaSchema = z.object({
  clienteId: z.string().optional().nullable(),
  sessaoCaixaId: z.string().min(1),
  itens: z.array(itemVendaSchema).min(1),
  pagamentos: z.array(pagamentoSchema).min(1),
  desconto: nonNegative.default(0),
  acrescimo: nonNegative.default(0),
  observacoes: textOptional,
});

export const comandaSchema = z.object({
  clienteId: z.string().min(1),
  observacoes: textOptional,
});

export const comandaItemSchema = itemVendaSchema;

export const fecharComandaSchema = z.object({
  sessaoCaixaId: z.string().min(1),
  pagamentos: z.array(pagamentoSchema).min(1),
  desconto: nonNegative.default(0),
  acrescimo: nonNegative.default(0),
  observacoes: textOptional,
});

export const cancelarVendaSchema = z.object({
  motivo: z.string().trim().min(3).max(250),
});

export const receberPacoteSchema = z.object({
  sessaoCaixaId: z.string().min(1),
  pagamentos: z.array(pagamentoSchema).min(1),
});
