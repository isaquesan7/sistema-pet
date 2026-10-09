import { z } from "zod";

const optionalText = z.string().trim().optional().nullable();

export const cadastroSchema = z.object({
  organizacaoSlug: z.string().trim().min(1),
  nome: z.string().trim().min(2).max(150),
  email: z.string().trim().email(),
  senha: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
  telefone: optionalText,
  cpfCnpj: optionalText,
  manterConectado: z.boolean().optional().default(true),
});

export const loginSchema = z.object({
  organizacaoSlug: z.string().trim().min(1),
  login: z.string().trim().min(3),
  senha: z.string().min(1),
  manterConectado: z.boolean().optional().default(true),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export const perfilSchema = z.object({
  nome: z.string().trim().min(2).max(150).optional(),
  telefone: optionalText,
  whatsapp: optionalText,
  dataNascimento: optionalText,
  cep: optionalText,
  logradouro: optionalText,
  numero: optionalText,
  complemento: optionalText,
  bairro: optionalText,
  cidade: optionalText,
  estado: optionalText,
});

export const petSchema = z.object({
  especieId: z.string().min(1),
  racaId: z.string().optional().nullable(),
  nome: z.string().trim().min(1).max(100),
  sexo: z.enum(["MACHO", "FEMEA", "NAO_INFORMADO"]).optional().default("NAO_INFORMADO"),
  dataNascimento: optionalText,
  castrado: z.boolean().optional().nullable(),
  cor: optionalText,
  fotoUrl: optionalText,
  alergias: optionalText,
  doencasPreexistentes: optionalText,
  observacoes: optionalText,
});

export const agendamentoConsultorioSchema = z.object({
  petId: z.string().min(1),
  itemCatalogoId: z.string().min(1),
  inicio: z.string().datetime({ offset: true }),
  queixaPrincipal: optionalText,
});

export const agendamentoBanhoSchema = z.object({
  petId: z.string().min(1),
  itemCatalogoIds: z.array(z.string().min(1)).min(1),
  inicio: z.string().datetime({ offset: true }),
  observacoesCliente: optionalText,
  formaPagamento: z.enum(["PIX", "CARTAO"]).default("PIX"),
});
