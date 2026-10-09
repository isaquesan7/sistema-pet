import { z } from "zod";

const money = z.union([z.number(), z.string()]).transform(Number).refine(Number.isFinite, "Valor inválido.");
const positive = money.refine((value) => value > 0, "Valor deve ser maior que zero.");
const nonNegative = money.refine((value) => value >= 0, "Valor não pode ser negativo.");
const optionalText = z.string().trim().max(1000).optional().nullable();
const optionalId = z.string().trim().optional().nullable();
const optionalDate = z.string().trim().optional().nullable();

export const categoriaSchema = z.object({
  nome: z.string().trim().min(2).max(80),
  tipo: z.enum(["RECEITA", "DESPESA", "AMBOS"]).default("AMBOS"),
  ativo: z.boolean().optional(),
});

export const contaSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  tipo: z.enum(["DINHEIRO", "BANCO", "CARTEIRA_DIGITAL", "OUTRO"]).default("BANCO"),
  saldoInicial: money.default(0),
  ativo: z.boolean().optional(),
});

export const tituloSchema = z.object({
  tipo: z.enum(["RECEBER", "PAGAR"]),
  categoriaId: optionalId,
  clienteId: optionalId,
  fornecedorId: optionalId,
  entradaEstoqueId: optionalId,
  descricao: z.string().trim().min(2).max(180),
  documento: z.string().trim().max(80).optional().nullable(),
  competencia: optionalDate,
  vencimentoEm: optionalDate,
  valorOriginal: positive,
  parcelas: z.coerce.number().int().min(1).max(60).default(1),
  observacoes: optionalText,
});

export const tituloUpdateSchema = z.object({
  categoriaId: optionalId,
  clienteId: optionalId,
  fornecedorId: optionalId,
  descricao: z.string().trim().min(2).max(180).optional(),
  documento: z.string().trim().max(80).optional().nullable(),
  competencia: optionalDate,
  vencimentoEm: optionalDate,
  valorOriginal: positive.optional(),
  observacoes: optionalText,
});

export const baixaSchema = z.object({
  valor: positive,
  desconto: nonNegative.default(0),
  juros: nonNegative.default(0),
  forma: z.enum(["DINHEIRO", "PIX", "CARTAO_DEBITO", "CARTAO_CREDITO", "TRANSFERENCIA", "OUTRO"]),
  contaFinanceiraId: optionalId,
  pagoEm: optionalDate,
  usarCaixaAberto: z.boolean().default(true),
  observacoes: optionalText,
});

export const cancelarTituloSchema = z.object({
  motivo: z.string().trim().min(3).max(250),
});

export const conciliacaoSchema = z.object({
  origem: z.enum(["PAGAMENTO_VENDA", "BAIXA_TITULO", "TRANSACAO_ONLINE"]),
  origemId: z.string().min(1),
  contaFinanceiraId: z.string().min(1),
});
