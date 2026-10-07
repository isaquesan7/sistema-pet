import { z } from "zod";

const textoOpcional = z
  .string()
  .trim()
  .optional()
  .nullable();

export const criarClienteSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Nome deve possuir pelo menos 2 caracteres.")
    .max(150),

  cpfCnpj: textoOpcional,

  telefone: textoOpcional,
  whatsapp: textoOpcional,

  email: z
    .string()
    .trim()
    .email("E-mail inválido.")
    .optional()
    .nullable()
    .or(z.literal("")),

  dataNascimento: z
    .string()
    .optional()
    .nullable(),

  cep: textoOpcional,
  logradouro: textoOpcional,
  numero: textoOpcional,
  complemento: textoOpcional,
  bairro: textoOpcional,
  cidade: textoOpcional,
  estado: textoOpcional,

  observacoes: textoOpcional,
});

export const atualizarClienteSchema =
  criarClienteSchema.partial();