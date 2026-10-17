/**
 * PointVet M.5.19 — immutable read-only financial revision reference.
 * Identifies exactly what the operator has seen; never authorizes a write.
 * SHA-256 is a consistency fingerprint, NOT a bank signature or evidence.
 */
import {createHash} from "node:crypto";
const SHA=/^[a-f0-9]{64}$/;
const fail=c=>{throw Error("M519_"+c);};
const valid=x=>typeof x==="string"&&x.trim().length>0;
const AMOUNT=/^(?:0|[1-9]\d{0,10})(?:\.\d{1,2})?$/;
function cents(raw){
 if(typeof raw!=="string"||!AMOUNT.test(raw))fail("VALOR_INVALIDO");
 const [major,minor=""]=raw.split(".");
 const v=Number(major)*100+Number(minor.padEnd(2,"0"));
 if(!Number.isSafeInteger(v)||v<=0)fail("VALOR_INVALIDO");
 return v;
}
export function gerarReferenciaRevisaoManualM519({
 organizacaoId,empresaId,comandaId,preparacaoId,etapa,
 fingerprintPreparacao,fingerprintParecer=null,
 contaFinanceiraId,valorLiquido,lancamentoOriginalId=null
}={}){
 if(![organizacaoId,empresaId,comandaId,preparacaoId,
    contaFinanceiraId,etapa].every(valid)||
    !SHA.test(fingerprintPreparacao||"")||
    (fingerprintParecer!==null&&!SHA.test(fingerprintParecer))||
    (lancamentoOriginalId!==null&&!valid(lancamentoOriginalId))||
    !["AGUARDANDO_SEGUNDA_CONFERENCIA",
     "SEGUNDA_CONFERENCIA_DOCUMENTAL_DECLARADA",
     "REPASSE_INTERNO_CONFIRMADO_MANUALMENTE",
     "CORRECAO_INTERNA_REGISTRADA"].includes(etapa))
  fail("CONTEXTO_INVALIDO");
 const reviewed=etapa!=="AGUARDANDO_SEGUNDA_CONFERENCIA";
 const posted=["REPASSE_INTERNO_CONFIRMADO_MANUALMENTE",
    "CORRECAO_INTERNA_REGISTRADA"].includes(etapa);
 if((reviewed&&fingerprintParecer===null)||
    (!reviewed&&fingerprintParecer!==null)||
    (posted&&!lancamentoOriginalId)||
    (!posted&&lancamentoOriginalId!==null))
  fail("ETAPA_E_VERSAO_DIVERGENTES");
 const value=cents(valorLiquido);
 const payload={fase:"M5_19_REFERENCIA_REVISAO_INTERNA",organizacaoId,
  empresaId,comandaId,preparacaoId,etapa,
  fingerprintPreparacao,fingerprintParecer,
  contaFinanceiraId,valorLiquidoCentavos:value,lancamentoOriginalId};
 const codigo=createHash("sha256").update(JSON.stringify(payload)).digest("hex");
 return Object.freeze({
  codigoRevisao:codigo,
  fingerprintPreparacaoEsperado:fingerprintPreparacao,
  fingerprintParecerEsperado:fingerprintParecer,
  contaFinanceiraIdEsperada:contaFinanceiraId,
  valorLiquidoEsperado:valorLiquido,
  lancamentoOriginalIdEsperado:lancamentoOriginalId,
  etapaRevisada:etapa,
  referenciaParaConferenciaInterna:true,
  comprovaTransferenciaBancaria:false,
  concedePermissaoFinanceira:false,
  enviaDadosParaBanco:false,
  habilitaConfirmacaoReal:false,
  habilitaCorrecaoReal:false,
  habilitaCheckout:false
 });
}
export function conferirRevisaoAtualM519({anterior,atual}={}){
 if(!anterior||!atual||
    !SHA.test(anterior.codigoRevisao||"")||
    !SHA.test(atual.codigoRevisao||""))
  fail("VERSAO_INVALIDA");
 return Object.freeze({
  permaneceAtual:anterior.codigoRevisao===atual.codigoRevisao,
  precisaRevisar:anterior.codigoRevisao!==atual.codigoRevisao,
  confirmouCreditoNoBanco:false,executouLancamento:false
 });
}
