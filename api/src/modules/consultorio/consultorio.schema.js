import { z } from "zod";

const texto = z.string().trim().optional().nullable();
const dataHora = z.string().datetime().optional().nullable();
const data = z.string().optional().nullable();
const numeroPositivo = z.coerce.number().positive();

export const atendimentoSchema = z.object({
  clienteId: z.string().min(1, "Cliente é obrigatório."),
  petId: z.string().min(1, "Pet é obrigatório."),
  queixaPrincipal: texto,
  agendadoPara: dataHora,
  peso: z.coerce.number().positive().optional().nullable(),
  itemConsultaId: z.string().optional().nullable(),
  lancarComanda: z.boolean().optional().default(true),
});

export const atendimentoAtualizarSchema = z.object({
  queixaPrincipal: texto,
  anamnese: texto,
  exameFisico: texto,
  diagnostico: texto,
  conduta: texto,
  observacoesInternas: texto,
  temperatura: z.coerce.number().min(20).max(50).optional().nullable(),
  frequenciaCardiaca: z.coerce.number().int().positive().optional().nullable(),
  frequenciaRespiratoria: z.coerce.number().int().positive().optional().nullable(),
  hidratacao: texto,
  mucosas: texto,
  tpcSegundos: z.coerce.number().min(0).max(30).optional().nullable(),
  peso: z.coerce.number().positive().optional().nullable(),
  agendadoPara: dataHora,
});

export const prescricaoSchema = z.object({
  orientacoes: texto,
  itens: z.array(z.object({
    itemCatalogoId: z.string().optional().nullable(),
    medicamento: z.string().trim().min(1, "Medicamento é obrigatório."),
    concentracao: texto,
    dose: texto,
    via: texto,
    frequencia: texto,
    duracao: texto,
    quantidade: texto,
    orientacao: texto,
  })).min(1, "Adicione pelo menos um medicamento."),
});

export const vacinaSchema = z.object({
  itemCatalogoId: z.string().optional().nullable(),
  loteProdutoId: z.string().optional().nullable(),
  nomeVacina: z.string().trim().min(1, "Nome da vacina é obrigatório."),
  fabricante: texto,
  numeroLote: texto,
  dataValidade: data,
  dose: texto,
  via: texto,
  local: texto,
  aplicadaEm: dataHora,
  proximaDose: data,
  observacoes: texto,
  consumirEstoque: z.boolean().optional().default(false),
  quantidadeEstoque: numeroPositivo.optional().default(1),
});

export const vermifugacaoSchema = z.object({
  itemCatalogoId: z.string().optional().nullable(),
  loteProdutoId: z.string().optional().nullable(),
  produto: z.string().trim().min(1, "Produto é obrigatório."),
  principioAtivo: texto,
  dose: texto,
  numeroLote: texto,
  dataValidade: data,
  aplicadaEm: dataHora,
  proximaDose: data,
  observacoes: texto,
  consumirEstoque: z.boolean().optional().default(false),
  quantidadeEstoque: numeroPositivo.optional().default(1),
});

export const exameSchema = z.object({
  itemCatalogoId: z.string().optional().nullable(),
  nome: z.string().trim().min(1, "Nome do exame é obrigatório."),
  observacoes: texto,
  lancarComanda: z.boolean().optional().default(true),
});

export const exameAtualizarSchema = z.object({
  status: z.enum(["SOLICITADO", "COLETADO", "EM_PROCESSAMENTO", "RESULTADO_DISPONIVEL", "CANCELADO"]).optional(),
  resultadoTexto: texto,
  arquivoUrl: texto,
  observacoes: texto,
});

export const procedimentoSchema = z.object({
  itemCatalogoId: z.string().min(1, "Produto/serviço é obrigatório."),
  quantidade: z.coerce.number().positive().default(1),
  observacoes: texto,
  lancarComanda: z.boolean().optional().default(true),
});

export const documentoSchema = z.object({
  tipo: z.enum(["RECEITA", "ATESTADO", "RELATORIO", "ORIENTACAO", "OUTRO"]),
  titulo: z.string().trim().min(1, "Título é obrigatório."),
  conteudo: z.string().trim().min(1, "Conteúdo é obrigatório."),
  arquivoUrl: texto,
  visivelCliente: z.boolean().optional().default(true),
});
