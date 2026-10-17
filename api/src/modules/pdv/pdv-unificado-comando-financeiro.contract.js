/**
 * PointVet M.5.18 — server-side optimistic financial authorization.
 *
 * Bind each manually reviewed request to the EXACT current DB preparation,
 * second review and (for corrections) original ledger movement. Verify after
 * comanda FOR UPDATE in the isolated CI transaction before any financial write.
 * Never proves bank transfer; it only prevents stale/manual UI approvals.
 */
import {createHash} from "node:crypto";
const fail=reason=>{throw Error("M518_"+reason);};
const SHA=/^[a-f0-9]{64}$/;
const REF=/^[A-Za-z0-9][A-Za-z0-9_./:-]{7,119}$/;
const MONEY=/^(?:0|[1-9]\d{0,10})(?:\.\d{1,2})?$/;
function cents(raw){
 const text=String(raw);
 if(!MONEY.test(text))fail("VALOR_NAO_CANONICO");
 const [whole,decimal=""]=text.split(".");
 const result=Number(whole)*100+Number(decimal.padEnd(2,"0"));
 if(!Number.isSafeInteger(result)||result<=0)fail("VALOR_INVALIDO");
 return result;
}
function valid(x){return typeof x==="string"&&x.length>0;}
function digest(command){return createHash("sha256").update(JSON.stringify(command)).digest("hex");}
export function validarComandoFinanceiroManualM518({
 operacao,dados,organizacaoId,empresaId,usuarioId,preparacao,parecer,
 lancamentoOriginal=null
}={}){
 if(!["CONFIRMAR_REPASSE","CORRIGIR_REPASSE"].includes(operacao)||
    ![organizacaoId,empresaId,usuarioId].every(valid)||!preparacao||
    preparacao.organizacaoId!==organizacaoId||
    preparacao.empresaId!==empresaId||
    preparacao.status!=="PREPARADA_SEM_BAIXA"||
    !valid(preparacao.id)||!valid(preparacao.contaFinanceiraId)||
    !SHA.test(preparacao.fingerprint||"")||
    !REF.test(preparacao.referenciaExtrato||"")||
    !dados||typeof dados!=="object"||Array.isArray(dados))
  fail("CONTEXTO_INVALIDO");
 if(dados.fingerprintPreparacaoEsperado!==preparacao.fingerprint||
    dados.contaFinanceiraIdEsperada!==preparacao.contaFinanceiraId||
    !SHA.test(dados.fingerprintPreparacaoEsperado||""))
  fail("REVISAO_FINANCEIRA_DESATUALIZADA");
 const value=cents(dados.valorLiquidoEsperado);
 if(value!==cents(preparacao.liquidoDeclarado))
  fail("VALOR_LIQUIDO_DESATUALIZADO");
 if(operacao==="CONFIRMAR_REPASSE"){
  if(!parecer||parecer.preparacaoId!==preparacao.id||
     parecer.empresaId!==empresaId||
     parecer.organizacaoId!==organizacaoId||
     parecer.status!=="CONFERENCIA_DOCUMENTAL_DECLARADA"||
     !SHA.test(parecer.fingerprint||"")||
     dados.fingerprintParecerEsperado!==parecer.fingerprint||
     dados.confirmouCreditoNoExtrato!==true||
     dados.referenciaExtrato!==preparacao.referenciaExtrato)
   fail("PARECER_OU_DECLARACAO_DESATUALIZADO");
  const record={versao:1,operacao,organizacaoId,empresaId,usuarioId,
   preparacaoId:preparacao.id,
   contaFinanceiraId:preparacao.contaFinanceiraId,
   fingerprintPreparacao:preparacao.fingerprint,
   fingerprintParecer:parecer.fingerprint,
   valorLiquidoCentavos:value,
   referenciaExterna:preparacao.referenciaExtrato};
  return Object.freeze({fingerprintComando:digest(record),
   valorLiquidoCentavos:value,operacao,
   verificaBancoAutomaticamente:false,executaPagamento:false});
 }
 if(!lancamentoOriginal||lancamentoOriginal.empresaId!==empresaId||
    lancamentoOriginal.origem!=="REPASSE_CARTAO_MANUAL_UNIFICADO"||
    lancamentoOriginal.origemId!==preparacao.id||
    lancamentoOriginal.direcao!=="ENTRADA"||
    lancamentoOriginal.contaFinanceiraId!==preparacao.contaFinanceiraId||
    !valid(lancamentoOriginal.id)||
    lancamentoOriginal.usuarioId===usuarioId||
    dados.lancamentoOriginalIdEsperado!==lancamentoOriginal.id||
    cents(lancamentoOriginal.valor)!==value)
  fail("LANCAMENTO_ORIGINAL_DESATUALIZADO");
 if(dados.confirmouCorrecaoExterna!==true||
    !REF.test(dados.referenciaCorrecao||"")||
    dados.referenciaCorrecao===preparacao.referenciaExtrato||
    typeof dados.motivo!=="string"||
    dados.motivo.trim().length<12||dados.motivo.trim().length>500)
  fail("CORRECAO_INCOMPLETA");
 const record={versao:1,operacao,organizacaoId,empresaId,usuarioId,
  preparacaoId:preparacao.id,lancamentoOriginalId:lancamentoOriginal.id,
  contaFinanceiraId:preparacao.contaFinanceiraId,
  fingerprintPreparacao:preparacao.fingerprint,
  valorLiquidoCentavos:value,
  referenciaExterna:dados.referenciaCorrecao,
  motivo:dados.motivo.trim()};
 return Object.freeze({fingerprintComando:digest(record),
  valorLiquidoCentavos:value,operacao,
  verificaBancoAutomaticamente:false,executaPagamento:false});
}
