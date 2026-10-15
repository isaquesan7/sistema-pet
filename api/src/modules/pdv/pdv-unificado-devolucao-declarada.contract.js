/**
 * M.5.22: declaration of manual customer refund observed OUTSIDE PointVet.
 * Pure contract; NOT proof of bank transfer, not cash out or fiscal refund.
 * Only CI-isolated sandbox writes an immutable audit row.
 */
import {createHash} from "node:crypto";
import {gerarReferenciaRevisaoManualM519} from "./pdv-unificado-revisao-financeira.contract.js";
const fail=c=>{throw Error("M522_"+c);};
const MONEY=/^(?:0|[1-9]\d{0,9})\.\d{2}$/;
const REF=/^[A-Za-z0-9][A-Za-z0-9_./:-]{7,119}$/;
const SHA=/^[0-9a-f]{64}$/;
const text=v=>typeof v==="string"&&v.trim().length>0;
export const centavosM522=(value,positive=false)=>{
 const s=String(value);
 if(!MONEY.test(s))fail("VALOR_INVALIDO");
 const [whole,decimal]=s.split(".");
 const cents=Number(whole)*100+Number(decimal);
 if(!Number.isSafeInteger(cents)||cents<0||(positive&&cents===0))
  fail("VALOR_INVALIDO");
 return cents;
};
export const reaisM522=c=>Math.floor(c/100)+"."+String(c%100).padStart(2,"0");
const dbMoney=v=>{const t=String(v);if(!/^(?:0|[1-9]\\d{0,9})(?:\\.\\d{1,2})?$/.test(t))fail("VALOR_DB_INVALIDO");const [n,d=""]=t.split(".");return n+"."+d.padEnd(2,"0");};
export function validarDeclaracaoDevolucaoM522({
 organizacaoId,empresaId,usuarioId,preparacao,parecer,entrada,dados
}={}){
 if(![organizacaoId,empresaId,usuarioId].every(text)||
    !preparacao||preparacao.organizacaoId!==organizacaoId||
    preparacao.empresaId!==empresaId||!text(preparacao.comandaId)||
    preparacao.status!=="PREPARADA_SEM_BAIXA"||
    !SHA.test(preparacao.fingerprint||"")||
    !text(preparacao.contaFinanceiraId)||
    !parecer||parecer.preparacaoId!==preparacao.id||
    parecer.organizacaoId!==organizacaoId||
    parecer.empresaId!==empresaId||
    parecer.status!=="CONFERENCIA_DOCUMENTAL_DECLARADA"||
    !SHA.test(parecer.fingerprint||"")||
    !entrada||entrada.origem!=="REPASSE_CARTAO_MANUAL_UNIFICADO"||
    entrada.origemId!==preparacao.id||
    entrada.empresaId!==empresaId||
    entrada.contaFinanceiraId!==preparacao.contaFinanceiraId||
    entrada.direcao!=="ENTRADA"||!text(entrada.id)||
    entrada.usuarioId===usuarioId||!dados||
    typeof dados!=="object"||Array.isArray(dados))
  fail("CONTEXTOS_OU_SEGREGACAO_INVALIDOS");
 const bruto=centavosM522(dbMoney(preparacao.bruto),true);
 const liquido=centavosM522(dbMoney(preparacao.liquidoDeclarado),true);
 if(centavosM522(dbMoney(entrada.valor),true)!==liquido||
    bruto<liquido)fail("REPASSE_ORIGINAL_DIVERGENTE");
 const revisao=gerarReferenciaRevisaoManualM519({
  organizacaoId,empresaId,comandaId:preparacao.comandaId,
  preparacaoId:preparacao.id,
  etapa:"REPASSE_INTERNO_CONFIRMADO_MANUALMENTE",
  fingerprintPreparacao:preparacao.fingerprint,
  fingerprintParecer:parecer.fingerprint,
  contaFinanceiraId:preparacao.contaFinanceiraId,
  valorLiquido:reaisM522(liquido),lancamentoOriginalId:entrada.id
 });
 if(dados.codigoRevisaoEsperado!==revisao.codigoRevisao||
    dados.conciliacaoOrigemIdEsperada!==entrada.id)
  fail("REVISAO_FINANCEIRA_DESATUALIZADA");
 if(dados.confirmouDevolucaoExterna!==true||
    !REF.test(dados.referenciaExterna||"")||
    typeof dados.motivo!=="string"||
    dados.motivo.trim().length<12||
    dados.motivo.trim().length>500)
  fail("DECLARACAO_OU_REFERENCIA_INVALIDA");
 const valor=centavosM522(dados.valorBrutoDevolvido,true);
 const saldoEsperado=centavosM522(dados.saldoRestanteBrutoEsperado);
 if(valor>bruto||saldoEsperado>bruto)
  fail("VALOR_SUPERIOR_AO_BRUTO");
 const normalized={
  versao:"M522_V1",organizacaoId,empresaId,usuarioId,
  comandaId:preparacao.comandaId,preparacaoId:preparacao.id,
  conciliacaoOrigemId:entrada.id,
  referenciaExterna:dados.referenciaExterna,
  motivo:dados.motivo.trim(),valorBruto:reaisM522(valor),
  saldoRestanteBrutoEsperado:reaisM522(saldoEsperado),
  codigoRevisao:revisao.codigoRevisao
 };
 return Object.freeze({...normalized,
  fingerprint:createHash("sha256").update(JSON.stringify(normalized)).digest("hex"),
  valorCentavos:valor,saldoEsperadoCentavos:saldoEsperado,
  transferenciaBancariaConfirmadaAutomaticamente:false,
  executouReembolso:false,permitiuCheckout:false});
}
export function conferirLimiteAcumuladoM522({
 bruto,anteriores=[],novoValor,saldoRestanteBrutoEsperado
}={}){
 const limite=centavosM522(bruto,true);
 const novo=centavosM522(novoValor,true);
 const saldoEsperado=centavosM522(saldoRestanteBrutoEsperado);
 if(!Array.isArray(anteriores)||anteriores.length>500)
  fail("HISTORICO_INCOMPLETO");
 const refs=new Set();
 let total=0;
 for(const row of anteriores){
  if(!row||!REF.test(row.referenciaExterna||"")||
     refs.has(row.referenciaExterna)||
     row.confirmacaoHumanaExterna!==true)
   fail("HISTORICO_INVALIDO");
  refs.add(row.referenciaExterna);
  total+=centavosM522(row.valorBruto,true);
  if(!Number.isSafeInteger(total)||total>limite)
   fail("HISTORICO_SUPERA_BRUTO");
 }
 const restante=limite-total;
 if(restante!==saldoEsperado)fail("SALDO_VISUALIZADO_DESATUALIZADO");
 if(novo>restante)fail("DEVOLUCAO_SUPERA_RESTANTE");
 return Object.freeze({
  bruto:reaisM522(limite),totalAnterior:reaisM522(total),
  valorDeclarado:reaisM522(novo),totalDepois:reaisM522(total+novo),
  restanteDepois:reaisM522(restante-novo),
  status:"DECLARACAO_HUMANA_NAO_VERIFICADA_PELO_BANCO",
  afetaConciliacaoFinanceira:false,afetaPagamento:false,
  alteraSaldoBancario:false,emiteDocumentoFiscal:false,
  houveTransferenciaPeloPointVet:false
 });
}
