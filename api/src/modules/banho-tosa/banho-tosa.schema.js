import { z } from "zod";

const decimalPositivo = z
  .union([z.number(), z.string()])
  .transform(Number)
  .refine((v) => Number.isFinite(v) && v > 0, "Informe um valor maior que zero.");

const itemServicoSchema = z.object({
  itemCatalogoId: z.string().min(1),
  quantidade: decimalPositivo.default(1),
  pacoteClienteItemId: z.string().optional().nullable(),
});

export const agendamentoSchema = z.object({
  clienteId: z.string().min(1),
  petId: z.string().min(1),
  profissionalId: z.string().optional().nullable(),
  inicio: z.string().min(1),
  fim: z.string().optional().nullable(),
  origem: z.enum(["APP", "BALCAO", "WHATSAPP", "TELEFONE", "INTERNO"]).optional(),
  status: z.enum(["AGUARDANDO_PAGAMENTO", "PENDENTE", "CONFIRMADO"]).optional(),
  observacoesCliente: z.string().trim().optional().nullable(),
  observacoesInternas: z.string().trim().optional().nullable(),
  itens: z.array(itemServicoSchema.omit({ pacoteClienteItemId: true })).min(1),
});

export const agendamentoAtualizarSchema = z.object({
  profissionalId: z.string().optional().nullable(),
  inicio: z.string().optional(),
  fim: z.string().optional().nullable(),
  status: z.enum(["AGUARDANDO_PAGAMENTO", "PENDENTE", "CONFIRMADO", "CANCELADO", "FALTOU"]).optional(),
  observacoesCliente: z.string().trim().optional().nullable(),
  observacoesInternas: z.string().trim().optional().nullable(),
  itens: z.array(itemServicoSchema.omit({ pacoteClienteItemId: true })).min(1).optional(),
});

export const ordemDiretaSchema = z.object({
  clienteId: z.string().min(1),
  petId: z.string().min(1),
  profissionalId: z.string().optional().nullable(),
  previsaoSaida: z.string().optional().nullable(),
  observacoesEntrada: z.string().trim().optional().nullable(),
  itens: z.array(itemServicoSchema).min(1),
});

export const checkinSchema = z.object({
  profissionalId: z.string().optional().nullable(),
  previsaoSaida: z.string().optional().nullable(),
  observacoesEntrada: z.string().trim().optional().nullable(),
  itens: z.array(itemServicoSchema).optional(),
});

export const statusOrdemSchema = z.object({
  status: z.enum([
    "AGUARDANDO",
    "EM_BANHO",
    "EM_SECAGEM",
    "EM_TOSA",
    "FINALIZADO",
    "AGUARDANDO_RETIRADA",
    "ENTREGUE",
    "CANCELADO",
  ]),
  observacoesSaida: z.string().trim().optional().nullable(),
});

export const fichaSchema = z.object({
  tipoPelagem: z.string().trim().optional().nullable(),
  temperamento: z.string().trim().optional().nullable(),
  aceitaSecador: z.boolean().optional().nullable(),
  aceitaMaquina: z.boolean().optional().nullable(),
  aceitaUnhas: z.boolean().optional().nullable(),
  alergiaProdutos: z.string().trim().optional().nullable(),
  shampooPreferencial: z.string().trim().optional().nullable(),
  restricoes: z.string().trim().optional().nullable(),
  observacoes: z.string().trim().optional().nullable(),
});

export const anexoSchema = z.object({
  tipo: z.enum(["ENTRADA", "ANTES", "DEPOIS", "LESAO", "OBSERVACAO"]),
  url: z.string().url("Informe uma URL válida."),
  legenda: z.string().trim().optional().nullable(),
});
