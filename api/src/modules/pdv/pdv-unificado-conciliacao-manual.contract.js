/**
 * PointVet M.5.5 — declaração de repasse externo de parcelas de cartão.
 * Contrato puro. NÃO valida extrato bancário nem integra PSP/TEF/maquininha.
 */
import {createHash} from "node:crypto";
const money=/^(?:0|[1-9]\d{0,10})(?:\.\d{1,2})?$/;
const reference=/^[A-Za-z0-9][A-Za-z0-9_./:-]{7,119}$/;
export function normalizarConciliacaoManualM55(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("M55_PEDIDO_INVALIDO");
 if(raw.confirmouRepasseExterno!==true)throw Error("M55_CONFIRMACAO_EXTERNA_OBRIGATORIA");
 if(typeof raw.referenciaExterna!=="string"||!reference.test(raw.referenciaExterna.trim()))
  throw Error("M55_REFERENCIA_OBRIGATORIA");
 if(typeof raw.contaFinanceiraId!=="string"||!/^[A-Za-z0-9_-]{3,100}$/.test(raw.contaFinanceiraId))
  throw Error("M55_CONTA_INVALIDA");
 if(!money.test(String(raw.valor)))throw Error("M55_VALOR_INVALIDO");
 const [whole,fraction=""]=String(raw.valor).split(".");
 const valorCentavos=Number(whole)*100+Number(fraction.padEnd(2,"0"));
 if(!Number.isSafeInteger(valorCentavos)||valorCentavos<=0)throw Error("M55_VALOR_INVALIDO");
 return Object.freeze({referenciaExterna:raw.referenciaExterna.trim(),
  contaFinanceiraId:raw.contaFinanceiraId,valorCentavos,confirmouRepasseExterno:true});
}
export function fingerprintConciliacaoManualM55({parcelaId,organizacaoId,empresaId,pedido}){
 for(const id of [parcelaId,organizacaoId,empresaId])
  if(typeof id!=="string"||!id.length)throw Error("M55_CONTEXTO_INVALIDO");
 return createHash("sha256").update(JSON.stringify({
  fase:"M55_REPASSE_MANUAL",parcelaId,organizacaoId,empresaId,
  contaFinanceiraId:pedido.contaFinanceiraId,
  valorCentavos:pedido.valorCentavos,
  referenciaExterna:pedido.referenciaExterna
 })).digest("hex");
}
