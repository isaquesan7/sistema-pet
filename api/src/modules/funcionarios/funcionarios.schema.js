import { z } from "zod";

const textoOpcional = z.string().trim().optional().nullable();
const dataOpcional = z.string().optional().nullable();
const dinheiroOpcional = z.union([z.number(), z.string()]).transform(Number).optional().nullable();
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário deve estar no formato HH:mm.");

export const funcaoSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  descricao: textoOpcional,
  ativo: z.boolean().optional(),
});

export const funcaoAtualizarSchema = funcaoSchema.partial();

export const funcionarioSchema = z.object({
  usuarioId: z.string().optional().nullable(),
  funcaoId: z.string().optional().nullable(),
  nome: z.string().trim().min(2).max(150),
  cpf: textoOpcional,
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  telefone: textoOpcional,
  matricula: textoOpcional,
  dataAdmissao: dataOpcional,
  dataDemissao: dataOpcional,
  salarioBase: dinheiroOpcional,
  status: z.enum(["ATIVO", "AFASTADO", "FERIAS", "DESLIGADO"]).optional(),
  observacoes: textoOpcional,
  empresas: z.array(z.object({
    empresaId: z.string().min(1),
    principal: z.boolean().optional(),
  })).optional(),
});

export const funcionarioAtualizarSchema = funcionarioSchema.partial();

export const jornadaSchema = z.object({
  jornadas: z.array(z.object({
    empresaId: z.string().min(1),
    diaSemana: z.number().int().min(0).max(6),
    entradaPrevista: hora,
    saidaPrevista: hora,
    inicioIntervalo: hora.optional().nullable(),
    fimIntervalo: hora.optional().nullable(),
    toleranciaMinutos: z.number().int().min(0).max(120).optional(),
    ativo: z.boolean().optional(),
  })),
});

export const baterPontoSchema = z.object({
  tipo: z.enum(["ENTRADA", "INICIO_PAUSA", "FIM_PAUSA", "SAIDA"]).optional(),
});

export const ajustePontoSchema = z.object({
  horarioNovo: z.string().datetime(),
  motivo: z.string().trim().min(5).max(500),
});
