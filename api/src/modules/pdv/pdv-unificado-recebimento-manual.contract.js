/**
 * PointVet PDV Unificado — registro manual de recebimentos (contrato puro).
 * Não integra com maquininhas/PSPs. NÃO cria pagamentos, vendas nem caixa.
 * A confirmação é uma declaração auditável do atendente, não uma
 * autorização eletrônica do banco. Uso futuro somente em fechamento atômico.
 */
import {createHash} from "node:crypto";
import {z} from "zod";

const CENTS=z.number().int().safe().positive().max(99999999999);
const FORMAS=["DINHEIRO","PIX","CARTAO_DEBITO","CARTAO_CREDITO","TRANSFERENCIA"];
const pagamento=z.object({
 forma:z.enum(FORMAS),
 valorCentavos:CENTS,
 confirmadoPeloAtendente:z.boolean(),
 parcelas:z.number().int().min(1).max(24).default(1),
 // Campo livre opcional: nome da maquininha, ID do comprovante, banco etc.
 referencia:z.string().trim().max(120).nullable().optional()
}).strict().superRefine((p,ctx)=>{
 if(p.forma!=="CARTAO_CREDITO"&&p.parcelas!==1)ctx.addIssue({
  code:"custom",message:"Parcelamento é permitido apenas para cartão de crédito",path:["parcelas"]
 });
});
export const recebimentoManualSchema=z.object({
 versao:z.number().int().positive(),
 alocacoes:z.array(z.object({
  empresaId:z.string().trim().min(1),
  sessaoCaixaId:z.string().trim().min(1),
  pagamentos:z.array(pagamento).min(1).max(12)
 }).strict()).min(1).max(30)
}).strict();

function centavos(v){
 const n=Math.round(Number(v)*100);
 if(!Number.isSafeInteger(n)||n<0)throw Error("VALOR_DA_RESERVA_INVALIDO");
 return n;
}
/**
 * Compare operator input to the server-owned frozen preparation snapshot.
 * No browser-provided totals or CNPJ names may override saved allocations.
 * This contract is NOT sufficient for production release: DB transaction,
 * uniqueness, stock, fiscal and user authority must be rechecked at commit.
 */
export function conferirRecebimentosManuais({dados,snapshot,organizacaoId,reservaId}){
 const parsed=recebimentoManualSchema.safeParse(dados);
 if(!parsed.success)throw Error("REGISTRO_MANUAL_INVALIDO");
 if(!snapshot||snapshot.versaoRascunho!==parsed.data.versao||
   !Array.isArray(snapshot.operacoes)||!snapshot.operacoes.length||
   typeof organizacaoId!=="string"||!organizacaoId||
   typeof reservaId!=="string"||!reservaId)throw Error("PREPARACAO_INVALIDA");
 const expected=new Map(snapshot.operacoes.map(o=>[o.empresaId,o]));
 if(expected.size!==snapshot.operacoes.length)throw Error("PREPARACAO_INVALIDA");
 const seen=new Set(),pendencias=[],movimentos=[];
 for(const a of parsed.data.alocacoes){
  if(seen.has(a.empresaId))throw Error("EMPRESA_DUPLICADA");
  seen.add(a.empresaId);
  const source=expected.get(a.empresaId);
  if(!source)throw Error("EMPRESA_FORA_DA_COMANDA");
  if(a.sessaoCaixaId!==source.sessaoCaixaId)throw Error("CAIXA_DIVERGENTE");
  const total=a.pagamentos.reduce((sum,p)=>sum+p.valorCentavos,0);
  if(!Number.isSafeInteger(total)||total!==centavos(source.total))throw Error("SOMA_DIVERGENTE");
  for(const p of a.pagamentos){
   if(!p.confirmadoPeloAtendente)pendencias.push({codigo:"RECEBIMENTO_NAO_CONFIRMADO",empresaId:a.empresaId,forma:p.forma});
  }
  movimentos.push({empresaId:a.empresaId,cnpj:source.cnpj,
   sessaoCaixaId:source.sessaoCaixaId,
   totalCentavos:total,
   pagamentos:a.pagamentos.map(({forma,valorCentavos,parcelas,referencia,confirmadoPeloAtendente})=>({
    forma,valorCentavos,parcelas,referencia:referencia||null,confirmadoPeloAtendente
   }))});
 }
 for(const id of expected.keys())if(!seen.has(id))pendencias.push({codigo:"EMPRESA_SEM_REGISTRO",empresaId:id});
 movimentos.sort((a,b)=>a.empresaId.localeCompare(b.empresaId));
 const fingerprint=createHash("sha256").update(JSON.stringify({
  organizacaoId,reservaId,versao:parsed.data.versao,movimentos
 })).digest("hex");
 return {movimentos,pendencias,fingerprint,
  prontoParaPersistirEmTransacao:pendencias.length===0,
  podeEfetuarCobranca:false,gravouPagamento:false,
  confirmadoPorPSP:false, 
  descricao:"Conferência declarada pelo atendente; baixa financeira ainda depende de transação e auditoria."};
}
