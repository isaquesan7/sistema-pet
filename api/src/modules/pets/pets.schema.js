import { z } from "zod";

const textoOpcional = z.string().trim().optional().nullable();

const numeroPositivoOpcional = z
  .union([z.number(), z.string()])
  .optional()
  .nullable()
  .transform((valor) => {
    if (valor === undefined || valor === null || valor === "") return null;
    return Number(valor);
  })
  .refine(
    (valor) => valor === null || (Number.isFinite(valor) && valor > 0),
    "O peso deve ser maior que zero."
  );

export const criarPetSchema = z.object({
  clienteId: z.string().min(1, "Tutor é obrigatório."),
  especieId: z.string().min(1, "Espécie é obrigatória."),
  racaId: z.string().optional().nullable(),
  nome: z.string().trim().min(1, "Nome do pet é obrigatório.").max(100),
  sexo: z.enum(["MACHO", "FEMEA", "NAO_INFORMADO"]).default("NAO_INFORMADO"),
  dataNascimento: z.string().optional().nullable(),
  castrado: z.boolean().optional().nullable(),
  cor: textoOpcional,
  microchip: textoOpcional,
  fotoUrl: textoOpcional,
  alergias: textoOpcional,
  doencasPreexistentes: textoOpcional,
  observacoes: textoOpcional,
  peso: numeroPositivoOpcional,
});

export const atualizarPetSchema = criarPetSchema
  .omit({ clienteId: true })
  .partial();

export const adicionarPesoSchema = z.object({
  peso: z
    .union([z.number(), z.string()])
    .transform(Number)
    .refine((valor) => Number.isFinite(valor) && valor > 0, "Peso inválido."),
  data: z.string().optional().nullable(),
  origem: textoOpcional,
  observacao: textoOpcional,
});

export const criarEspecieSchema = z.object({
  nome: z.string().trim().min(2).max(80),
});

export const atualizarEspecieSchema = z.object({
  nome: z.string().trim().min(2).max(80).optional(),
  ativo: z.boolean().optional(),
});

export const criarRacaSchema = z.object({
  especieId: z.string().min(1),
  nome: z.string().trim().min(1).max(120),
});

export const atualizarRacaSchema = z.object({
  nome: z.string().trim().min(1).max(120).optional(),
  ativo: z.boolean().optional(),
});
