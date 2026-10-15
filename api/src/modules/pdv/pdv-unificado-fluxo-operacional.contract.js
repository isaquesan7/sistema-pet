/**
 * PointVet M.5.16 — pure operational status of a manually checked card repasse.
 * Every status means a PointVet INTERNAL event, never verified bank credit.
 * Consistency checks fail closed. No writes, no PSP, no banking connection.
 */
import {gerarReferenciaRevisaoManualM519} from "./pdv-unificado-revisao-financeira.contract.js";
const fail=code=>{throw Error("M516_"+code);};
const MONEY=/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;
function cents(v){
 const s=typeof v==="string"?v:String(v);
 if(!MONEY.test(s))fail("VALOR_INVALIDO");
 const [n,f=""]=s.split(".");
 const x=Number(n)*100+Number(f.padEnd(2,"0"));
 if(!Number.isSafeInteger(x)||x<0)fail("VALOR_INVALIDO");
 return x;
}
const fixed=n=>Math.floor(n/100)+"."+String(n%100).padStart(2,"0");
export function projetarEtapasRepassesM516({organizacaoId,empresaId,comandaId,
 preparacoes,entradas=[],correcoes=[]}={}){
 if(![organizacaoId,empresaId,comandaId].every(x=>typeof x==="string"&&x)||
    !Array.isArray(preparacoes)||!Array.isArray(entradas)||!Array.isArray(correcoes)||
    preparacoes.length>50||entradas.length>50||correcoes.length>50)
  fail("CONTEXTO_INVALIDO");
 const unique=x=>new Set(x).size===x.length;
 if(!unique(preparacoes.map(x=>x.id))||
    !unique(preparacoes.map(x=>x.referenciaExtrato))||
    !unique(entradas.map(x=>x.id))||
    !unique(correcoes.map(x=>x.id)))
  fail("REGISTROS_DUPLICADOS");
 const map=new Map(preparacoes.map(p=>[p.id,p]));
 const originals=new Map();
 for(const a of entradas){
  if(!a?.id||a.empresaId!==empresaId||
     a.origem!=="REPASSE_CARTAO_MANUAL_UNIFICADO"||
     a.direcao!=="ENTRADA"||!a.origemId||
     !map.has(a.origemId)||!a.contaFinanceiraId||
     originals.has(a.origemId))
   fail("ENTRADA_ORFA_OU_INVALIDA");
  originals.set(a.origemId,a);
 }
 const compensated=new Set();
 for(const r of correcoes){
  const o=entradas.find(e=>e.id===r.origemId);
  if(!o||r.empresaId!==empresaId||
     r.origem!=="ESTORNO_REPASSE_CARTAO_MANUAL_UNIFICADO"||
     r.direcao!=="SAIDA"||r.contaFinanceiraId!==o.contaFinanceiraId||
     cents(r.valor)!==cents(o.valor)||
     r.usuarioId===o.usuarioId||compensated.has(r.origemId))
   fail("CORRECAO_ORFA_OU_INVALIDA");
  compensated.add(r.origemId);
 }
 const projection=preparacoes.map(p=>{
  if(!p?.id||p.organizacaoId!==organizacaoId||
     p.empresaId!==empresaId||p.comandaId!==comandaId||
     p.status!=="PREPARADA_SEM_BAIXA"||!p.usuarioId||
     !p.contaFinanceiraId||!p.referenciaExtrato||
     !p.dataCredito||!p.fingerprint||
     !["REPASSE_NORMAL","ANTECIPACAO"].includes(p.tipo))
   fail("PREPARACAO_INVALIDA");
  const bruto=cents(p.bruto),tarifa=cents(p.tarifaCartao);
  const antecipacao=cents(p.descontoAntecipacao),liquido=cents(p.liquidoDeclarado);
  if(bruto===0||liquido===0||bruto!==tarifa+antecipacao+liquido||
     (p.tipo==="REPASSE_NORMAL"&&antecipacao!==0)||
     (p.tipo==="ANTECIPACAO"&&antecipacao===0))
   fail("VALORES_DIVERGENTES");
  const review=p.parecerDocumental;
  if(review&&(review.preparacaoId!==p.id||
     review.empresaId!==empresaId||
     review.organizacaoId!==organizacaoId||
     review.conferenteId===p.usuarioId||
     review.status!=="CONFERENCIA_DOCUMENTAL_DECLARADA"||
     !/^[a-f0-9]{64}$/.test(review.fingerprint||"")))
   fail("REVISAO_DIVERGENTE");
  const entry=originals.get(p.id);
  if(entry&&(!review||entry.contaFinanceiraId!==p.contaFinanceiraId||
     cents(entry.valor)!==liquido||
     !entry.usuarioId))fail("LANCAMENTO_DIVERGENTE");
  const corrected=Boolean(entry&&compensated.has(entry.id));
  const etapa=corrected?"CORRECAO_INTERNA_REGISTRADA":
   entry?"REPASSE_INTERNO_CONFIRMADO_MANUALMENTE":
   review?"SEGUNDA_CONFERENCIA_DOCUMENTAL_DECLARADA":
   "AGUARDANDO_SEGUNDA_CONFERENCIA";
  const revisaoFinanceira=gerarReferenciaRevisaoManualM519({
   organizacaoId,empresaId,comandaId,
   preparacaoId:p.id,etapa,
   fingerprintPreparacao:p.fingerprint,
   fingerprintParecer:review?.fingerprint||null,
   contaFinanceiraId:p.contaFinanceiraId,valorLiquido:fixed(liquido),
   lancamentoOriginalId:entry?.id||null
  });
  return Object.freeze({
   preparacaoId:p.id,empresaId,comandaId,etapa,
   revisaoFinanceira,
   dataCredito:p.dataCredito,referenciaExtrato:p.referenciaExtrato,
   tipo:p.tipo,valorBruto:fixed(bruto),tarifaCartao:fixed(tarifa),
   descontoAntecipacao:fixed(antecipacao),valorLiquido:fixed(liquido),
   segundaConferenciaDocumental:!!review,
   confirmacaoManualInterna:!!entry,correcaoInterna:corrected,
   contaFinanceiraId:p.contaFinanceiraId,
   lancamentoId:entry?.id||null,
   provaBancariaAutomatica:false,habilitadoParaEscrita:false
  });
 });
 return Object.freeze({
  fase:"M5_16_FLUXO_OPERACIONAL_READ_ONLY",
  quantidade:projection.length,preparacoes:Object.freeze(projection),
  integracaoBancaria:false,provaBancariaIndependente:false,
  permissoesParaEscritaConcedidas:false,
  confirmacaoDisponivelNaTela:false,correcaoDisponivelNaTela:false,
  checkoutDisponivel:false,leituraSomente:true
 });
}
